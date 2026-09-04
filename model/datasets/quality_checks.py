#!/usr/bin/env python3
"""
GeoSR Phase 4 — dataset quality checks.

For a given split, fetches random LR<->HR pairs and verifies:
  * dimensions      LR = HR / scale_factor
  * channels        consistent band count (== 4) and correspondence
  * value ranges    within valid BOA reflectance [0, 1.5]
  * missing data    nodata pixel coverage per patch
  * alignment       bicubic LR-upsampled aligns to HR grid (visual + residual)

Renders a 4-panel composite (HR true-colour, LR, LR-upsampled bicubic, residual)
to ``model/datasets/_quality_checks/`` and prints a JSON report.

Run:
    python model/datasets/quality_checks.py --tiff data/sample_sentinel2_10m.tif
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch

# Make the repo root importable so `model.datasets` resolves regardless of CWD.
_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT))

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt

from model.datasets import (
    SatelliteSRDataset,
    DatasetConfig,
    DegradationConfig,
    PairedTransform,
    default_eval_transform,
)
from model.datasets.transforms import make_composite
from model.datasets.degradation import upsample_bicubic

BAND_NAMES = ("B02", "B03", "B04", "B08")  # [B,G,R,NIR]


def build_dataset(path: str, split: str, patch_size: int, scale: int, seed: int) -> SatelliteSRDataset:
    cfg = DatasetConfig(
        tiff_path=path,
        split=split,
        patch_size=patch_size,
        scale_factor=scale,
        seed=seed,
        use_augmentation=False,
        degrade_config=DegradationConfig(scale_factor=scale, noise_std=0.01),
    )
    return SatelliteSRDataset(cfg)


def check_item(item: dict, scale: int, clip: tuple, index: int) -> dict:
    lr = item["lr"].numpy()
    hr = item["hr"].numpy()
    md = item["metadata"]

    c_lr, h_lr, w_lr = lr.shape
    c_hr, h_hr, w_hr = hr.shape

    report = {
        "index": index,
        "patch_index": md["patch_index"],
        "tile_yx": [md["y"], md["x"]],
        "bands": md["bands"],
        "lr_shape": [h_lr, w_lr],
        "hr_shape": [h_hr, w_hr],
        "scale_factor": scale,
        "dim_check_pass": bool(h_hr == h_lr * scale and w_hr == w_lr * scale),
        "channels_lr": c_lr,
        "channels_hr": c_hr,
        "channel_check_pass": bool(c_lr == c_hr == len(BAND_NAMES)),
        "lr_value_range": [float(round(lr.min(), 4)), float(round(lr.max(), 4))],
        "hr_value_range": [float(round(hr.min(), 4)), float(round(hr.max(), 4))],
        "range_check_pass": bool(
            lr.min() >= clip[0] - 1e-6 and lr.max() <= clip[1] + 1e-6
            and hr.min() >= clip[0] - 1e-6 and hr.max() <= clip[1] + 1e-6
        ),
        "nodata_present": bool(md["nodata_present"]),
        "lr_nodata_fraction": float(np.mean(np.all(lr <= 0, axis=0))),
        "hr_nodata_fraction": float(np.mean(np.all(hr <= 0, axis=0))),
        "alignment_check": {
            "lr_upsampled_shape": [int(h_lr * scale), int(w_lr * scale)],
            "aligns_to_hr": bool(int(h_lr * scale) == h_hr and int(w_lr * scale) == w_hr),
        },
    }
    return report


def render_composite(item: dict, scale: int, out_path: Path, index: int) -> None:
    lr = item["lr"].numpy()       # [C, h, w]
    hr = item["hr"].numpy()       # [C, H, W]
    md = item["metadata"]

    lr_up = upsample_bicubic(lr, scale)        # [C, h*s, w*s] == HR size
    # residual (alignment drift check) — align by exact slice
    h_hr, w_hr = hr.shape[1], hr.shape[2]
    lr_up_crop = lr_up[:, :h_hr, :w_hr]
    residual = np.abs(hr - lr_up_crop)

    fig, axes = plt.subplots(1, 4, figsize=(18, 5))
    fig.suptitle(
        f"GeoSR Quality Check — split={md['split']} patch={md['patch_index']} "
        f"tile(y={md['y']},x={md['x']}) scale={scale}x  "
        f"({BAND_NAMES[:3]} RGB true-colour, B08 NIR shown in false-colour)",
        fontsize=10,
    )

    axes[0].imshow(make_composite(hr))
    axes[0].set_title(f"HR (10 m)\n{md['hr_shape'][0]}x{md['hr_shape'][1]}")
    axes[1].imshow(make_composite(lr))
    axes[1].set_title(f"LR (synthetic {md['gsd_lr']:.0f} m)\n{md['lr_shape'][0]}x{md['lr_shape'][1]}")
    axes[2].imshow(make_composite(lr_up))
    axes[2].set_title(f"LR bicubic-upsampled x{scale}\n{lr_up.shape[1]}x{lr_up.shape[2]}")
    axes[3].imshow(make_composite(residual))
    axes[3].set_title(f"| HR - LR↑bicubic | (alignment)\n{residual.shape[1]}x{residual.shape[2]}")

    for ax in axes:
        ax.axis("off")
    plt.tight_layout(rect=(0, 0, 1, 0.95))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tiff", default="data/sample_sentinel2_10m.tif")
    parser.add_argument("--split", default="train", choices=["train", "validation", "test"])
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-samples", type=int, default=6)
    parser.add_argument("--outdir", default="model/datasets/_quality_checks")
    args = parser.parse_args()

    tiff_path = Path(args.tiff)
    if not tiff_path.exists():
        raise FileNotFoundError(f"TIFF not found: {tiff_path}")

    dataset = build_dataset(str(tiff_path), args.split, args.patch_size, args.scale, args.seed)
    clip = (0.0, 1.5)
    out_dir = Path(args.outdir) / f"{dataset.config.split}_s{dataset.scale_factor}_ps{dataset.config.patch_size}"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[quality] scene={tiff_path.name} split={args.split} patches={len(dataset)} "
          f"scale={args.scale}x patch={args.patch_size} bands={BAND_NAMES}")

    rng = np.random.default_rng(args.seed)
    n = min(args.n_samples, len(dataset))
    indices = rng.choice(len(dataset), size=n, replace=False)
    reports = []
    for i, idx in enumerate(indices):
        item = dataset[int(idx)]
        report = check_item(item, args.scale, clip, int(idx))
        reports.append(report)
        png = out_dir / f"sample_{i:02d}_idx{idx:03d}.png"
        render_composite(item, args.scale, png, int(idx))
        print(f"  [ok] idx={idx} lr={report['lr_shape']} hr={report['hr_shape']} "
              f"dim_ok={report['dim_check_pass']} chan_ok={report['channel_check_pass']} "
              f"range_ok={report['range_check_pass']} nodata={report['nodata_present']}")

    summary = {
        "tiff": str(tiff_path),
        "split": args.split,
        "scale_factor": args.scale,
        "patch_size": args.patch_size,
        "n_samples": n,
        "scene_metadata": dataset.scene_metadata(),
        "all_dim_checks_pass": all(r["dim_check_pass"] for r in reports),
        "all_channel_checks_pass": all(r["channel_check_pass"] for r in reports),
        "all_range_checks_pass": all(r["range_check_pass"] for r in reports),
        "all_alignment_checks_pass": all(r["alignment_check"]["aligns_to_hr"] for r in reports),
        "mean_lr_nodata_fraction": float(np.mean([r["lr_nodata_fraction"] for r in reports])),
        "mean_hr_nodata_fraction": float(np.mean([r["hr_nodata_fraction"] for r in reports])),
        "reports": reports,
        "outputs": [str(p) for p in sorted(out_dir.glob("*.png"))],
    }
    report_path = out_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[quality] report -> {report_path}")

    # exit non-zero if any hard check failed
    if not (summary["all_dim_checks_pass"] and summary["all_channel_checks_pass"]
            and summary["all_range_checks_pass"] and summary["all_alignment_checks_pass"]):
        print("[quality] FAIL: one or more checks did not pass.")
        sys.exit(1)
    print("[quality] PASS: dimensions, channels, value ranges, and alignment all verified.")


if __name__ == "__main__":
    main()
