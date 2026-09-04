import asyncio
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, List, Any

from app.core.config import settings
from app.core.logging import logger
from app.schemas.job import (
    JobStatus,
    ProcessJobRequest,
    JobStatusResponse,
    JobResultsResponse,
    JobDetailResponse,
    ValidationMetrics,
    SpectralPoint,
)
from app.schemas.upload import GeoTIFFMetadataResponse
from app.processing.pipeline import SuperResolutionPipeline
from app.utils.geo_utils import create_synthetic_geotiff, validate_and_extract_metadata


class JobRecord:
    def __init__(
        self,
        job_id: str,
        filename: str,
        input_file_path: Path,
        metadata: Optional[GeoTIFFMetadataResponse] = None
    ):
        self.job_id = job_id
        self.filename = filename
        self.input_file_path = input_file_path
        self.metadata = metadata
        self.status = JobStatus.QUEUED
        self.progress = 0
        self.stage = "File uploaded & validated. Ready for SRM execution."
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None
        self.params: Optional[ProcessJobRequest] = None
        self.metrics: Optional[ValidationMetrics] = None
        self.spectral_points: Optional[List[SpectralPoint]] = None
        self.output_geotiff_path: Optional[Path] = None
        self.preview_low_res_path: Optional[Path] = None
        self.preview_super_res_path: Optional[Path] = None
        self.preview_uncertainty_path: Optional[Path] = None
        self.error_message: Optional[str] = None
        self.start_time: Optional[float] = None
        self.elapsed_seconds: float = 0.0


class JobManager:
    """
    Local in-memory, thread-safe asynchronous job system.
    Runs processing tasks in background threadpool.
    """
    def __init__(self):
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=4)

    def generate_job_id(self) -> str:
        return f"job_{uuid.uuid4().hex[:12]}"

    def create_job_from_upload(
        self,
        filename: str,
        input_file_path: Path,
        metadata: Optional[GeoTIFFMetadataResponse] = None
    ) -> JobRecord:
        job_id = self.generate_job_id()
        if metadata:
            metadata.job_id = job_id

        record = JobRecord(
            job_id=job_id,
            filename=filename,
            input_file_path=input_file_path,
            metadata=metadata
        )

        with self._lock:
            self._jobs[job_id] = record

        logger.info(f"Created job {job_id} for file '{filename}'")
        return record

    def create_job_for_preset(self, preset_id: str) -> JobRecord:
        job_id = self.generate_job_id()
        preset_dir = settings.temporary_path / "presets"
        preset_dir.mkdir(parents=True, exist_ok=True)
        synthetic_path = preset_dir / f"{preset_id}.tif"

        if not synthetic_path.exists():
            create_synthetic_geotiff(synthetic_path, width=256, height=256, num_bands=4)

        metadata = validate_and_extract_metadata(
            synthetic_path,
            filename=f"{preset_id}.tif",
            job_id=job_id,
            filesize_bytes=synthetic_path.stat().st_size
        )

        record = JobRecord(
            job_id=job_id,
            filename=f"{preset_id}.tif",
            input_file_path=synthetic_path,
            metadata=metadata
        )

        with self._lock:
            self._jobs[job_id] = record

        logger.info(f"Created preset job {job_id} for preset '{preset_id}'")
        return record

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self) -> List[JobRecord]:
        with self._lock:
            return list(self._jobs.values())

    def get_job_status(self, job_id: str) -> Optional[JobStatusResponse]:
        record = self.get_job(job_id)
        if not record:
            return None

        # Calculate current elapsed seconds if still processing
        elapsed = record.elapsed_seconds
        if record.status == JobStatus.PROCESSING and record.start_time:
            elapsed = round(time.time() - record.start_time, 2)

        return JobStatusResponse(
            job_id=record.job_id,
            status=record.status,
            progress=record.progress,
            stage=record.stage,
            elapsed_seconds=elapsed,
            error_message=record.error_message,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    def get_job_results(self, job_id: str, api_base_url: str = "") -> Optional[JobResultsResponse]:
        record = self.get_job(job_id)
        if not record:
            return None

        prefix = f"{api_base_url}{settings.API_PREFIX}/jobs/{job_id}"
        
        low_res_url = f"{prefix}/preview/low_res" if record.preview_low_res_path and record.preview_low_res_path.exists() else None
        super_res_url = f"{prefix}/preview/super_res" if record.preview_super_res_path and record.preview_super_res_path.exists() else None
        uncertainty_url = f"{prefix}/preview/uncertainty" if record.preview_uncertainty_path and record.preview_uncertainty_path.exists() else None
        download_url = f"{prefix}/download" if record.output_geotiff_path and record.output_geotiff_path.exists() else None

        return JobResultsResponse(
            job_id=record.job_id,
            status=record.status,
            metadata=record.metadata,
            params=record.params,
            metrics=record.metrics,
            spectral_points=record.spectral_points,
            low_res_preview_url=low_res_url,
            super_res_preview_url=super_res_url,
            uncertainty_map_url=uncertainty_url,
            download_url=download_url,
            is_demo=True,
            message="Super-resolution processing finished." if record.status == JobStatus.COMPLETED else record.stage
        )

    def get_job_detail(self, job_id: str) -> Optional[JobDetailResponse]:
        record = self.get_job(job_id)
        if not record:
            return None

        elapsed = record.elapsed_seconds
        if record.status == JobStatus.PROCESSING and record.start_time:
            elapsed = round(time.time() - record.start_time, 2)

        return JobDetailResponse(
            job_id=record.job_id,
            status=record.status,
            filename=record.filename,
            metadata=record.metadata,
            params=record.params,
            progress=record.progress,
            stage=record.stage,
            elapsed_seconds=elapsed,
            metrics=record.metrics,
            created_at=record.created_at,
            updated_at=record.updated_at,
            completed_at=record.completed_at,
            error_message=record.error_message,
            output_geotiff_path=str(record.output_geotiff_path) if record.output_geotiff_path else None,
            is_demo=True,
        )

    def cancel_job(self, job_id: str) -> bool:
        record = self.get_job(job_id)
        if not record:
            return False

        with self._lock:
            if record.status in [JobStatus.QUEUED, JobStatus.PROCESSING]:
                record.status = JobStatus.CANCELLED
                record.stage = "Job was cancelled by user."
                record.updated_at = datetime.now(timezone.utc)
                return True
        return False

    def start_processing(self, job_id: str, params: ProcessJobRequest):
        record = self.get_job(job_id)
        if not record:
            raise ValueError(f"Job '{job_id}' not found")

        with self._lock:
            record.status = JobStatus.PROCESSING
            record.params = params
            record.progress = 5
            record.stage = "Initializing SRM inference pipeline..."
            record.start_time = time.time()
            record.updated_at = datetime.now(timezone.utc)

        # Submit to background thread executor
        self._executor.submit(self._run_pipeline_worker, job_id, params)

    def _run_pipeline_worker(self, job_id: str, params: ProcessJobRequest):
        record = self.get_job(job_id)
        if not record:
            return

        try:
            output_dir = settings.outputs_path / job_id
            output_dir.mkdir(parents=True, exist_ok=True)

            def progress_callback(pct: int, stage_desc: str):
                with self._lock:
                    if record.status == JobStatus.CANCELLED:
                        return
                    record.progress = pct
                    record.stage = stage_desc
                    record.updated_at = datetime.now(timezone.utc)
                    if record.start_time:
                        record.elapsed_seconds = round(time.time() - record.start_time, 2)

            pipeline = SuperResolutionPipeline(
                input_raster_path=record.input_file_path,
                output_dir=output_dir
            )

            results = pipeline.execute(params=params, progress_cb=progress_callback)

            with self._lock:
                if record.status != JobStatus.CANCELLED:
                    record.status = JobStatus.COMPLETED
                    record.progress = 100
                    record.stage = "Super-Resolution completed successfully."
                    record.completed_at = datetime.now(timezone.utc)
                    record.updated_at = datetime.now(timezone.utc)
                    if record.start_time:
                        record.elapsed_seconds = round(time.time() - record.start_time, 2)
                    record.output_geotiff_path = results["output_geotiff"]
                    record.preview_low_res_path = results["preview_low_res"]
                    record.preview_super_res_path = results["preview_super_res"]
                    record.preview_uncertainty_path = results["preview_uncertainty"]
                    record.metrics = results["metrics"]
                    record.spectral_points = results["spectral_points"]

            logger.info(f"Job {job_id} successfully completed in {record.elapsed_seconds}s")

        except Exception as e:
            logger.exception(f"Job {job_id} failed during execution: {e}")
            with self._lock:
                record.status = JobStatus.FAILED
                record.progress = 0
                record.error_message = str(e)
                record.stage = f"Pipeline execution failed: {str(e)}"
                record.updated_at = datetime.now(timezone.utc)


# Singleton instance
_job_manager_instance = JobManager()


def get_job_manager() -> JobManager:
    return _job_manager_instance
