from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple, Any, Dict
import rasterio
from rasterio.crs import CRS
from rasterio.coords import BoundingBox
from rasterio.transform import Affine
from rasterio.warp import transform_bounds

from app.core.logging import logger


@dataclass
class RasterMetadata:
    width: int
    height: int
    count: int
    crs: CRS
    transform: Affine
    bounds: BoundingBox
    dtypes: Tuple[str, ...]
    nodata: Optional[float] = None
    driver: str = "GTiff"
    descriptions: List[Optional[str]] = field(default_factory=list)
    scales: List[Optional[float]] = field(default_factory=list)
    offsets: List[Optional[float]] = field(default_factory=list)

    @property
    def resolution(self) -> Tuple[float, float]:
        """Returns pixel (x_res, y_res) in CRS units."""
        return (abs(self.transform.a), abs(self.transform.e))

    @property
    def crs_string(self) -> str:
        """Returns standard CRS string (e.g., EPSG:32643)."""
        if not self.crs:
            return "EPSG:4326"
        epsg = self.crs.to_epsg()
        return f"EPSG:{epsg}" if epsg else self.crs.to_string()

    @property
    def wgs84_bounds(self) -> Tuple[float, float, float, float]:
        """Returns bounds in WGS84 [minLon, minLat, maxLon, maxLat]."""
        if not self.crs or self.crs.to_string() == "EPSG:4326":
            return (self.bounds.left, self.bounds.bottom, self.bounds.right, self.bounds.top)
        try:
            return transform_bounds(
                self.crs,
                "EPSG:4326",
                self.bounds.left,
                self.bounds.bottom,
                self.bounds.right,
                self.bounds.top
            )
        except Exception as e:
            logger.warning(f"Could not convert bounds to EPSG:4326: {e}")
            return (self.bounds.left, self.bounds.bottom, self.bounds.right, self.bounds.top)


class MetadataExtractor:
    """Extracts and computes geospatial metadata for Sentinel-2 rasters."""

    @staticmethod
    def extract_from_dataset(src: rasterio.DatasetReader) -> RasterMetadata:
        """Extracts complete metadata from an open Rasterio dataset."""
        return RasterMetadata(
            width=src.width,
            height=src.height,
            count=src.count,
            crs=src.crs if src.crs else CRS.from_epsg(4326),
            transform=src.transform,
            bounds=src.bounds,
            dtypes=tuple(str(d) for d in src.dtypes),
            nodata=src.nodata,
            driver=src.driver,
            descriptions=list(src.descriptions) if src.descriptions else [],
            scales=list(src.scales) if src.scales else [],
            offsets=list(src.offsets) if src.offsets else [],
        )

    @staticmethod
    def extract_from_file(file_path: Path) -> RasterMetadata:
        """Opens a file and extracts complete metadata."""
        with rasterio.open(file_path) as src:
            return MetadataExtractor.extract_from_dataset(src)

    @staticmethod
    def compute_scaled_metadata(
        meta: RasterMetadata,
        scale_factor: int,
        out_channels: Optional[int] = None,
        target_dtype: Optional[str] = None
    ) -> RasterMetadata:
        """
        Computes metadata for the super-resolved output raster.
        Scales dimensions by `scale_factor` and divides pixel resolution by `scale_factor`.
        Geospatial CRS and Bounding Box are strictly preserved.
        """
        if scale_factor <= 0:
            raise ValueError(f"scale_factor must be positive, got {scale_factor}")

        out_width = meta.width * scale_factor
        out_height = meta.height * scale_factor
        out_count = out_channels if out_channels is not None else meta.count

        # Scale transform: pixel size is divided by scale_factor
        out_transform = meta.transform @ Affine.scale(1.0 / scale_factor, 1.0 / scale_factor)

        out_dtypes = tuple(target_dtype or meta.dtypes[0] for _ in range(out_count))

        return RasterMetadata(
            width=out_width,
            height=out_height,
            count=out_count,
            crs=meta.crs,
            transform=out_transform,
            bounds=meta.bounds,
            dtypes=out_dtypes,
            nodata=meta.nodata,
            driver=meta.driver,
            descriptions=[f"Band {i+1} (Super-Resolved x{scale_factor})" for i in range(out_count)],
            scales=meta.scales[:out_count] if meta.scales else [],
            offsets=meta.offsets[:out_count] if meta.offsets else [],
        )
