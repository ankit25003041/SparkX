from pathlib import Path
import pytest
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from app.processing.metadata import RasterMetadata, MetadataExtractor


def test_metadata_extraction(sample_geotiff: Path):
    """Test metadata extraction from a valid GeoTIFF file."""
    meta = MetadataExtractor.extract_from_file(sample_geotiff)
    
    assert meta.width == 128
    assert meta.height == 128
    assert meta.count == 4
    assert meta.crs.to_epsg() == 32643
    assert meta.crs_string == "EPSG:32643"
    assert meta.resolution == (10.0, 10.0)
    assert meta.driver == "GTiff"
    assert len(meta.wgs84_bounds) == 4


def test_scaled_metadata_computation(sample_geotiff: Path):
    """Test scaling metadata for super-resolution output."""
    meta = MetadataExtractor.extract_from_file(sample_geotiff)
    scaled_meta = MetadataExtractor.compute_scaled_metadata(meta, scale_factor=4, target_dtype="uint16")

    assert scaled_meta.width == 512
    assert scaled_meta.height == 512
    assert scaled_meta.count == 4
    assert scaled_meta.crs == meta.crs
    assert scaled_meta.bounds == meta.bounds
    assert scaled_meta.resolution == (2.5, 2.5)
    assert scaled_meta.dtypes == ("uint16", "uint16", "uint16", "uint16")


def test_invalid_scale_factor(sample_geotiff: Path):
    """Test rejecting negative or zero scale factor."""
    meta = MetadataExtractor.extract_from_file(sample_geotiff)
    with pytest.raises(ValueError):
        MetadataExtractor.compute_scaled_metadata(meta, scale_factor=0)
