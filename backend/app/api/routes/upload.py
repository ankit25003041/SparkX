import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from app.core.config import Settings
from app.core.logging import logger
from app.api.dependencies import get_app_settings, get_job_mgr
from app.services.job_manager import JobManager
from app.schemas.upload import GeoTIFFMetadataResponse
from app.utils.geo_utils import validate_and_extract_metadata, ALLOWED_EXTENSIONS

router = APIRouter()


@router.post(
    "/upload",
    response_model=GeoTIFFMetadataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Validate Sentinel-2 GeoTIFF"
)
async def upload_geotiff(
    file: UploadFile = File(..., description="Sentinel-2 multispectral GeoTIFF image"),
    settings: Settings = Depends(get_app_settings),
    job_mgr: JobManager = Depends(get_job_mgr)
):
    """
    Accepts GeoTIFF file (.tif, .tiff), performs header validation, verifies raster
    readability without loading full array into RAM, extracts CRS, dimensions, resolution,
    and geotransform, and allocates a new processing Job ID.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload payload"
        )

    # 1. Extension validation
    ext = Path(file.filename).suffix
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Accepted formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Generate temporary upload folder for this file
    temp_job_id = f"job_{uuid.uuid4().hex[:12]}"
    upload_job_dir = settings.uploads_path / temp_job_id
    upload_job_dir.mkdir(parents=True, exist_ok=True)
    
    saved_file_path = upload_job_dir / file.filename

    # 2. Stream to disk and enforce max size limit
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    total_bytes = 0

    try:
        with open(saved_file_path, "wb") as f_out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Uploaded file exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_MB}MB"
                    )
                f_out.write(chunk)

        if total_bytes == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes)"
            )

        # 3. Validate raster integrity and extract geospatial metadata
        metadata = validate_and_extract_metadata(
            file_path=saved_file_path,
            filename=file.filename,
            job_id=temp_job_id,
            filesize_bytes=total_bytes
        )

        # 4. Register job in JobManager
        job_record = job_mgr.create_job_from_upload(
            filename=file.filename,
            input_file_path=saved_file_path,
            metadata=metadata
        )

        # Ensure returned metadata has final job_id
        metadata.job_id = job_record.job_id
        metadata.preview_url = f"{settings.API_PREFIX}/jobs/{job_record.job_id}/preview/low_res"

        logger.info(
            f"Successfully uploaded and verified GeoTIFF '{file.filename}' -> Job {job_record.job_id} "
            f"({metadata.width}x{metadata.height}, {metadata.bands} bands, {metadata.crs})"
        )

        return metadata

    except HTTPException:
        # Re-raise HTTP exceptions
        if saved_file_path.exists():
            saved_file_path.unlink(missing_ok=True)
        raise
    except ValueError as ve:
        logger.warning(f"Validation failure for upload '{file.filename}': {ve}")
        if saved_file_path.exists():
            saved_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"GeoTIFF Validation Error: {str(ve)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error handling upload '{file.filename}': {e}")
        if saved_file_path.exists():
            saved_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process uploaded file: {str(e)}"
        )
    finally:
        await file.close()
