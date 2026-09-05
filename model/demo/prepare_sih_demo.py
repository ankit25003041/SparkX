"""
Phase 9 — SIH demonstration data preparation.

Produces three small, legally-usable, **synthetic** Sentinel-2-like demo scenes
(Urban / Agricultural / Water) together with **real** super-resolution outputs and
**real** measured metrics. Nothing is simulated:

  * Each scene's LR "10 m Sentinel-2" input is produced by applying the *exact*
    training degradation operator (`model.datasets.degradation.degrade`) to a
    synthetic 2.5 m "ground-truth" reflectance scene. The 2.5 m ground truth is
    kept ONLY for metric computation (it is never claimed to be real satellite
    imagery). All scenes are clearly labelled "synthetic demonstration scene".
  * The super-resolved 2.5 m product and its confidence map are produced by the
    **trained** GeoSR-ESRGAN checkpoint
    (`model/checkpoints/advanced_geosr_baseline_run/checkpoint_best.pt`) via
    `model.inference.run_inference`.
  * PSNR / SSIM / SAM / ERGAS are computed by `model.evaluation.metrics` against
    the synthetic 2.5 m reference — i.e. real measured numbers, not fabricated.
  * Inference time is wall-clock timed around the real model forward pass.

Outputs (all real, committed artifacts — no runtime network fetches):

    data/demo/<scene>/lr_input.tif           10 m input GeoTIFF (DN uint16)
    data/demo/<scene>/sr_output.tif          2.5 m SR GeoTIFF (DN uint16)
    data/demo/<scene>/hr_reference.tif        2.5 m synthetic reference (DN uint16, metric-only)
    data/demo/<scene>/confidence.png         uint8 confidence heatmap
    data/demo/<scene>/confidence.tif         float32 confidence GeoTIFF
    data/demo/<scene>/validation_report.json unified Phase-7 report (real metrics)
    data/demo/<scene>/demo_metadata.json     real metrics + provenance + artifact list
    frontend/public/samples/sih/<scene>/lr_preview.png       RGB preview (band-limited)
    frontend/public/samples/sih/<scene>/sr_preview.png
Usage:
    python model/demo/prepare_sih_demo.py
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

import torch

_REPO = Path(__file__).resolve().parents[2]
import sys as _sys
if str(_REPO) not in _sys.path:
    _sys.path.insert(0, str(_REPO))

from model.architectures import build_advanced
from model.datasets.degradation import DegradationConfig, degrade
from model.evaluation.metrics import compute_all_metrics
from model.evaluation.uncertainty import confidence_to_uint8
from model.inference import run_inference

BAND_NAMES = ["B02 (Blue, 10m)", "B03 (Green, 10m)", "B04 (Red, 10m)", "B08 (NIR, 10m)"]
BAND_SHORT = ["B02", "B03", "B04", "B08"]
REFLECTANCE_SCALE = 10000.0
DATA_RANGE = 1.5
HR_SIZE = 256   # 2.5 m ground truth resolution
SCALE = 4
LR_SIZE = HR_SIZE // SCALE   # 64 @ 10 m
CHECKPOINT = _REPO / "model/checkpoints/advanced_geosr_baseline_run/checkpoint_best.pt"

SCENES = {
    "urban": {
        "title": "Urban Metropolitan District",
        "location": "Synthetic demonstration scene (not real satellite data)",
        "category": "Urban",
        "seed": 1024,
        "base": dict(B02=0.14, B03=0.16, B04=0.22, B08=0.46),
        "contrast": 0.35,
    },
    "agriculture": {
        "title": "Agricultural Cropping Zone",
        "location": "Synthetic demonstration scene (not real satellite data)",
        "category": "Agriculture",
        "seed": 2048,
        "base": dict(B02=0.09, B03=0.12, B04=0.08, B08=0.58),
        "contrast": 0.42,
    },
    "water": {
        "title": "Coastal / Inland Water Body",
        "location": "Synthetic demonstration scene (not real satellite data)",
        "category": "Water",
        "seed": 4096,
        "base": dict(B02=0.07, B03=0.11, B04=0.06, B08=0.05),
        "contrast": 0.28,
    },
}


def _reflectance_scene(category: str) -> np.ndarray:
    """Generate a synthetic 2.5 m reflectance scene [4, HR, HR] in [0, 1.5]."""
    cfg = SCENES[category]
    rng = np.random.default_rng(cfg["seed"])
    h = HR_SIZE
    yy, xx = np.mgrid[0:h, 0:h]
    # Spatial basis: large-scale gradients + medium texture + fine grain.
    base = (np.sin(xx * 0.06) * np.cos(yy * 0.06) + 1.0) / 2.0
    mid = (np.sin(xx * 0.18 + 1.0) + np.cos(yy * 0.18 + 0.5) + 2.0) / 4.0
    fine = (np.sin(xx * 0.45) * np.cos(yy * 0.45) + 1.0) / 2.0

    bands = []
    for short, base_val in zip(BAND_SHORT, [cfg["base"][b] for b in BAND_SHORT]):
        if category == "urban":
            # sharp grid / road network imprint
            roads = (np.sin(xx * 0.25) * np.cos(yy * 0.35) + 1.0) / 2.0
            roads = (roads > 0.5).astype(np.float32) * 0.55 + 0.04
            b = base_val + (base * 0.18 + mid * 0.22 + fine * 0.10)
            b = np.maximum(b, roads)
        elif category == "agriculture":
            fields = (np.sin(xx * 0.11) * np.cos(yy * 0.09 + 0.7) + 1.0) / 2.0
            b = base_val + (base * 0.10 + mid * 0.30 + fine * 0.18)
            b = np.where(fields > 0.55, b * 0.82, b * 1.0)
        else:  # water
            b = base_val + (base * 0.08 + mid * 0.12 + fine * 0.06)
        b = b + rng.normal(0.0, 0.006, size=b.shape).astype(np.float32)
        b = np.clip(b, 0.0, DATA_RANGE).astype(np.float32)
        bands.append(b)
    return np.stack(bands, axis=0)


def _to_uint16_dn(refl: np.ndarray) -> np.ndarray:
    return np.clip(refl, 0.0, DATA_RANGE).astype(np.float32) * REFLECTANCE_SCALE
    # round later in GeoTIFF writer


def _write_geotiff(path: Path, dn: np.ndarray, gsd: float, crs_epsg: int,
                   top_left_x: float = 500000.0, top_left_y: float = 3170000.0) -> None:
    """Write a 4-band uint16 GeoTIFF with the given GSD (meters) and CRS."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n_bands, h, w = dn.shape
    transform = Affine.translation(top_left_x, top_left_y) @ Affine.scale(gsd, -gsd)
    profile = {
        "driver": "GTiff",
        "height": h,
        "width": w,
        "count": n_bands,
        "dtype": "uint16",
        "crs": CRS.from_epsg(crs_epsg),
        "transform": transform,
        "compress": "lzw",
        "nodata": 0,
    }
    with rasterio.open(path, "w", **profile) as dst:
        for i in range(n_bands):
            dst.write(np.round(dn[i]).clip(0, 65535).astype(np.uint16), i + 1)
            dst.set_band_description(i + 1, BAND_NAMES[i])


def _rgb_preview(dn_path: Path, out_png: Path, clip_low: float = 2.0, clip_high: float = 98.0) -> None:
    """Render a 4-band DN GeoTIFF to an RGB PNG (B04=R, B03=G, B02=B stretch)."""
    from PIL import Image
    with rasterio.open(dn_path) as src:
        bands = src.read([1, 2, 3, 4])  # B02, B03, B04, B08 as DN float
    blue = bands[0].astype(np.float32)   # B02
    green = bands[1].astype(np.float32)  # B03
    red = bands[2].astype(np.float32)    # B04
    rgb = np.stack([red, green, blue], axis=-1)
    lo = np.percentile(rgb, clip_low)
    hi = np.percentile(rgb, clip_high)
    rng = max(hi - lo, 1.0)
    rgb8 = np.clip((rgb - lo) / rng, 0.0, 1.0) * 255.0
    Image.fromarray(rgb8.round().astype(np.uint8), mode="RGB").save(out_png)


def _load_checkpoint(path: Path):
    ckpt = torch.load(str(path), map_location="cpu", weights_only=False)
    cfg = ckpt.get("config", {})
    model = build_advanced(
        num_channels=4,
        base_channels=cfg.get("base_channels", 32),
        num_groups=cfg.get("num_groups", 2),
        blocks_per_group=cfg.get("blocks_per_group", 2),
        reduction=cfg.get("reduction", 4),
        scale_factor=SCALE,
    )
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.eval()
    return model


def _build_argv(scene_dir: Path, lr_tif: Path, hr_tif: Path, out_dir: Path) -> argparse.Namespace:
    return argparse.Namespace(
        input=str(lr_tif),
        output=str(out_dir / "sr_output.tif"),
        checkpoint=str(CHECKPOINT),
        scale=SCALE,
        tile_size=512,
        reference=str(hr_tif),
        metrics=None,
        report=str(out_dir / "validation_report.json"),
        uncertainty_method="self_consistency",
        ensemble_n=5,
        noise_std=0.01,
        gsd=10.0,
    )


def prepare_scene(category: str) -> dict:
    scene_dir = _REPO / "data" / "demo" / category
    scene_dir.mkdir(parents=True, exist_ok=True)
    out_dir = scene_dir

    cfg = SCENES[category]
    print(f"\n[scene] {category} ({cfg['title']})")

    # 1) Synthetic 2.5 m ground-truth reflectance (metric-only reference).
    hr_refl = _reflectance_scene(category)                 # [4, 256, 256] reflectance
    lr_refl = degrade(hr_refl, DegradationConfig(scale_factor=SCALE,
                                                gaussian_sigma=1.0, noise_std=0.004,
                                                anti_alias=True), seed=cfg["seed"])
    # 2) Write 10 m input (DN) + 2.5 m reference (DN).
    lr_tif = scene_dir / "lr_input.tif"
    hr_tif = scene_dir / "hr_reference.tif"
    _write_geotiff(lr_tif, lr_refl * REFLECTANCE_SCALE, 10.0, 32643)
    _write_geotiff(hr_tif, hr_refl * REFLECTANCE_SCALE, 2.5, 32643)

    # 3) Real inference with the trained model (timed).
    args = _build_argv(scene_dir, lr_tif, hr_tif, out_dir)
    t0 = time.perf_counter()
    result = run_inference(args)
    inference_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    print(f"[scene] inference_time_ms={inference_ms}")

    # 4) Read the real validation report + confidence summary produced by inference.
    report_path = out_dir / "validation_report.json"
    report = json.loads(report_path.read_text())
    metrics = {
        "psnr": report.get("psnr"),
        "ssim": report.get("ssim"),
        "sam": report.get("sam"),
        "ergas": report.get("ergas"),
    }
    unc = report.get("uncertainty_summary", {}) or {}
    confidence_score = unc.get("confidence_score")

    # Also compute an independent real-metric pass (redundant cross-check) against HR.
    sr_dn = None
    with rasterio.open(result["output"]) as src:
        sr_dn = src.read([1, 2, 3, 4]).astype(np.float32) / REFLECTANCE_SCALE
    ref_aligned = hr_refl
    if sr_dn.shape[1:] != ref_aligned.shape[1:]:
        from scipy.ndimage import zoom
        zh = sr_dn.shape[1] / ref_aligned.shape[1]
        zw = sr_dn.shape[2] / ref_aligned.shape[2]
        ref_aligned = np.stack([
            zoom(ref_aligned[ch], (zh, zw), order=1, mode="nearest")[
                :sr_dn.shape[1], :sr_dn.shape[2]] for ch in range(ref_aligned.shape[0])
        ], axis=0)
    ref_aligned = np.clip(ref_aligned, 0.0, DATA_RANGE).astype(np.float32)
    independent = compute_all_metrics(sr_dn, ref_aligned, data_range=DATA_RANGE,
                                     scale_factor=float(SCALE))
    print(f"[scene] independent refit: PSNR={independent['psnr']:.2f} "
          f"SSIM={independent['ssim']:.4f} SAM={independent['sam']:.2f}deg")

    # 5) RGB previews for the web UI.
    web_dir = _REPO / "frontend" / "public" / "samples" / "sih" / category
    web_dir.mkdir(parents=True, exist_ok=True)
    _rgb_preview(lr_tif, web_dir / "lr_preview.png")
    _rgb_preview(result["output"] if isinstance(result["output"], Path) else Path(result["output"]),
                 web_dir / "sr_preview.png")
    # confidence png already written by inference; copy to web dir.
    conf_png = Path(result.get("confidence_png", ""))
    if conf_png and conf_png.exists():
        import shutil
        shutil.copyfile(conf_png, web_dir / "confidence_preview.png")

    # 6) Persist demo metadata (real metrics + provenance + artifact list).
    metadata = {
        "id": category,
        "category": cfg["category"],
        "title": cfg["title"],
        "location": cfg["location"],
        "gsd_input_meters": 10.0,
        "gsd_output_meters": 2.5,
        "scale_factor": SCALE,
        "bands": BAND_SHORT,
        "band_descriptions": BAND_NAMES,
        "crs": "EPSG:32643 (WGS 84 / UTM Zone 43N)",
        "scene_note": "Synthetic Sentinel-2-like demonstration scene. Not real satellite imagery.",
        "reference_note": (
            "Ground-truth reference computed from the degradation-free synthetic HR "
            "source (2.5 m) used only to score reconstruction; the 10 m input is the "
            "degraded product of that reference via model.datasets.degradation."
        ),
        "model": "GeoSR-ESRGAN (trained, 2 epochs, geosr loss)",
        "metrics": metrics,
        "independent_metric_check": {
            "psnr": round(independent["psnr"], 3),
            "ssim": round(independent["ssim"], 4),
            "sam": round(independent["sam"], 3),
            "ergas": round(independent["ergas"], 3),
        },
        "confidence_score": confidence_score,
        "uncertainty_summary": unc,
        "inference_time_ms": inference_ms,
        "reference_available": bool(report.get("reference_available", False)),
        "artifacts": {
            "lr_input": "lr_input.tif",
            "sr_output": "sr_output.tif",
            "confidence_png": "confidence_preview.png",
            "confidence_tif": Path(result.get("confidence_map", "")).name if result.get("confidence_map") else None,
            "validation_report": "validation_report.json",
        },
        "web_previews": {
            "lr_preview": f"/samples/sih/{category}/lr_preview.png",
            "sr_preview": f"/samples/sih/{category}/sr_preview.png",
            "confidence_preview": f"/samples/sih/{category}/confidence_preview.png",
        },
    }
    (scene_dir / "demo_metadata.json").write_text(json.dumps(metadata, indent=2))
    print(f"[scene] metrics: {metrics}")
    return metadata


def write_frontend_data(scenes_meta: list) -> None:
    """Emit a typed TS module consumed by the Next.js demo pages."""
    out_path = _REPO / "frontend" / "src" / "data" / "sihDemoScenes.ts"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Escape JSON for embedding; keep numbers/strings as-native.
    payload = json.dumps(scenes_meta, indent=2)
    ts = (
        "// AUTO-GENERATED by model/demo/prepare_sih_demo.py — do not edit by hand.\n"
        "// These are REAL measured metrics from the trained GeoSR-ESRGAN checkpoint,\n"
        "// computed against a synthetic 2.5 m reference scene (see demo_metadata.json).\n"
        "export interface SihDemoMetric {\n"
        "  psnr: number | null;\n"
        "  ssim: number | null;\n"
        "  sam: number | null;\n"
        "  ergas: number | null;\n"
        "}\n"
        "export interface SihDemoScene {\n"
        "  id: string;\n"
        "  category: string;\n"
        "  title: string;\n"
        "  location: string;\n"
        "  gsd_input_meters: number;\n"
        "  gsd_output_meters: number;\n"
        "  scale_factor: number;\n"
        "  bands: string[];\n"
        "  band_descriptions: string[];\n"
        "  crs: string;\n"
        "  scene_note: string;\n"
        "  reference_note: string;\n"
        "  model: string;\n"
        "  metrics: SihDemoMetric;\n"
        "  independent_metric_check: SihDemoMetric & { psnr: number; ssim: number; sam: number; ergas: number };\n"
        "  confidence_score: number | null;\n"
        "  uncertainty_summary: Record<string, unknown>;\n"
        "  inference_time_ms: number;\n"
        "  reference_available: boolean;\n"
        "  artifacts: Record<string, string | null>;\n"
        "  web_previews: { lr_preview: string; sr_preview: string; confidence_preview: string };\n"
        "}\n"
        "export const SIH_DEMO_SCENES: SihDemoScene[] = " + payload + ";\n"
    )
    out_path.write_text(ts)
    print(f"[frontend] wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenes", nargs="*", default=list(SCENES.keys()))
    args = parser.parse_args()

    if not CHECKPOINT.exists():
        raise SystemExit(
            f"Trained checkpoint not found at {CHECKPOINT}; Phase-9 demo requires a "
            "trained model. Train first with `python model/training/train.py`."
        )
    print(f"[demo] checkpoint={CHECKPOINT}")

    scenes_meta = []
    for category in args.scenes:
        if category not in SCENES:
            raise SystemExit(f"Unknown scene '{category}'. Choose from {list(SCENES)}")
        scenes_meta.append(prepare_scene(category))

    write_frontend_data(scenes_meta)
    print("\n[demo] Phase-9 demo data prepared successfully.")


if __name__ == "__main__":
    main()
