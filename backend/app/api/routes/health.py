import platform
import sys
from datetime import datetime, timezone
import rasterio
from fastapi import APIRouter, Depends
from app.core.config import Settings
from app.api.dependencies import get_app_settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Service Health & Diagnostic Status")
async def health_check(settings: Settings = Depends(get_app_settings)):
    """
    Returns the operational status, version, and geospatial library diagnostics of the GeoSR backend.
    """
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc),
        environment="development" if settings.DEBUG else "production",
        system={
            "python_version": sys.version.split()[0],
            "os": platform.platform(),
            "rasterio_version": rasterio.__version__,
            "gdal_version": rasterio.__gdal_version__,
            "storage_dir": str(settings.storage_path),
        }
    )
