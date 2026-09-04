import pytest
from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    """Test that the /api/health endpoint returns 200 and valid diagnostic payload."""
    response = client.get("/api/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data
    assert "system" in data
    assert "rasterio_version" in data["system"]
    assert "gdal_version" in data["system"]


def test_root_endpoint(client: TestClient):
    """Test root endpoint redirect/info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "docs" in data
    assert "version" in data
