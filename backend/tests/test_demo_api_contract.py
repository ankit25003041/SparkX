"""Phase 9/11 — GeoSRv2 demo API + UI copy contract regression tests.

Locks the invariant that the live /demo and /results experiences are backed by the real
GeoSRv2 10 m -> 5 m checkpoint and never present simulated/demo-fallback messaging when the
backend is connected. Complements backend/tests/test_geosr_v2_demo.py, which covers the
checkpoint artifacts and inference output properties.
"""
from pathlib import Path
import json
import time
import sys

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]  # SparkX root
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

CHECKPOINT = REPO / "model/checkpoints/geosr_v2/GeoSR_v2_epoch34_best.pt"
SAMPLE_TIF = REPO / "data/sample_sentinel2_10m.tif"
FRONTEND_SRC = REPO / "frontend/src"
DEMO_REPORT = REPO / "data/demo/geosr_v2/validation_report.json"


# --------------------------------------------------------------------------- #
# Backend API contract (spec tests 1, 2, 7, 10, 11, 12)
# --------------------------------------------------------------------------- #

def test_api_demo_report_returns_200():
    with TestClient(app) as client:
        r = client.get("/api/demo/report")
        assert r.status_code == 200  # TEST 1


def test_api_demo_report_has_geoosrv2_semantics():
    rep = json.loads(DEMO_REPORT.read_text(encoding="utf-8"))
    assert rep.get("scale_factor") == 2          # TEST 2
    assert rep.get("reference_available") is False   # TEST 10
    # Real scene with no HR reference: reference-based metrics are legitimately null
    # (TEST 7, 11) but the endpoint is fully available (TEST 12).
    assert rep.get("psnr") is None
    assert rep.get("ssim") is None
    assert rep.get("sam") is None
    assert rep.get("uncertainty_summary", {}).get("confidence_score") is not None
    assert rep.get("band_comparison"), "spectral diagnostics must be present (not fabricated)"
    assert rep["reference_note"].startswith("Reference-based quantitative")


# --------------------------------------------------------------------------- #
# Checkpoint selection / real-SM path (spec tests 3, 4, 5, 16)
# --------------------------------------------------------------------------- #

def test_checkpoint_loads_real_model_not_baseline():
    from app.processing.geosr_backend import build_model_fn

    # GeoSRv2 checkpoint -> a real model_fn (baseline returns None when no checkpoint).
    fn = build_model_fn(str(CHECKPOINT), scale_factor=2)
    assert fn is not None  # real SR, not the bicubic baseline -> is_demo=False downstream


def test_geosr_v2_checkpoint_is_epoch_34_with_817092_params():
    from model.architectures.geosr_v2 import load_geosr_v2_checkpoint
    from model.architectures.geosr_v2 import build_geosr_v2

    model = build_geosr_v2(num_channels=4)
    info = load_geosr_v2_checkpoint(model, CHECKPOINT)
    assert info["epoch"] == 34          # TEST 4
    assert info["parameter_count"] == 817092   # TEST 5
    assert info["missing_keys"] == ["residual_scale"]


def test_live_upload_is_demo_false(client, monkeypatch):
    # Point the live app at the real GeoSRv2 checkpoint for this job only.
    monkeypatch.setattr(settings, "GEOSR_CHECKPOINT", str(CHECKPOINT))

    data = SAMPLE_TIF.read_bytes()
    r = client.post(
        "/api/upload",
        files={"file": (SAMPLE_TIF.name, data, "image/tiff")},
    )
    assert r.status_code == 201
    job_id = r.json()["job_id"]

    pr = client.post(
        f"/api/jobs/{job_id}/process",
        json={
            "model": "geosr_esrgan",
            "scale_factor": 2,
            "band_combination": "RGB",
            "overlap_percent": 20,
            "tile_size": 256,
            "use_tiling": True,
        },
    )
    assert pr.status_code in (200, 202)

    completed = False
    for _ in range(60):
        st = client.get(f"/api/jobs/{job_id}/status").json()
        if st["status"] == "completed":
            completed = True
            break
        if st["status"] in ("failed", "cancelled"):
            pytest.fail(f"job {st['status']}: {st.get('error_message')}")
        time.sleep(1)
    assert completed, "job did not complete in time"

    res = client.get(f"/api/jobs/{job_id}/results").json()
    assert res["is_demo"] is False  # TEST 16
    rep = client.get(f"/api/jobs/{job_id}/validation-report").json()
    assert rep["scale_factor"] == 2
    assert rep["reference_available"] is False


# --------------------------------------------------------------------------- #
# Frontend UI copy contract (spec tests 13, 14, 15)
# --------------------------------------------------------------------------- #

FORBIDDEN_LIVE = (
    "simulated",                          # TEST 13: no "simulated metrics" anywhere live
    "connect a backend + trained checkpoint to enable real validation",  # TEST 14
    "demo data",                          # TEST 13: no "DEMO DATA" branding on live results
    "phase 2 baseline",                   # TEST 14: no stale stage label
    "16x increase",
    "4x boost",
    "2.5m gsd (4",
)

LIVE_FILES = [
    FRONTEND_SRC / "app/results/[id]/page.tsx",
    FRONTEND_SRC / "app/demo/[id]/page.tsx",
    FRONTEND_SRC / "app/layout.tsx",
    FRONTEND_SRC / "app/analytics/page.tsx",
    FRONTEND_SRC / "lib/api.ts",
]


def test_frontend_live_ui_has_no_misleading_copy():
    for f in LIVE_FILES:
        assert f.exists(), f
        text = f.read_text(encoding="utf-8").lower()
        for bad in FORBIDDEN_LIVE:
            assert bad not in text, f"{bad!r} found in {f}"


def test_frontend_demo_route_is_geoosrv2_not_legacy_esrgan():
    src = (FRONTEND_SRC / "app/demo/[id]/page.tsx").read_text(encoding="utf-8")
    assert "GeoSRv2" in src
    assert "geosrV2Demo" in src
    assert "LEGACY_DEMO_IDS" in src          # TEST 15: legacy ids redirected
    assert "redirect('/demo')" in src
    assert "sihDemoScenes" not in src         # legacy ESGAN data module NOT used by /demo


def test_frontend_demo_picker_links_v2_and_backend_url_is_set():
    picker = (FRONTEND_SRC / "app/demo/page.tsx").read_text(encoding="utf-8")
    assert "geosr_v2" in picker             # picker card targets the GeoSRv2 scene
    assert "GeoSRv2" in picker
    lib_api = (FRONTEND_SRC / "lib/api.ts").read_text(encoding="utf-8")
    assert "http://localhost:8000" in lib_api   # root-cause: results page reaches backend
    assert "localhost:8000" in (FRONTEND_SRC / "services/api.ts").read_text(encoding="utf-8")


def test_benchmark_is_labeled_held_out():
    src = (FRONTEND_SRC / "data/geosrV2Demo.ts").read_text(encoding="utf-8")
    assert "held-out" in src.lower()         # benchmark clearly labeled, not scene metrics
    assert "38.6028" in src
