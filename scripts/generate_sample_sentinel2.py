#!/usr/bin/env python3
"""
Sample data generation utility for GeoSR Sentinel-2 processing pipeline testing.
Generates synthetic 4-band 10m Sentinel-2 GeoTIFFs [B02, B03, B04, B08] in UTM Zone 43N.
"""
import argparse
from pathlib import Path
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine


def generate_synthetic_sentinel2_geotiff(
    output_path: Path,
    width: int = 512,
    height: int = 512,
    resolution_m: float = 10.0,
    crs_epsg: int = 32643,  # WGS 84 / UTM Zone 43N (Delhi / Northern India)
    top_left_x: float = 710000.0,
    top_left_y: float = 3170000.0,
) -> Path:
    """
    Creates a realistic 4-band Sentinel-2 Level-2A GeoTIFF with
    B02 (Blue), B03 (Green), B04 (Red), and B08 (NIR).
    Reflectance DN values are between 0 and 10000 (0.0 to 1.0 BOA reflectance).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Affine transform for pixel size and top-left coordinates
    transform = Affine.translation(top_left_x, top_left_y) @ Affine.scale(resolution_m, -resolution_m)
    crs = CRS.from_epsg(crs_epsg)

    # Create synthetic spatial features (vegetation patches, urban grids, water bodies)
    x = np.linspace(0, 8 * np.pi, width)
    y = np.linspace(0, 8 * np.pi, height)
    xx, yy = np.meshgrid(x, y)

    # Terrain wave patterns
    base_pattern = (np.sin(xx * 0.5) * np.cos(yy * 0.5) + 1.0) / 2.0  # 0 to 1
    edge_features = (np.sin(xx * 2.0) + np.cos(yy * 2.0) + 2.0) / 4.0

    # Realistic multispectral band reflectance characteristics:
    # 1. B02 (Blue, 490 nm): Moderate Rayleigh scattering, urban reflection (~1000 - 2000 DN)
    b02 = np.clip(1200 + base_pattern * 800 + edge_features * 400, 200, 8000).astype(np.uint16)

    # 2. B03 (Green, 560 nm): Moderate vegetation peak (~1200 - 2500 DN)
    b03 = np.clip(1400 + base_pattern * 1100 + edge_features * 500, 200, 8500).astype(np.uint16)

    # 3. B04 (Red, 665 nm): Chlorophyll absorption (~800 - 2200 DN)
    b04 = np.clip(1100 + (1.0 - base_pattern) * 1200 + edge_features * 600, 200, 8000).astype(np.uint16)

    # 4. B08 (NIR, 842 nm): High cellular canopy reflectance (~3000 - 6500 DN)
    b08 = np.clip(2800 + base_pattern * 3500 + edge_features * 800, 400, 9500).astype(np.uint16)

    bands = [b02, b03, b04, b08]
    band_names = ["B02 (Blue, 10m)", "B03 (Green, 10m)", "B04 (Red, 10m)", "B08 (NIR, 10m)"]

    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=4,
        dtype="uint16",
        crs=crs,
        transform=transform,
        compress="lzw",
        nodata=0
    ) as dst:
        for idx, (band_data, name) in enumerate(zip(bands, band_names), start=1):
            dst.write(band_data, idx)
            dst.set_band_description(idx, name)

    print(f"Generated synthetic Sentinel-2 GeoTIFF at: {output_path.resolve()}")
    print(f"Dimensions: {width}x{height}, 4 bands (B02, B03, B04, B08), CRS: EPSG:{crs_epsg}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate sample Sentinel-2 10m GeoTIFF for testing.")
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="data/sample_sentinel2_10m.tif",
        help="Output file path"
    )
    parser.add_argument("--size", "-s", type=int, default=512, help="Raster width/height")
    parser.add_argument("--epsg", type=int, default=32643, help="EPSG CRS code")
    args = parser.parse_args()

    out_path = Path(args.output)
    generate_synthetic_sentinel2_geotiff(
        output_path=out_path,
        width=args.size,
        height=args.size,
        crs_epsg=args.epsg
    )


if __name__ == "__main__":
    main()
