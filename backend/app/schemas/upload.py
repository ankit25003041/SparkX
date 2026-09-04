from typing import List, Tuple, Optional
from pydantic import BaseModel, Field


class GeoTIFFMetadataResponse(BaseModel):
    job_id: str = Field(..., description="Unique generated Job ID for this uploaded raster")
    filename: str = Field(..., description="Original filename")
    resolution: float = Field(..., description="Estimated pixel resolution/GSD in meters")
    width: int = Field(..., description="Raster width in pixels")
    height: int = Field(..., description="Raster height in pixels")
    bands: int = Field(..., description="Number of spectral bands / channels")
    crs: str = Field(..., description="Coordinate Reference System string (e.g., EPSG:32643)")
    transform: Optional[List[float]] = Field(None, description="Affine geotransform matrix elements")
    bounds: Optional[List[float]] = Field(None, description="Bounding box [minLon, minLat, maxLon, maxLat]")
    center: Optional[List[float]] = Field(None, description="Center coordinate [latitude, longitude]")
    dtype: str = Field(..., description="Raster pixel data type (e.g. uint16, float32)")
    filesize_bytes: int = Field(..., description="File size in bytes")
    
    # Optional remote sensing metadata fields for frontend visualization
    sensor: Optional[str] = Field(default="Sentinel-2 MSI Level-2A", description="Sensor description")
    acquisition_date: Optional[str] = Field(default=None, description="Acquisition timestamp")
    cloud_cover_percent: Optional[float] = Field(default=0.0, description="Estimated cloud cover percentage")
    bands_available: Optional[List[str]] = Field(default_factory=list, description="List of recognized spectral bands")
    preview_url: Optional[str] = Field(default=None, description="Low-res thumbnail preview URL")

    # CamelCase compatibility for frontend
    model_config = {"populate_by_name": True}
