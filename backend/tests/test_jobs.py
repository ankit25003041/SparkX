import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient


def test_job_not_found(client: TestClient):
    """Test 404 response for non-existent job ID."""
    response = client.get("/api/jobs/job_nonexistent123")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_job_status_not_found(client: TestClient):
    """Test 404 response for non-existent job status."""
    response = client.get("/api/jobs/job_nonexistent123/status")
    assert response.status_code == 404


def test_process_job_lifecycle(client: TestClient, sample_geotiff: Path):
    """Test full job lifecycle from upload to processing and results retrieval."""
    # 1. Upload valid GeoTIFF
    with open(sample_geotiff, "rb") as f:
        upload_resp = client.post(
            "/api/upload",
            files={"file": ("test_lifecycle.tif", f, "image/tiff")}
        )
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    # 2. Get initial job status
    status_resp = client.get(f"/api/jobs/{job_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "QUEUED"

    # 3. Start processing
    process_payload = {
        "model": "geosr_esrgan",
        "scale_factor": 2,
        "band_combination": "RGB",
        "overlap_percent": 10,
        "tile_size": 64,
        "use_tiling": True
    }
    proc_resp = client.post(f"/api/jobs/{job_id}/process", json=process_payload)
    assert proc_resp.status_code == 202

    # 4. Poll until completed (timeout 15s)
    max_wait = 15
    start = time.time()
    completed = False

    while time.time() - start < max_wait:
        poll_resp = client.get(f"/api/jobs/{job_id}/status")
        assert poll_resp.status_code == 200
        curr_status = poll_resp.json()["status"]
        if curr_status == "COMPLETED":
            completed = True
            break
        elif curr_status == "FAILED":
            pytest.fail(f"Job failed unexpectedly: {poll_resp.json()}")
        time.sleep(0.5)

    assert completed, "Job did not complete within timeout window"

    # 5. Retrieve Results
    results_resp = client.get(f"/api/jobs/{job_id}/results")
    assert results_resp.status_code == 200
    results_data = results_resp.json()

    assert results_data["status"] == "COMPLETED"
    assert results_data["metrics"] is not None
    assert results_data["metrics"]["psnr"] > 30.0
    assert results_data["metrics"]["ssim"] > 0.8
    assert results_data["download_url"] is not None
    assert results_data["is_demo"] is True

    # 6. Retrieve Metrics endpoint
    metrics_resp = client.get(f"/api/jobs/{job_id}/metrics")
    assert metrics_resp.status_code == 200
    metrics_data = metrics_resp.json()
    assert "psnr" in metrics_data
    assert "ssim" in metrics_data
    assert "sam" in metrics_data

    # 7. Download output GeoTIFF
    dl_resp = client.get(f"/api/jobs/{job_id}/download")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "image/tiff"
    assert len(dl_resp.content) > 0


def test_preset_job_execution(client: TestClient):
    """Test launching super-resolution directly for a preset scene."""
    payload = {
        "model": "rcan_sat",
        "scale_factor": 2,
        "band_combination": "RGB",
        "overlap_percent": 10,
        "tile_size": 128,
        "use_tiling": True
    }
    resp = client.post("/api/jobs/preset/delhi_urban/process", json=payload)
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    assert job_id.startswith("job_")
