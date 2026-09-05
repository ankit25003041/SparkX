#!/usr/bin/env python3
"""
GeoSR Phase 5 — inference: LR GeoTIFF -> super-resolved GeoTIFF.

Interface contract (matches the backend processing pipeline / GeoTIFFWriter):
  * reads a 4-band Sentinel-2 LR GeoTIFF [B02,B03,B04,B08] in DN uint16 (0-10000).
  * normalizes to BOA reflectance (DN / 10000 -> [0, 1.5]).
  * runs the trained BaselineSR model (whole-image, or tiled sliding-window for
    large scenes with Hann-window blending).
  * denormalizes back to uint16 DN and writes a GeoTIFF with:
      - same CRS
      - affine transform scaled by 1/scale_factor (resolution = gsd/scale)
      - same bounds origin
      - 4 output bands, band descriptions, LZW compression, tiled blocks.

The SR operator is scale-agnostic (it learns the r× spatial upsampling); when
applied to a 10 m input at --scale 4 the output is a 2.5 m GeoTIFF, realising
the project's 10 m -> 2.5 m target. Trained on synthetic 40 m->10 m pairs, so
absolute-resolution behaviour outside the trained scale is an *extrapolation*
(see DATASET.md limitations).

Usage:
    python model/inference.py \
        --input data/sample_sentinel2_10m.tif \
        --checkpoint model/checkpoints/baseline_run/best.pth \
        --output model/outputs/sr_out.tif \
        --scale 4
        # optional: compare to a known HR reference
        --reference data/sample_sentinel2_10m.tif \
        --metrics model/outputs/metrics.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
import torch
from rasterio.crs import CRS
from rasterio.transform import Affine

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from model.architectures import build_baseline, build_advanced
from model.datasets import SatelliteSRDataset, DatasetConfig, DegradationConfig
from model.evaluation.metrics import compute_all_metrics

BAND_NAMES = ["B02 (Blue)", "B03 (Green)", "B04 (Red)", "B08 (NIR)"]
REFLECTANCE_SCALE = 10000.0
CLIP_RANGE = (0.0, 1.5)
DEFAULT_TILE = 512


def _read_geotiff(path: Path):
    with rasterio.open(path) as src:
        count = src.count
        if count < 4:
            raise ValueError(f"Input must have >=4 bands, got {count}")
        # select first 4 bands (B02,B03,B04,B08) — matches backend RasterReader
        indices = [1, 2, 3, 4] if count >= 4 else [min(i+1, count) for i in range(4)]
        data = src.read(indices).astype(np.float32)  # [C, H, W] DN
        crs = src.crs
        transform = src.transform
        gsd = float(abs(transform.a))
        nodata = src.nodata
        descriptions = src.descriptions
    return data, crs, transform, gsd, nodata, descriptions


def _normalize(dn: np.ndarray) -> np.ndarray:
    refl = np.clip(dn / REFLECTANCE_SCALE, CLIP_RANGE[0], CLIP_RANGE[1]).astype(np.float32)
    return refl


def _denormalize(refl: np.ndarray) -> np.ndarray:
    dn = np.clip(refl, 0.0, CLIP_RANGE[1]) * REFLECTANCE_SCALE
    dn = np.clip(dn, 0, 65535).round().astype(np.uint16)
    dn[dn <= 0] = 0  # nodata
    return dn


def _hann2d(h: int, w: int) -> np.ndarray:
    wy = np.hanning(h); wx = np.hanning(w)
    return np.outer(wy, wx).astype(np.float32)


def _infer_tiled(model, lr: torch.Tensor, scale: int, tile_size: int = DEFAULT_TILE,
                 overlap: int = None, device: torch.device = torch.device("cpu")) -> np.ndarray:
    """Sliding-window inference with Hann-window blending (mirrors backend TileReconstructor).

    lr: [1, C, H, W] tensor on CPU.
    Returns: [C, H*scale, W*scale] numpy.
    """
    if overlap is None:
        overlap = max(tile_size // 4, 8)
        # keep overlap divisible-ish by scale to preserve alignment
        overlap = max(1, (overlap // scale) * scale)

    c, h, w = lr.shape[1], lr.shape[2], lr.shape[3]
    out_h, out_w = h * scale, w * scale
    out = np.zeros((c, out_h, out_w), dtype=np.float32)
    wsum = np.zeros((1, out_h, out_w), dtype=np.float32)

    stride = max(1, tile_size - overlap)
    ys = list(range(0, max(1, h - tile_size + 1), stride))
    if not ys or ys[-1] + tile_size < h:
        ys.append(max(0, h - tile_size))
    xs = list(range(0, max(1, w - tile_size + 1), stride))
    if not xs or xs[-1] + tile_size < w:
        xs.append(max(0, w - tile_size))

    weight = _hann2d(tile_size * scale, tile_size * scale) if (tile_size * scale) > 1 else np.ones((tile_size*scale, tile_size*scale), np.float32)

    with torch.no_grad():
        for y in ys:
            for x in xs:
                y_end = min(y + tile_size, h)
                x_end = min(x + tile_size, w)
                tile = lr[:, :, y:y_end, x:x_end]
                # reflect-pad to tile_size so borders are handled
                pad_y = tile_size - (y_end - y)
                pad_x = tile_size - (x_end - x)
                if pad_y or pad_x:
                    tile = torch.nn.functional.pad(tile, (0, pad_x, 0, pad_y), mode="reflect")
                tile = tile.to(device)
                with torch.amp.autocast("cuda", enabled=torch.cuda.is_available()):
                    out_tile = model(tile).float().cpu().numpy()[0]  # [C, ts*s, ts*s]
                oy = y * scale; ox = x * scale
                th = out_tile.shape[1]; tw = out_tile.shape[2]
                wgt = weight[:th, :tw]
                out[:, oy:oy+th, ox:ox+tw] += out_tile * wgt
                wsum[:, oy:oy+th, ox:ox+tw] += wgt

    safe = np.where(wsum <= 0, 1.0, wsum)
    return out / safe


def run_inference(args: argparse.Namespace) -> dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tiff_path = Path(args.input)
    if not tiff_path.exists():
        raise FileNotFoundError(f"Input TIFF not found: {tiff_path}")

    dn, crs, transform, gsd, nodata, descriptions = _read_geotiff(tiff_path)
    c, h, w = dn.shape
    refl = _normalize(dn)
    print(f"[infer] input: {tiff_path.name} bands={c} {h}x{w} gsd={gsd}m crs={crs}")

    # model
    scale = args.scale
    ckpt = None
    model_name = "advanced"
    if args.checkpoint:
        ckpt = torch.load(args.checkpoint, map_location=device, weights_only=False)
        ch_cfg = ckpt.get("config", {})
        model_name = ch_cfg.get("model_name", model_name)
        print(f"[infer] checkpoint config: model={model_name} loss={ch_cfg.get('loss')}")
    ch_cfg = ckpt.get("config", {}) if ckpt else {}
    base_ch = ch_cfg.get("base_channels", 32)
    if model_name == "advanced":
        model = build_advanced(
            num_channels=c, base_channels=base_ch,
            num_groups=ch_cfg.get("num_groups", 2),
            blocks_per_group=ch_cfg.get("blocks_per_group", 2),
            reduction=ch_cfg.get("reduction", 4),
            scale_factor=scale,
        ).to(device)
    else:
        nr = ch_cfg.get("num_resblocks", 4)
        model = build_baseline(num_channels=c, base_channels=base_ch, num_resblocks=nr,
                               scale_factor=scale,
                               use_global_residual=ch_cfg.get("use_global_residual", True)).to(device)
    if ckpt and "model_state_dict" in ckpt:
        model.load_state_dict(ckpt["model_state_dict"], strict=False)
        print(f"[infer] loaded checkpoint: {args.checkpoint} (epoch={ckpt.get('epoch')})")
    else:
        print("[infer] WARNING: no checkpoint provided — using randomly initialised weights.")
    model.eval()

    lr_tensor = torch.from_numpy(np.ascontiguousarray(refl))[None, :, :, :]  # [1,C,H,W]
    if h <= DEFAULT_TILE and w <= DEFAULT_TILE:
        with torch.no_grad(), torch.amp.autocast("cuda", enabled=torch.cuda.is_available()):
            out_refl = model(lr_tensor.to(device)).float().cpu().numpy()[0]  # [C,H*s,W*s]
        print("[infer] whole-image inference")
    else:
        out_refl = _infer_tiled(model, lr_tensor, scale, tile_size=args.tile_size,
                                device=device)
        print(f"[infer] tiled inference (tile={args.tile_size})")

    out_dn = _denormalize(out_refl)

    # write GeoTIFF with scaled transform (matches backend GeoTIFFWriter contract)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Scale resolution relative to the same top-left origin (works for rotated transforms too)
    new_transform = Affine(transform.a / scale, transform.b / scale, transform.c,
                           transform.d / scale, transform.e / scale, transform.f)
    out_crs = crs if crs else CRS.from_epsg(32643)
    profile = {
        "driver": "GTiff",
        "height": out_dn.shape[1],
        "width": out_dn.shape[2],
        "count": out_dn.shape[0],
        "dtype": out_dn.dtype,
        "crs": out_crs,
        "transform": new_transform,
        "compress": "lzw",
        "nodata": 0,
    }
    if out_dn.shape[2] >= args.tile_size and out_dn.shape[1] >= args.tile_size:
        profile["tiled"] = True
        profile["blockxsize"] = min(256, out_dn.shape[2])
        profile["blockysize"] = min(256, out_dn.shape[1])
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(out_dn)
        for idx, name in enumerate(BAND_NAMES[:out_dn.shape[0]], start=1):
            dst.set_band_description(idx, name)
    print(f"[infer] wrote SR GeoTIFF: {out_path} ({out_dn.shape[2]}x{out_dn.shape[1]}) "
          f"@ {args.gsd/scale:.1f}m crs={out_crs}")

    result = {
        "input": str(tiff_path),
        "output": str(out_path),
        "scale_factor": scale,
        "input_gsd_meters": args.gsd,
        "output_gsd_meters": args.gsd / scale,
        "input_shape": [h, w],
        "output_shape": [out_dn.shape[1], out_dn.shape[2]],
        "crs": str(out_crs),
        "bands": BAND_NAMES,
        "checkpoint": str(args.checkpoint) if args.checkpoint else None,
    }

    # optional HR reference metrics
    if args.reference:
        ref_path = Path(args.reference)
        if ref_path.exists():
            ref_dn, ref_crs, ref_transform, ref_gsd, _, _ = _read_geotiff(ref_path)
            # degrade reference to LR space for a fair bicubic baseline too? No — reference is HR ground truth.
            # If reference gsd == input_gsd (e.g. comparing to same scene), just measure SR vs HR.
            ref_refl = _normalize(ref_dn)
            # align reference to output size for metric computation (resize via nearest if needed)
            ref_np = ref_refl
            out_h, out_w = out_refl.shape[1], out_refl.shape[2]
            if (ref_np.shape[1], ref_np.shape[2]) != (out_h, out_w):
                # nearest crop/resize to output grid for metric reporting
                from scipy.ndimage import zoom
                zh = out_h / ref_np.shape[1]; zw = out_w / ref_np.shape[2]
                ref_np = np.stack([
                    zoom(ref_np[ch], (zh, zw), order=1, mode="nearest")[:out_h, :out_w]
                    for ch in range(ref_np.shape[0])
                ], axis=0)
                ref_np = np.clip(ref_np, 0.0, 1.5)
            m = compute_all_metrics(out_refl, ref_np)
            result["reference_metrics"] = m
            print(f"[infer] vs reference: PSNR={m['psnr']:.2f} dB  SSIM={m['ssim']:.4f}  SAM={m['sam_degrees']:.2f} deg")
            if args.metrics:
                metrics_path = Path(args.metrics)
                metrics_path.parent.mkdir(parents=True, exist_ok=True)
                with open(metrics_path, "w") as f:
                    json.dump({"input": str(tiff_path), "reference": str(ref_path),
                               "scale_factor": scale, "output_gsd_meters": args.gsd / scale,
                               "metrics": m}, f, indent=2)
                print(f"[infer] metrics -> {metrics_path}")

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, help="Input LR GeoTIFF (4-band Sentinel-2)")
    parser.add_argument("--output", default="model/outputs/sr_output.tif")
    parser.add_argument("--checkpoint", default=None, help="Path to best.pth checkpoint")
    parser.add_argument("--scale", type=int, default=4, choices=[2, 4], help="Super-resolution factor")
    parser.add_argument("--tile-size", type=int, default=DEFAULT_TILE, help="LR tile size for large-image inference")
    parser.add_argument("--reference", default=None, help="Optional HR GeoTIFF to compute metrics")
    parser.add_argument("--metrics", default=None, help="Optional path to write metrics JSON")
    args = parser.parse_args()

    # resolve input gsd from the file
    with rasterio.open(args.input) as src:
        args.gsd = float(abs(src.transform.a))

    result = run_inference(args)
    print(f"[infer] result: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    main()
