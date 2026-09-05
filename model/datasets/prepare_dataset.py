#!/usr/bin/env python3
"""
GeoSR Phase 4 — dataset preparation (reproducible split generation).

Reads a Sentinel-2 10 m GeoTIFF, computes a spatial train/val/test tile grid
(no leakage between splits), and writes:

  * <outdir>/manifest.json       -> per-patch split assignment + scene metadata
  * <outdir>/dataset_metadata.json -> HR scene info (bands/crs/gsd/ranges)

The manifest is what SatelliteSRDataset consumes (via SplitManager.load) to
reconstruct the EXACT same split, so training is reproducible.

Run:
    python model/datasets/prepare_dataset.py --tiff data/sample_sentinel2_10m.tif
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio

_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT))

from model.datasets.splits import SplitConfig, SplitManager, BAND_NAMES_10M


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tiff", default="data/sample_sentinel2_10m.tif")
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--overlap", type=int, default=0)
    parser.add_argument("--ratios", type=float, nargs=3, default=[0.8, 0.1, 0.1])
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--outdir", default="data/processed/geosr_v1")
    parser.add_argument("--reflectance-scale", type=float, default=10000.0)
    args = parser.parse_args()

    tiff_path = Path(args.tiff)
    if not tiff_path.exists():
        raise FileNotFoundError(f"TIFF not found: {tiff_path}")

    with rasterio.open(tiff_path) as src:
        height, width, count = src.height, src.width, src.count
        crs = str(src.crs) if src.crs else "UNKNOWN"
        gsd = float(abs(src.transform.a or src.transform[0]))
        nodata = src.nodata
        descriptions = [str(d) if d else None for d in src.descriptions]
        band_meta = src.tags(ns='IMAGE_STRUCTURE')

        # quick reflectance stats (DN -> reflectance)
        full = src.read().astype(np.float32) if count <= 12 else src.read([1, 2, 3, 4])
    refl = np.clip(full / args.reflectance_scale, 0.0, 1.5)
    hr_value_range = [float(np.min(refl)), float(np.max(refl))]
    hr_nodata_fraction = float(np.mean(np.all(refl <= 0, axis=0))) if nodata == 0 else 0.0

    cfg = SplitConfig(
        patch_size=args.patch_size,
        overlap=args.overlap,
        scale_factor=args.scale,
        ratios=tuple(args.ratios),
        seed=args.seed,
    )
    manager = SplitManager(cfg)
    manifest = manager.build_manifest(
        scene_id=tiff_path.stem,
        source_file=str(tiff_path.resolve()),
        crs=crs,
        gsd_meters=gsd,
        bands=list(BAND_NAMES_10M),
        height=height,
        width=width,
    )
    # enrich metadata
    manifest.metadata.update({
        "band_descriptions": descriptions[:count],
        "nodata_value": nodata,
        "reflectance_scale": args.reflectance_scale,
        "hr_value_range_reflectance": hr_value_range,
        "hr_nodata_fraction": hr_nodata_fraction,
        "normalization": "Sentinel-2 L2A BOA: DN / "
                         f"{args.reflectance_scale} -> reflectance [0, 1.5]",
    })

    out_dir = Path(args.outdir)
    manifest_path = manager.save(manifest, out_dir / "manifest.json")
    meta_path = out_dir / "dataset_metadata.json"
    meta = {
        "scene_id": manifest.scene_id,
        "source_file": manifest.source_file,
        "bands": manifest.bands,
        "band_names_full": ["B02 (Blue)", "B03 (Green)", "B04 (Red)", "B08 (NIR)"],
        "crs": manifest.crs,
        "height": height,
        "width": width,
        "gsd_meters": manifest.gsd_meters,
        "lr_gsd_meters": gsd * args.scale,
        "nodata_value": nodata,
        "hr_value_range_reflectance": hr_value_range,
        "hr_nodata_fraction": hr_nodata_fraction,
        "normalization": manifest.metadata["normalization"],
        "split_config": {
            "patch_size": args.patch_size,
            "overlap": args.overlap,
            "scale_factor": args.scale,
            "ratios": list(manifest.ratios),
            "seed": args.seed,
        },
        "patch_counts": manifest.counts,
        "total_patches": sum(manifest.counts.values()),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[prepare] TIFF        : {tiff_path.resolve()}")
    print(f"[prepare] CRS / GSD  : {crs} / {gsd} m")
    print(f"[prepare] scene size : {width}x{height}  bands={count}  nodata={nodata}")
    print(f"[prepare] HR ref range: {hr_value_range[0]:.3f} .. {hr_value_range[1]:.3f} reflectance")
    print(f"[prepare] nodata frac : {hr_nodata_fraction:.4f}")
    print(f"[prepare] patch_size : {args.patch_size}  scale={args.scale}x  -> LR patch {args.patch_size//args.scale}x{args.patch_size//args.scale}")
    print(f"[prepare] train={manifest.counts['train']}  val={manifest.counts['validation']}  test={manifest.counts['test']}  total={sum(manifest.counts.values())}")
    print(f"[prepare] manifest   : {manifest_path}")
    print(f"[prepare] metadata   : {meta_path}")
    print(f"[prepare] splits are spatially disjoint (seed={args.seed}). Reproducible by reloading the manifest.")


if __name__ == "__main__":
    main()
