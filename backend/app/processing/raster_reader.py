from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple, Union, Dict
import numpy as np
import rasterio
from rasterio.windows import Window

from app.core.logging import logger
from app.processing.metadata import RasterMetadata, MetadataExtractor


# Sentinel-2 10m Bands standard naming
S2_10M_BANDS = ["B02", "B03", "B04", "B08"]
S2_10M_NAMES = ["Blue (490nm)", "Green (560nm)", "Red (665nm)", "NIR (842nm)"]


@dataclass
class RasterData:
    data: np.ndarray  # Shape: [C, H, W]
    metadata: RasterMetadata
    band_names: List[str]
    nodata_mask: np.ndarray  # Shape: [H, W], True where pixel is NoData/invalid


class RasterReader:
    """
    Reads Sentinel-2 GeoTIFF files with support for band selection,
    windowing, and NoData extraction.
    """

    @staticmethod
    def identify_10m_band_indices(
        count: int,
        descriptions: Optional[List[Optional[str]]] = None
    ) -> List[int]:
        """
        Determines 1-based band indices corresponding to Sentinel-2 10m bands [B02, B03, B04, B08].
        """
        # If band descriptions contain Sentinel-2 identifiers (e.g. B02, B03, B04, B08)
        if descriptions and len(descriptions) >= 4:
            desc_upper = [str(d).upper() for d in descriptions if d]
            matched_indices = []
            for target in S2_10M_BANDS:
                for idx, desc in enumerate(desc_upper):
                    if target in desc:
                        matched_indices.append(idx + 1)
                        break
            if len(matched_indices) == 4:
                return matched_indices

        # Standard 12-band Sentinel-2 L2A layout:
        # B01(1), B02(2), B03(3), B04(4), B05(5), B06(6), B07(7), B08(8), B8A(9), B09(10), B11(11), B12(12)
        if count >= 12:
            return [2, 3, 4, 8]

        # 10-band layout (e.g., without coastal B01/water vapour B09):
        # B02(1), B03(2), B04(3), B05(4), B06(5), B07(6), B08(7), B8A(8), B11(9), B12(10)
        if count == 10:
            return [1, 2, 3, 7]

        # 4-band multispectral layout: assumed [B02, B03, B04, B08] (or B, G, R, NIR)
        if count == 4:
            return [1, 2, 3, 4]

        # 3-band RGB layout: duplicate 3rd band for 4-channel placeholder or use [1, 2, 3, 3]
        if count == 3:
            return [1, 2, 3, 3]

        # 1-band single grayscale: duplicate to 4 channels
        if count == 1:
            return [1, 1, 1, 1]

        # Fallback: take first 4 bands (or repeat available)
        return [min(i + 1, count) for i in range(4)]

    @classmethod
    def read_raster(
        cls,
        file_path: Union[str, Path],
        band_indices: Optional[List[int]] = None,
        window: Optional[Window] = None
    ) -> RasterData:
        """
        Reads GeoTIFF data and extracts the 4-channel Sentinel-2 10m representation [B02, B03, B04, B08].
        Returns array shaped [4, H, W] and boolean NoData mask.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Raster file not found: {path}")

        with rasterio.open(path) as src:
            metadata = MetadataExtractor.extract_from_dataset(src)
            
            # If window is given, update metadata dimensions
            if window is not None:
                metadata.width = int(window.width)
                metadata.height = int(window.height)
                metadata.transform = rasterio.windows.transform(window, src.transform)

            if band_indices is None:
                band_indices = cls.identify_10m_band_indices(src.count, src.descriptions)

            # Read selected bands (shape: [C, H, W])
            data = src.read(band_indices, window=window).astype(np.float32)

            # Identify NoData mask
            nodata_val = src.nodata
            if nodata_val is not None and not np.isnan(nodata_val):
                # Any channel matching nodata
                nodata_mask = np.any(data == nodata_val, axis=0)
            else:
                # Check for NaN / Inf
                nodata_mask = np.any(~np.isfinite(data), axis=0)

            # Band names
            band_names = S2_10M_BANDS if len(band_indices) == 4 else [f"Band_{i}" for i in band_indices]

            return RasterData(
                data=data,
                metadata=metadata,
                band_names=band_names,
                nodata_mask=nodata_mask
            )
