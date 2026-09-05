from pathlib import Path
import pytest
from fastapi.testclient import TestClient


def test_upload_invalid_extension(client: TestClient, txt_file: Path):
    """Test rejecting upload with disallowed file extension."""
    with open(txt_file, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("document.txt", f, "text/plain")}
        )
    assert response.status_code == 400
    assert "Unsupported file extension" in response.json()["detail"]


def test_upload_corrupt_tiff(client: TestClient, invalid_tiff_file: Path):
    """Test rejecting corrupted or invalid TIFF headers."""
    with open(invalid_tiff_file, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("corrupted.tif", f, "image/tiff")}
        )
    assert response.status_code == 422
    assert "GeoTIFF Validation Error" in response.json()["detail"]


def test_upload_valid_geotiff(client: TestClient, sample_geotiff: Path):
    """Test uploading a valid GeoTIFF and extracting accurate metadata."""
    with open(sample_geotiff, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("sample_sentinel2.tif", f, "image/tiff")}
        )

    assert response.status_code == 201
    data = response.json()

    assert "job_id" in data
    assert data["job_id"].startswith("job_")
    assert data["filename"] == "sample_sentinel2.tif"
    assert data["width"] == 128
    assert data["height"] == 128
    assert data["bands"] == 4
    assert "EPSG:32643" in data["crs"]
    assert data["resolution"] == 10.0
    assert data["dtype"] == "uint16"
    assert len(data["bounds"]) == 4
    assert len(data["center"]) == 2
    assert len(data["transform"]) == 6
    assert data["filesize_bytes"] > 0
    assert len(data["bands_available"]) == 4


def test_upload_sanitizes_path_traversal_filename(client: TestClient, sample_geotiff: Path):
    """A filename containing path-traversal components must be reduced to its
    basename before being written to disk or recorded as metadata (Phase 8
    security hardening)."""
    with open(sample_geotiff, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("../../etc/evil_payload.tif", f, "image/tiff")},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "evil_payload.tif"
    assert "/" not in data["filename"]
    assert ".." not in data["filename"]
