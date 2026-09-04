from pathlib import Path
import numpy as np
import pytest
import rasterio

from app.processing.raster_reader import RasterReader, S2_10M_BANDS


def test_read_valid_raster(sample_geotiff: Path):
    """Test reading a 4-band GeoTIFF."""
    raster_data = RasterReader.read_raster(sample_geotiff)
    
    assert raster_data.data.shape == (4, 128, 128)
    assert raster_data.data.dtype == np.float32
    assert raster_data.band_names == S2_10M_BANDS
    assert raster_data.nodata_mask.shape == (128, 128)
    assert raster_data.metadata.width == 128


def test_band_index_identification():
    """Test band index mapping for various raster channel counts."""
    # 12-band Sentinel-2 L2A layout -> B02(2), B03(3), B04(4), B08(8)
    indices_12 = RasterReader.identify_10m_band_indices(12)
    assert indices_12 == [2, 3, 4, 8]

    # 10-band layout -> [1, 2, 3, 7]
    indices_10 = RasterReader.identify_10m_band_indices(10)
    assert indices_10 == [1, 2, 3, 7]

    # 4-band layout -> [1, 2, 3, 4]
    indices_4 = RasterReader.identify_10m_band_indices(4)
    assert indices_4 == [1, 2, 3, 4]

    # Custom descriptions matching B02, B03, B04, B08
    desc = ["Aerosol B01", "Blue B02", "Green B03", "Red B04", "RedEdge B05", "NIR B08"]
    indices_desc = RasterReader.identify_10m_band_indices(len(desc), desc)
    assert indices_desc == [2, 3, 4, 6]


def test_read_nonexistent_file(tmp_path: Path):
    """Test reading a missing file raises FileNotFoundError."""
    missing = tmp_path / "missing_file.tif"
    with pytest.raises(FileNotFoundError):
        RasterReader.read_raster(missing)
