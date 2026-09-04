from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import FileResponse

from app.core.config import Settings
from app.core.logging import logger
from app.api.dependencies import get_app_settings, get_job_mgr
from app.services.job_manager import JobManager
from app.schemas.job import (
    ProcessJobRequest,
    JobStatusResponse,
    JobResultsResponse,
    JobDetailResponse,
    ValidationMetrics,
    JobStatus,
)

router = APIRouter()


@router.get(
    "/{job_id}",
    response_model=JobDetailResponse,
    summary="Get Detailed Job Info & Configuration"
)
async def get_job_detail(
    job_id: str,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Retrieves full details for a specified job ID including metadata, parameters,
    progress, timestamps, and error states.
    """
    job = job_mgr.get_job_detail(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )
    return job


@router.post(
    "/{job_id}/process",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger Super-Resolution Pipeline"
)
async def start_job_processing(
    job_id: str,
    params: ProcessJobRequest,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Initiates asynchronous Super-Resolution processing for the specified job.
    Accepts SRM model selection, scale factor (2x / 4x), tile parameters, and band combination.
    """
    job = job_mgr.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )

    if job.status == JobStatus.PROCESSING:
        return job_mgr.get_job_status(job_id)

    try:
        job_mgr.start_processing(job_id, params)
        job_status = job_mgr.get_job_status(job_id)
        if not job_status:
            raise HTTPException(status_code=500, detail="Failed to retrieve job status after start")
        return job_status
    except Exception as e:
        logger.exception(f"Error starting processing for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start processing: {str(e)}"
        )


@router.post(
    "/preset/{preset_id}/process",
    response_model=JobStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create & Execute Preset Scene Job"
)
async def process_preset_scene(
    preset_id: str,
    params: ProcessJobRequest,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Creates a new job from a sample preset scene and immediately executes the SRM pipeline.
    """
    try:
        job_record = job_mgr.create_job_for_preset(preset_id)
        job_mgr.start_processing(job_record.job_id, params)
        return job_mgr.get_job_status(job_record.job_id)
    except Exception as e:
        logger.exception(f"Error creating preset job {preset_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process preset scene: {str(e)}"
        )


@router.get(
    "/{job_id}/status",
    response_model=JobStatusResponse,
    summary="Get Job Execution Status & Progress"
)
async def get_job_status(
    job_id: str,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Polls the current status, stage description, progress percentage (0-100), and elapsed duration.
    """
    job_status = job_mgr.get_job_status(job_id)
    if not job_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )
    return job_status


@router.get(
    "/{job_id}/results",
    response_model=JobResultsResponse,
    summary="Get Super-Resolution Results & Preview URLs"
)
async def get_job_results(
    job_id: str,
    request: Request,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Retrieves the final results, preview image URLs, uncertainty map URL, download link,
    and validation metrics for a completed job.
    """
    base_url = str(request.base_url).rstrip("/")
    results = job_mgr.get_job_results(job_id, api_base_url=base_url)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )
    return results


@router.get(
    "/{job_id}/metrics",
    response_model=ValidationMetrics,
    summary="Get Radiometric & Quality Metrics"
)
async def get_job_metrics(
    job_id: str,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Returns PSNR, SSIM, SAM, ERGAS, UIQI, and spatial correlation metrics for the job.
    """
    job = job_mgr.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )

    if not job.metrics:
        # If job has not yet completed or run, return baseline estimates
        scale = job.params.scale_factor if job.params else 4
        return ValidationMetrics(
            psnr=35.40,
            ssim=0.934,
            sam=2.08,
            ergas=1.72,
            uiqi=0.954,
            spatial_correlation=0.971,
            inference_time_ms=410,
            pixel_count_original=(job.metadata.width * job.metadata.height) if job.metadata else 262144,
            pixel_count_super_resolved=((job.metadata.width * scale) * (job.metadata.height * scale)) if job.metadata else 4194304,
            is_demo=True,
        )

    return job.metrics


@router.get(
    "/{job_id}/download",
    summary="Download Super-Resolved Output GeoTIFF"
)
async def download_job_output(
    job_id: str,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Streams the super-resolved output GeoTIFF file with preserved geospatial geotransform tags.
    """
    job = job_mgr.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )

    if not job.output_geotiff_path or not job.output_geotiff_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Super-resolved output file has not been generated or is not ready yet."
        )

    return FileResponse(
        path=str(job.output_geotiff_path),
        filename=job.output_geotiff_path.name,
        media_type="image/tiff"
    )


@router.get(
    "/{job_id}/preview/{preview_type}",
    summary="Get Generated Preview Visualization PNG"
)
async def get_preview_image(
    job_id: str,
    preview_type: str,
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Serves generated lightweight PNG thumbnails: 'low_res', 'super_res', or 'uncertainty'.
    """
    job = job_mgr.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found"
        )

    preview_path: Optional[Path] = None
    if preview_type == "low_res":
        preview_path = job.preview_low_res_path
    elif preview_type == "super_res":
        preview_path = job.preview_super_res_path
    elif preview_type == "uncertainty":
        preview_path = job.preview_uncertainty_path
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid preview type '{preview_type}'. Choose 'low_res', 'super_res', or 'uncertainty'."
        )

    if not preview_path or not preview_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preview '{preview_type}' has not been rendered yet."
        )

    return FileResponse(
        path=str(preview_path),
        media_type="image/png"
    )
