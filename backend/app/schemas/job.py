from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.upload import GeoTIFFMetadataResponse


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class SuperResolutionModelId(str, Enum):
    GEOSR_ESRGAN = "geosr_esrgan"
    RCAN_SAT = "rcan_sat"
    SWIN_SR_GEO = "swin_sr_geo"
    BICUBIC_BASELINE = "bicubic_baseline"


class BandCombination(str, Enum):
    RGB = "RGB"
    NIR_FALSE_COLOR = "NIR_FALSE_COLOR"
    AGRICULTURE = "AGRICULTURE"
    GEOLOGY_SWIR = "GEOLOGY_SWIR"
    NDVI_HEATMAP = "NDVI_HEATMAP"


class ProcessJobRequest(BaseModel):
    model: SuperResolutionModelId = Field(
        default=SuperResolutionModelId.GEOSR_ESRGAN,
        description="Super resolution DL architecture"
    )
    scale_factor: int = Field(
        default=4,
        description="Super resolution scale multiplier (2 or 4)"
    )
    band_combination: BandCombination = Field(
        default=BandCombination.RGB,
        description="Spectral band combination for rendering"
    )
    overlap_percent: int = Field(
        default=20,
        ge=0,
        le=50,
        description="Tile overlap percentage during reconstruction"
    )
    tile_size: int = Field(
        default=256,
        ge=64,
        le=1024,
        description="Window tile size in pixels"
    )
    use_tiling: bool = Field(
        default=True,
        description="Whether to execute chunked windowed inference"
    )
    preset_id: Optional[str] = Field(
        default=None,
        description="Optional preset ID if running on sample scene"
    )


class SpectralPoint(BaseModel):
    band: str
    name: str
    wavelength_nm: int
    original_reflectance: float
    sr_reflectance: float
    diff_percent: float


class ValidationMetrics(BaseModel):
    psnr: Optional[float] = Field(None, description="Peak Signal-to-Noise Ratio (dB). Null when no HR reference is available.")
    ssim: Optional[float] = Field(None, description="Structural Similarity Index (0-1). Null when no HR reference is available.")
    sam: Optional[float] = Field(None, description="Spectral Angle Mapper (degrees, lower is better). Null when no HR reference is available.")
    ergas: Optional[float] = Field(None, description="Relative Dimensionless Global Error. Null when no HR reference is available.")
    uiqi: Optional[float] = Field(None, description="Universal Image Quality Index.")
    spatial_correlation: Optional[float] = Field(None, description="Spatial correlation coefficient.")
    inference_time_ms: int = Field(..., description="Inference execution duration in ms")
    pixel_count_original: int = Field(..., description="Input pixel count")
    pixel_count_super_resolved: int = Field(..., description="Super-resolved pixel count")
    is_demo: bool = Field(default=True, description="Indicates if metrics are simulated / baseline (Phase 2)")
    reference_available: bool = Field(default=False, description="True if an HR reference was available for quantitative validation")
    confidence_score: Optional[float] = Field(None, description="Mean self-consistency confidence (0-100) when no reference")


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100, description="Progress percentage 0-100")
    stage: str = Field(..., description="Current pipeline processing stage")
    elapsed_seconds: float = Field(default=0.0, description="Elapsed execution seconds")
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JobResultsResponse(BaseModel):
    job_id: str
    status: JobStatus
    metadata: Optional[GeoTIFFMetadataResponse] = None
    params: Optional[ProcessJobRequest] = None
    metrics: Optional[ValidationMetrics] = None
    spectral_points: Optional[List[SpectralPoint]] = None
    low_res_preview_url: Optional[str] = None
    super_res_preview_url: Optional[str] = None
    uncertainty_map_url: Optional[str] = None
    validation_report_url: Optional[str] = None
    download_url: Optional[str] = None
    is_demo: bool = Field(default=True, description="True since DL model weights not yet integrated in Phase 2")
    message: str = Field(default="Super-resolution processing finished.")


class JobDetailResponse(BaseModel):
    job_id: str
    status: JobStatus
    filename: Optional[str] = None
    metadata: Optional[GeoTIFFMetadataResponse] = None
    params: Optional[ProcessJobRequest] = None
    progress: int = 0
    stage: str = "QUEUED"
    elapsed_seconds: float = 0.0
    metrics: Optional[ValidationMetrics] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    output_geotiff_path: Optional[str] = None
    is_demo: bool = True
