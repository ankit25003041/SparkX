from pathlib import Path
import numpy as np
import pytest
import rasterio

from app.processing.metadata import MetadataExtractor
from app.processing.geotiff_writer import GeoTIFFWriter


def test_write_and_verify_geotiff(sample_geotiff: Path, tmp_path: Path):
    """Test exporting a GeoTIFF and verifying geospatial alignment."""
    out_path = tmp_path / "super_res_out.tif"
    scale = 4

    meta_in = MetadataExtractor.extract_from_file(sample_geotiff)
    meta_out = MetadataExtractor.compute_scaled_metadata(meta_in, scale_factor=scale, target_dtype="uint16")

    # Generate synthetic upsampled data
    data = np.ones((4, meta_out.height, meta_out.width), dtype=np.uint16) * 1500

    GeoTIFFWriter.write_raster(
        output_path=out_path,
        data=data,
        metadata=meta_out,
        band_names=["B02", "B03", "B04", "B08"],
        compress="lzw"
    )

    assert out_path.exists()

    with rasterio.open(out_path) as dst:
        assert dst.width == meta_in.width * scale
        assert dst.height == meta_in.height * scale
        assert dst.count == 4
        assert dst.crs.to_epsg() == meta_in.crs.to_epsg()

    # Alignment verification
    diag = GeoTIFFWriter.verify_geospatial_alignment(
        input_raster_path=sample_geotiff,
        output_raster_path=out_path,
        scale_factor=scale
    )

    assert diag["is_aligned"] is True
    assert diag["crs_match"] is True
    assert diag["dimensions_match"] is True
    assert diag["bounds_match"] is True
    assert diag["resolution_match"] is True
