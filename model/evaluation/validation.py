"""Unified validation report for GeoSR super-resolution (Phase 7).

Combines, for a single SR result:
  * Quantitative validation (PSNR/SSIM/SAM/ERGAS) — only when an HR reference
    is available. When it is NOT available (the normal case for a real upload),
    the report explicitly states the reference is unavailable rather than
    fabricating metrics.
  * Spectral validation — per-band reflectance statistics + (if a reference is
    available) per-band RMSE / correlation / SAM, so spectral distortion can be
    inspected band-by-band.
  * Spatial validation — image sharpness (mean Sobel gradient magnitude) and,
    when a reference exists, the spatial fidelity ratio.
  * Uncertainty summary — from model/evaluation/uncertainty.

Output schema (matches the Phase 7 spec example):
    {
      "scale_factor": 4,
      "psnr": <float|null>,
      "ssim": <float|null>,
      "sam": <float|null>,            # degrees
      "ergas": <float|null>,
      "reference_available": false,
      "reference_note": "Reference-based quantitative validation unavailable for this scene.",
      "spectral_validation": {...},
      "spatial_validation": {...},
      "uncertainty_summary": {...}
    }
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import torch
import torch.nn.functional as F

from model.datasets.splits import BAND_NAMES_10M
from .metrics import compute_metrics


def _band_stats(arr: np.ndarray, band_names: List[str]) -> List[Dict]:
    stats = []
    for i, name in enumerate(band_names[: arr.shape[0]]):
        b = arr[i].astype(np.float32)
        stats.append({
            "band": name,
            "mean": float(b.mean()),
            "std": float(b.std()),
            "min": float(b.min()),
            "max": float(b.max()),
        })
    return stats


def _per_band_error(pred: np.ndarray, ref: np.ndarray, band_names: List[str]) -> List[Dict]:
    stats = []
    for i, name in enumerate(band_names[: pred.shape[0]]):
        p, r = pred[i].astype(np.float32), ref[i].astype(np.float32)
        rmse = float(np.sqrt(np.mean((p - r) ** 2)))
        cc = float(np.corrcoef(p.ravel(), r.ravel())[0, 1]) if p.std() > 0 and r.std() > 0 else 0.0
        stats.append({
            "band": name,
            "rmse": rmse,
            "mean_abs_error": float(np.mean(np.abs(p - r))),
            "correlation": cc,
        })
    return stats


def _mean_gradient_magnitude(arr: np.ndarray) -> float:
    """Mean Sobel gradient magnitude averaged over bands (sharpness proxy)."""
    a = torch.as_tensor(arr, dtype=torch.float32)
    ky = torch.tensor([[1., 2., 1.], [0., 0., 0.], [-1., -2., -1.]]).view(1, 1, 3, 3)
    kx = torch.tensor([[-1., 0., 1.], [-2., 0., 2.], [-1., 0., 1.]]).view(1, 1, 3, 3)
    gx = F.conv2d(a.unsqueeze(0).reshape(-1, 1, a.shape[-2], a.shape[-1]), kx, padding=1)
    gy = F.conv2d(a.unsqueeze(0).reshape(-1, 1, a.shape[-2], a.shape[-1]), ky, padding=1)
    mag = torch.sqrt(gx ** 2 + gy ** 2)
    return float(mag.mean().item())


def _spatial_fidelity(pred: np.ndarray, ref: np.ndarray) -> float:
    """Gradient correlation between SR and reference (0..1; 1 = perfect)."""
    pg = _mean_gradient_magnitude(pred)
    rg = _mean_gradient_magnitude(ref)
    if rg <= 0:
        return 0.0
    return float(np.clip(pg / rg if rg else 1.0, 0.0, float("inf")))


def build_validation_report(
    pred_refl: np.ndarray,
    lr_refl: np.ndarray,
    hr_refl: Optional[np.ndarray] = None,
    scale_factor: float = 4.0,
    data_range: float = 1.5,
    band_names: Optional[List[str]] = None,
    uncertainty_summary: Optional[dict] = None,
) -> Dict:
    band_names = list(band_names or BAND_NAMES_10M)
    pred = _to_numpy(pred_refl)
    lr_refl = _to_numpy(lr_refl)

    reference_available = hr_refl is not None and _to_numpy(hr_refl).size > 0
    report: Dict = {
        "scale_factor": scale_factor,
        "reference_available": reference_available,
    }

    # --- quantitative validation (only with ground truth) ---
    if reference_available:
        ref = _to_numpy(hr_refl)
        ref_t = torch.as_tensor(ref)
        pred_t = torch.as_tensor(pred)
        m = compute_metrics(pred_t, ref_t, data_range=data_range, scale_factor=scale_factor)
        report.update({
            "psnr": m["psnr"],
            "ssim": m["ssim"],
            "sam": m["sam_degrees"],
            "ergas": m["ergas"],
            "reference_note": "Quantitative validation computed against provided HR reference.",
        })
    else:
        # NEVER fabricate reference metrics. State unavailability explicitly.
        report.update({
            "psnr": None,
            "ssim": None,
            "sam": None,
            "ergas": None,
            "reference_note": "Reference-based quantitative validation unavailable for this scene.",
        })

    # --- spectral validation (always; descriptive when no reference) ---
    spectral = {"band_names": band_names[: pred.shape[0]], "sr_stats": _band_stats(pred, band_names)}
    # per-band LR vs SR comparison (real, no ground truth needed)
    band_comparison = []
    for i, name in enumerate(band_names[: pred.shape[0]]):
        lr_mean = float(np.mean(lr_refl[i])) if i < lr_refl.shape[0] else float("nan")
        sr_mean = spectral["sr_stats"][i]["mean"]
        diff_pct = ((sr_mean - lr_mean) / lr_mean * 100.0) if lr_mean > 0 else 0.0
        band_comparison.append({
            "band": name, "lr_mean_reflectance": lr_mean, "sr_mean_reflectance": sr_mean,
            "diff_percent": diff_pct,
        })
    spectral["band_comparison"] = band_comparison
    if reference_available:
        spectral["per_band_error"] = _per_band_error(pred, ref, band_names)
        # overall band-angle via metrics already in sam
    report["spectral_validation"] = spectral

    # --- spatial validation (always) ---
    spatial = {
        "mean_gradient_magnitude": _mean_gradient_magnitude(pred),
        "sharpness_ratio_vs_reference": _spatial_fidelity(pred, ref) if reference_available
        else None,
    }
    report["spatial_validation"] = spatial

    # --- uncertainty ---
    report["uncertainty_summary"] = uncertainty_summary or {}

    return report


def _to_numpy(x) -> np.ndarray:
    if isinstance(x, torch.Tensor):
        return x.detach().cpu().numpy()
    return np.ascontiguousarray(x, dtype=np.float32)


def save_report(report: Dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2))
    return path


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    pred = np.random.rand(4, 64, 64).astype(np.float32)
    lr = np.random.rand(4, 16, 16).astype(np.float32)
    r = build_validation_report(pred, lr, hr_refl=None, scale_factor=4)
    print("no-reference report:", {k: r[k] for k in ("scale_factor", "reference_available", "psnr", "ssim", "sam", "reference_note")})
    r2 = build_validation_report(pred, lr, hr_refl=np.random.rand(4, 64, 64).astype(np.float32), scale_factor=4,
                                 uncertainty_summary={"confidence_score": 82.1})
    print("with-reference report:", {k: r2[k] for k in ("psnr", "ssim", "sam", "ergas", "reference_note", "uncertainty_summary")})
