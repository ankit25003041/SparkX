import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.main import app
from app.core.config import settings
from app.utils.geo_utils import create_synthetic_geotiff


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_geotiff(tmp_path) -> Path:
    """Fixture providing a valid synthetic 4-band GeoTIFF file."""
    tiff_path = tmp_path / "sample_sentinel2.tif"
    create_synthetic_geotiff(
        output_path=tiff_path,
        width=128,
        height=128,
        num_bands=4,
        crs_epsg=32643
    )
    return tiff_path


@pytest.fixture
def invalid_tiff_file(tmp_path) -> Path:
    """Fixture providing an invalid / corrupted TIFF file."""
    bad_file = tmp_path / "corrupted.tif"
    bad_file.write_bytes(b"NOT_A_VALID_TIFF_HEADER_12345678")
    return bad_file


@pytest.fixture
def txt_file(tmp_path) -> Path:
    """Fixture providing a non-TIFF file."""
    text_file = tmp_path / "document.txt"
    text_file.write_text("This is plain text, not a raster")
    return text_file
