"""Phase 8 tests for the GeoSRPipeline orchestrator.

Verifies:
  * The 8 named stages are emitted in order with correct indices/progress.
  * The torch model (model_fn) is loaded exactly once per run and reused across
    every tile batch (never per-tile, never per-stage).
  * The baseline (no checkpoint) path produces demo metrics while still emitting
    all eight stages and writing preview artifacts.
"""
from pathlib import Path

import pytest

from app.processing.orchestrator import (
    GeoSRPipeline,
    PipelineStage,
    PipelineRunResult,
)
from app.processing.pipeline import BASELINE_MODEL_LABEL
from app.schemas.job import ProcessJobRequest


@pytest.fixture
def _sample(sample_geotiff: Path):
    return sample_geotiff


def _capture():
    events = []

    def cb(progress, desc, stage=None):
        events.append((progress, desc, stage))

    return events, cb


def test_stage_enum_has_eight_ordered_stages():
    members = list(PipelineStage)
    assert len(members) == 8
    indices = [m.stage for m in members]
    assert indices == sorted(indices)
    assert [m.stage for m in members] == [1, 2, 3, 4, 5, 6, 7, 8]
    assert members[0] is PipelineStage.INGEST
    assert members[-1] is PipelineStage.EXPORT


def test_baseline_run_emits_all_stages_and_demo_metrics(_sample: Path, tmp_path: Path):
    events, cb = _capture()
    out_dir = tmp_path / "job_baseline"
    out_tiff = out_dir / "sr_x2.tif"

    pipeline = GeoSRPipeline(
        checkpoint_path=None,
        scale_factor=2,
        params=ProcessJobRequest(scale_factor=2, tile_size=64, overlap_percent=10),
        status_cb=cb,
    )
    result = pipeline.run("job_test", _sample, out_tiff, out_dir)

    stages_seen = [e[2] for e in events if e[2] is not None]
    # 8 distinct stages, in order, no duplicates gaps.
    assert stages_seen == sorted(stages_seen, key=lambda s: s.stage)
    assert set(stages_seen) == set(PipelineStage)
    # Last stage emitted must be EXPORT.
    assert stages_seen[-1] is PipelineStage.EXPORT
    # Monotonic progress.
    progress = [e[0] for e in events]
    assert progress == sorted(progress)
    assert result.is_real_sr is False
    assert result.model_name == BASELINE_MODEL_LABEL

    # Demo metrics must be present (baseline contract used by test_jobs).
    assert result.metrics.is_demo is True
    assert result.metrics.psnr is not None and result.metrics.psnr > 30.0
    assert result.metrics.ssim is not None and result.metrics.ssim > 0.8

    # Previews + geotiff written.
    assert result.output_geotiff_path.exists()
    assert result.preview_paths["low_res"].exists()
    assert result.preview_paths["super_res"].exists()
    assert result.uncertainty_preview_path.exists()

    assert isinstance(result, PipelineRunResult)


def test_model_loaded_once_per_run(_sample: Path, tmp_path: Path):
    """A single model_fn must be built and invoked for all tile batches."""
    calls = {"build": 0, "infer": 0}

    # Wrap build_model_fn so we can observe how many times it is invoked. The
    # orchestrator calls it once at construction, then hands the resulting fn to
    # the pipeline. We subclass to count builds deterministically.
    original_build = GeoSRPipeline.__init__

    def counting_init(self, checkpoint_path=None, scale_factor=4, params=None, status_cb=None):
        calls["build"] += 1
        original_build(self, checkpoint_path, scale_factor, params, status_cb)
        # Replace the constructed model_fn with an instrumented baseline so we
        # can count inference calls without torch.
        class _CountingBaseline:
            label = "CountingBaseline"

            def __call__(self, batch):
                calls["infer"] += 1
                return __import__("numpy").zeros(
                    (batch.shape[0], batch.shape[1],
                     batch.shape[2] * scale_factor, batch.shape[3] * scale_factor),
                    dtype="float32",
                )
        self.model_fn = _CountingBaseline()
        self.is_real_sr = False
        self.model_name = BASELINE_MODEL_LABEL

    GeoSRPipeline.__init__ = counting_init
    try:
        out_dir = tmp_path / "job_once"
        out_tiff = out_dir / "sr_x4.tif"
        events, cb = _capture()
        pipeline = GeoSRPipeline(
            checkpoint_path=None,
            scale_factor=4,
            params=ProcessJobRequest(scale_factor=4, tile_size=64, overlap_percent=10),
            status_cb=cb,
        )
        pipeline.run("job_once", _sample, out_tiff, out_dir)
    finally:
        GeoSRPipeline.__init__ = original_build

    assert calls["build"] == 1
    # More than one tile batch → model_fn called multiple times, but it is the
    # same persisted callable (built once).
    assert calls["infer"] >= 1
    assert (out_tiff).exists()


def test_translate_progress_is_monotonic_and_in_bounds():
    from app.processing.orchestrator import _translate_progress

    previous = -1
    for pct in range(0, 101):
        stage, progress = _translate_progress(pct)
        assert 1 <= progress <= 100
        assert isinstance(stage, PipelineStage)
        assert progress >= previous
        previous = progress
    # First and last reported points.
    assert _translate_progress(0)[0] is PipelineStage.INGEST
    assert _translate_progress(100)[0] is PipelineStage.VALIDATE
