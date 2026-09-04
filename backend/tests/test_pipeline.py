from pathlib import Path
import pytest
import rasterio

from app.processing.pipeline import (
    process_satellite_image,
    PipelineConfig,
    BaselineDeterministicUpsampler,
    BASELINE_MODEL_LABEL,
)
from app.processing.normalization import NormalizationMethod


def test_process_satellite_image_end_to_end(sample_geotiff: Path, tmp_path: Path):
    """Test the complete Phase 3 geospatial processing pipeline."""
    out_path = tmp_path / "pipeline_output_x4.tif"
    
    config = PipelineConfig(
        patch_size=64,
        overlap=16,
        scale_factor=4,
        batch_size=2,
        normalization_method=NormalizationMethod.SENTINEL2_REFLECTANCE,
        target_dtype="uint16"
    )

    result = process_satellite_image(
        input_path=sample_geotiff,
        output_path=out_path,
        config=config
    )

    assert result.output_geotiff_path.exists()
    assert result.is_baseline is True
    assert result.model_name == BASELINE_MODEL_LABEL
    assert result.alignment_diagnostics["is_aligned"] is True
    assert result.total_patches >= 4
    assert result.elapsed_seconds > 0

    with rasterio.open(out_path) as dst:
        assert dst.width == 128 * 4
        assert dst.height == 128 * 4
        assert dst.count == 4
        assert dst.crs.to_epsg() == 32643
        assert dst.dtypes[0] == "uint16"


def test_process_satellite_image_scale_2(sample_geotiff: Path, tmp_path: Path):
    """Test pipeline with 2x scale factor."""
    out_path = tmp_path / "pipeline_output_x2.tif"

    config = PipelineConfig(
        patch_size=64,
        overlap=8,
        scale_factor=2,
        batch_size=2,
        normalization_method=NormalizationMethod.MINMAX
    )

    result = process_satellite_image(
        input_path=sample_geotiff,
        output_path=out_path,
        config=config
    )

    assert result.output_geotiff_path.exists()
    assert result.alignment_diagnostics["is_aligned"] is True

    with rasterio.open(out_path) as dst:
        assert dst.width == 128 * 2
        assert dst.height == 128 * 2
