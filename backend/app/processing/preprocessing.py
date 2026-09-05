from dataclasses import dataclass
from typing import Optional, Tuple
import numpy as np

from app.core.logging import logger
from app.processing.raster_reader import RasterData


@dataclass
class PreprocessedData:
    tensor: np.ndarray  # Shape: [4, H, W], dtype float32
    nodata_mask: np.ndarray  # Shape: [H, W], boolean
    cloud_mask: Optional[np.ndarray] = None  # Shape: [H, W], boolean
    stats: Optional[dict] = None


class Sentinel2Preprocessor:
    """
    Cleans, validates, and prepares Sentinel-2 10m bands [B02, B03, B04, B08]
    for downstream normalization and deep learning tiling.
    """

    def __init__(
        self,
        clip_negative: bool = True,
        max_reflectance_dn: float = 14000.0,
        impute_nodata: bool = True,
    ):
        self.clip_negative = clip_negative
        self.max_reflectance_dn = max_reflectance_dn
        self.impute_nodata = impute_nodata

    def process(self, raster_data: RasterData) -> PreprocessedData:
        """
        Executes preprocessing steps on raw 4-channel Sentinel-2 data.
        Returns cleaned float32 array and valid data mask.
        """
        raw = raster_data.data.copy().astype(np.float32)
        nodata_mask = raster_data.nodata_mask.copy()

        c, h, w = raw.shape
        if c != 4:
            raise ValueError(f"Expected 4 channels [B02, B03, B04, B08], got {c} channels")

        # 1. Update nodata mask for any NaN/Inf
        nan_mask = np.any(~np.isfinite(raw), axis=0)
        combined_nodata = nodata_mask | nan_mask

        # 2. Impute NoData pixels with valid channel medians or zeros for model stability
        if self.impute_nodata and np.any(combined_nodata):
            for ch in range(c):
                channel_data = raw[ch]
                valid_pixels = channel_data[~combined_nodata]
                fill_val = float(np.median(valid_pixels)) if len(valid_pixels) > 0 else 0.0
                channel_data[combined_nodata] = fill_val
                raw[ch] = channel_data

        # 3. Handle negative reflectance artifacts and extreme specular reflections
        if self.clip_negative:
            raw = np.maximum(raw, 0.0)

        if self.max_reflectance_dn:
            raw = np.minimum(raw, self.max_reflectance_dn)

        # 4. Compute basic band statistics
        stats = {
            f"band_{i}_mean": float(np.mean(raw[i])) for i in range(c)
        }
        stats["nodata_pixel_count"] = int(np.sum(combined_nodata))

        return PreprocessedData(
            tensor=raw,
            nodata_mask=combined_nodata,
            stats=stats
        )
