from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union, Any
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine

from app.core.logging import logger
from app.processing.metadata import RasterMetadata


class GeoTIFFWriter:
    """
    Writes multi-band super-resolved arrays to GeoTIFF files with full
    geospatial metadata preservation, tiled block storage, and compression.
    """

    @staticmethod
    def write_raster(
        output_path: Union[str, Path],
        data: np.ndarray,  # Shape: [C, H, W]
        metadata: RasterMetadata,
        band_names: Optional[List[str]] = None,
        compress: str = "lzw",
        tiled: bool = True,
        block_size: int = 256,
        nodata: Optional[float] = None
    ) -> Path:
        """
        Exports raster array to a GeoTIFF file.
        """
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)

        c, h, w = data.shape
        dtype_str = str(data.dtype)

        # Profile setup
        profile = {
            "driver": "GTiff",
            "height": h,
            "width": w,
            "count": c,
            "dtype": dtype_str,
            "crs": metadata.crs,
            "transform": metadata.transform,
            "compress": compress,
        }

        if nodata is not None:
            profile["nodata"] = nodata
        elif metadata.nodata is not None:
            profile["nodata"] = metadata.nodata

        if tiled and w >= block_size and h >= block_size:
            profile["tiled"] = True
            profile["blockxsize"] = min(block_size, w)
            profile["blockysize"] = min(block_size, h)

        with rasterio.open(out_file, "w", **profile) as dst:
            dst.write(data)
            
            # Set band descriptions
            if band_names:
                for idx, name in enumerate(band_names[:c], start=1):
                    dst.set_band_description(idx, name)
            elif metadata.descriptions:
                for idx, desc in enumerate(metadata.descriptions[:c], start=1):
                    if desc:
                        dst.set_band_description(idx, desc)

        logger.info(f"Successfully exported GeoTIFF to '{out_file}' ({w}x{h}, {c} bands, {metadata.crs_string})")
        return out_file

    @staticmethod
    def verify_geospatial_alignment(
        input_raster_path: Union[str, Path],
        output_raster_path: Union[str, Path],
        scale_factor: int,
        tolerance: float = 1e-4
    ) -> Dict[str, Any]:
        """
        Verifies that the output super-resolved GeoTIFF remains geospatially
        aligned with the input raster (matching bounds, scaled resolution, identical CRS).
        """
        in_path = Path(input_raster_path)
        out_path = Path(output_raster_path)

        with rasterio.open(in_path) as src_in, rasterio.open(out_path) as src_out:
            # 1. CRS Check
            crs_match = (src_in.crs == src_out.crs) or (
                src_in.crs and src_out.crs and src_in.crs.to_string() == src_out.crs.to_string()
            )

            # 2. Dimensions Check
            width_match = (src_out.width == src_in.width * scale_factor)
            height_match = (src_out.height == src_in.height * scale_factor)

            # 3. Bounding Box Alignment
            b_in = src_in.bounds
            b_out = src_out.bounds
            bounds_diff = (
                abs(b_in.left - b_out.left) +
                abs(b_in.bottom - b_out.bottom) +
                abs(b_in.right - b_out.right) +
                abs(b_in.top - b_out.top)
            )
            bounds_match = (bounds_diff <= tolerance * max(1.0, abs(b_in.right - b_in.left)))

            # 4. Pixel Resolution Check
            in_res_x = abs(src_in.transform.a)
            in_res_y = abs(src_in.transform.e)
            out_res_x = abs(src_out.transform.a)
            out_res_y = abs(src_out.transform.e)

            res_x_match = abs(out_res_x - (in_res_x / scale_factor)) <= tolerance
            res_y_match = abs(out_res_y - (in_res_y / scale_factor)) <= tolerance

            is_aligned = bool(crs_match and width_match and height_match and bounds_match and res_x_match and res_y_match)

            diagnostics = {
                "is_aligned": is_aligned,
                "crs_match": crs_match,
                "input_crs": src_in.crs.to_string() if src_in.crs else None,
                "output_crs": src_out.crs.to_string() if src_out.crs else None,
                "dimensions_match": width_match and height_match,
                "input_shape": (src_in.height, src_in.width),
                "output_shape": (src_out.height, src_out.width),
                "expected_output_shape": (src_in.height * scale_factor, src_in.width * scale_factor),
                "bounds_match": bounds_match,
                "bounds_difference": bounds_diff,
                "resolution_match": res_x_match and res_y_match,
                "input_resolution": (in_res_x, in_res_y),
                "output_resolution": (out_res_x, out_res_y),
                "scale_factor": scale_factor
            }

            if not is_aligned:
                logger.warning(f"Geospatial alignment check failed for {out_path.name}: {diagnostics}")

            return diagnostics
