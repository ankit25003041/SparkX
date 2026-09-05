import os
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from PIL import Image
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import transform_bounds

from app.core.logging import logger
from app.schemas.upload import GeoTIFFMetadataResponse


ALLOWED_EXTENSIONS = {".tif", ".tiff", ".geotiff", ".TIF", ".TIFF"}


def validate_and_extract_metadata(
    file_path: Path,
    filename: str,
    job_id: str,
    filesize_bytes: int
) -> GeoTIFFMetadataResponse:
    """
    Validates GeoTIFF integrity and extracts geospatial metadata.
    Does NOT load entire raster into memory.
    """
    # 1. Extension check
    suffix = Path(filename).suffix
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Invalid file extension '{suffix}'. Expected GeoTIFF (.tif, .tiff, .geotiff)."
        )

    # 2. Check readability via rasterio
    try:
        with rasterio.open(file_path) as src:
            width = src.width
            height = src.height
            count = src.count
            dtypes = src.dtypes
            crs = src.crs
            transform = src.transform
            bounds = src.bounds

            if width <= 0 or height <= 0:
                raise ValueError(f"Invalid raster dimensions: {width}x{height}")

            if count < 1:
                raise ValueError("Raster must have at least 1 band")

            # Format CRS string
            if crs:
                epsg = crs.to_epsg()
                if epsg:
                    crs_str = f"EPSG:{epsg}"
                else:
                    crs_str = crs.to_string()
            else:
                crs_str = "EPSG:4326 (Unspecified/Default)"

            # Estimate GSD in meters
            # Transform pixel size: a (x resolution), e (y resolution, negative)
            res_x = abs(transform.a)
            res_y = abs(transform.e)
            raw_res = (res_x + res_y) / 2.0

            # Convert to meters if geographic (degrees)
            if crs and crs.is_geographic:
                # 1 degree ~ 111,320 meters at equator
                resolution_meters = round(raw_res * 111320.0, 2)
            else:
                resolution_meters = round(raw_res, 2)

            # Fallback if 0 or extreme
            if resolution_meters <= 0.0 or resolution_meters > 100000.0:
                resolution_meters = 10.0

            # Transform bounding box to WGS84 (lat/lon)
            min_lon, min_lat, max_lon, max_lat = bounds.left, bounds.bottom, bounds.right, bounds.top
            if crs and crs.to_string() != "EPSG:4326":
                try:
                    wgs84_bounds = transform_bounds(crs, "EPSG:4326", bounds.left, bounds.bottom, bounds.right, bounds.top)
                    min_lon, min_lat, max_lon, max_lat = wgs84_bounds
                except Exception as e:
                    logger.warning(f"Failed to transform bounds to EPSG:4326: {e}")

            center_lat = round((min_lat + max_lat) / 2.0, 6)
            center_lon = round((min_lon + max_lon) / 2.0, 6)

            # Available spectral bands
            if count >= 12:
                bands_available = ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"]
            elif count >= 10:
                bands_available = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12"]
            elif count == 4:
                bands_available = ["B02 (Blue)", "B03 (Green)", "B04 (Red)", "B08 (NIR)"]
            elif count == 3:
                bands_available = ["Red", "Green", "Blue"]
            else:
                bands_available = [f"Band_{i}" for i in range(1, count + 1)]

            primary_dtype = str(dtypes[0])

            transform_list = [
                transform.a, transform.b, transform.c,
                transform.d, transform.e, transform.f
            ]

            return GeoTIFFMetadataResponse(
                job_id=job_id,
                filename=filename,
                resolution=resolution_meters,
                width=width,
                height=height,
                bands=count,
                crs=crs_str,
                transform=transform_list,
                bounds=[round(min_lon, 6), round(min_lat, 6), round(max_lon, 6), round(max_lat, 6)],
                center=[center_lat, center_lon],
                dtype=primary_dtype,
                filesize_bytes=filesize_bytes,
                sensor="Sentinel-2 MSI Level-2A",
                bands_available=bands_available,
            )

    except rasterio.errors.RasterioError as e:
        logger.error(f"Rasterio error reading {filename}: {e}")
        raise ValueError(f"Corrupt or unreadable GeoTIFF file: {str(e)}")
    except Exception as e:
        logger.error(f"Error extracting metadata from {filename}: {e}")
        raise ValueError(f"Failed to inspect GeoTIFF: {str(e)}")


def generate_preview_png(
    raster_path: Path,
    output_png_path: Path,
    band_combo: str = "RGB",
    max_dim: int = 512
) -> Path:
    """
    Generates a low-memory 8-bit PNG thumbnail visualization of the GeoTIFF.
    Uses rasterio decimation / out_shape so full raster is never loaded in RAM.
    """
    output_png_path.parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(raster_path) as src:
        width = src.width
        height = src.height
        count = src.count

        # Select band indices (1-based)
        if band_combo == "NIR_FALSE_COLOR" and count >= 4:
            # NIR (B8), Red (B4), Green (B3)
            # For standard 12-band Sentinel: B8=8, B4=4, B3=3; for 4-band: 4, 3, 2
            bands = (count if count <= 4 else 8, 3 if count <= 4 else 4, 2 if count <= 4 else 3)
        elif band_combo == "AGRICULTURE" and count >= 10:
            # SWIR1 (B11=9 or 10), NIR (B8=7 or 8), Blue (B2=1 or 2)
            bands = (min(10, count), min(8, count), min(2, count))
        else:
            # Default RGB
            if count >= 3:
                # Sentinel-2 True Color: B04 (Red=4), B03 (Green=3), B02 (Blue=2) or 1,2,3
                bands = (min(4, count), min(3, count), min(2, count)) if count >= 4 else (1, 2, 3)
            else:
                bands = (1, 1, 1)

        # Calculate decimation factor to avoid large memory usage
        scale_decimation = max(1, max(width, height) // max_dim)
        out_w = max(1, width // scale_decimation)
        out_h = max(1, height // scale_decimation)

        # Read decimated bands
        arrays = []
        for b_idx in bands:
            # Ensure band index is valid
            idx = max(1, min(b_idx, count))
            arr = src.read(
                idx,
                out_shape=(out_h, out_w),
                resampling=Resampling.bilinear
            ).astype(np.float32)

            # Robust percentile normalization (2% - 98%)
            p2, p98 = np.percentile(arr, (2, 98))
            if p98 > p2:
                arr_norm = np.clip((arr - p2) / (p98 - p2), 0.0, 1.0)
            else:
                arr_norm = np.clip(arr / (arr.max() + 1e-6), 0.0, 1.0)

            arr_uint8 = (arr_norm * 255.0).astype(np.uint8)
            arrays.append(arr_uint8)

        # Stack into HxWx3 RGB
        rgb_img = np.stack(arrays, axis=-1)
        img = Image.fromarray(rgb_img)
        img.save(output_png_path, format="PNG", optimize=True)

    return output_png_path


def generate_uncertainty_png(
    input_png_path: Path,
    output_png_path: Path
) -> Path:
    """
    Creates a simulated spatial uncertainty / variance heatmap overlay PNG
    based on high-frequency gradient edges of the preview.
    """
    output_png_path.parent.mkdir(parents=True, exist_ok=True)

    img = Image.open(input_png_path).convert("L")
    arr = np.array(img, dtype=np.float32) / 255.0

    # Calculate Sobel-like high-frequency gradients
    gy, gx = np.gradient(arr)
    grad_mag = np.sqrt(gx**2 + gy**2)
    
    # Normalize variance heatmap
    grad_norm = np.clip(grad_mag / (np.percentile(grad_mag, 95) + 1e-5), 0.0, 1.0)

    # Colorize: low variance = green/cyan, high variance = yellow/rose
    h, w = grad_norm.shape
    heatmap = np.zeros((h, w, 4), dtype=np.uint8)

    # R: higher at high variance
    heatmap[..., 0] = (np.clip(grad_norm * 2.0, 0, 1) * 240).astype(np.uint8)
    # G: high at mid variance
    heatmap[..., 1] = (np.clip(1.0 - np.abs(grad_norm - 0.5) * 2.0, 0, 1) * 200).astype(np.uint8)
    # B: high at low variance
    heatmap[..., 2] = (np.clip(1.0 - grad_norm * 1.5, 0, 1) * 220).astype(np.uint8)
    # Alpha channel
    heatmap[..., 3] = (np.clip(grad_norm * 0.7 + 0.15, 0, 0.85) * 255).astype(np.uint8)

    heat_img = Image.fromarray(heatmap, mode="RGBA")
    heat_img.save(output_png_path, format="PNG", optimize=True)
    return output_png_path


def create_synthetic_geotiff(
    output_path: Path,
    width: int = 256,
    height: int = 256,
    num_bands: int = 4,
    crs_epsg: int = 32643
) -> Path:
    """
    Helper for unit tests and local testing: generates a small valid GeoTIFF with
    multispectral bands and realistic georeferencing metadata.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Affine transform for Delhi UTM Zone 43N (10m resolution)
    transform = Affine.translation(710000.0, 3170000.0) @ Affine.scale(10.0, -10.0)
    crs = CRS.from_epsg(crs_epsg)

    # Generate synthetic multispectral reflectance bands
    x = np.linspace(0, 10, width)
    y = np.linspace(0, 10, height)
    xx, yy = np.meshgrid(x, y)

    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=num_bands,
        dtype="uint16",
        crs=crs,
        transform=transform,
        compress="lzw"
    ) as dst:
        for b in range(1, num_bands + 1):
            pattern = (np.sin(xx + b) * np.cos(yy + b) + 1.0) * 1500.0 + (b * 400.0)
            band_data = np.clip(pattern, 100, 10000).astype(np.uint16)
            dst.write(band_data, b)

    return output_path
