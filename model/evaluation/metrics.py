"""Evaluation metrics for multispectral super-resolution (Phase 6).

All metrics operate on [B, C, H, W] reflectance tensors and return python floats,
averaged across the batch. Designed for Sentinel-2 10 m reflectance in [0, 1.5].

Metrics
-------
  psnr          Peak Signal-to-Noise Ratio (dB) on mean MSE over all bands.
  ssim          Structured Similarity (0..1, via the SsimLoss module inverted).
  sam           Spectral Angle Mapper, mean angle in degrees (lower better).
  ergas         Relative average spectral error (ERGAS, lower better).
  l1            Mean absolute error (for quick inspection).

ERGAS follows the Wald (2002) form used in remote sensing:
    ERGAS = (100 / d) * sqrt( mean_b( (RMSE_b / mu_b)^2 ) )
with d = pixel-resolution ratio = GSD_LR / GSD_HR (= scale factor),
RMSE_b the per-band RMSE and mu_b the per-band HR mean.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict

import numpy as np
import torch
import torch.nn.functional as F

_EPS = 1e-8


def _to_float(x) -> float:
    if isinstance(x, torch.Tensor):
        return float(x.item())
    return float(x)


def psnr(pred: torch.Tensor, target: torch.Tensor, data_range: float = 1.5) -> float:
    mse = F.mse_loss(pred, target, reduction="mean")
    if mse.item() <= 0.0:
        return float("inf")
    return _to_float(10.0 * torch.log10((data_range ** 2) / mse))


def ssim(pred: torch.Tensor, target: torch.Tensor, data_range: float = 1.5) -> float:
    # SsimLoss returns (1 - SSIM); invert to recover SSIM. Imported lazily so
    # this module stays import-safe when run as a standalone script.
    from model.losses import SsimLoss
    loss_fn = SsimLoss(data_range=data_range)
    one_minus_ssim = loss_fn(pred, target).detach()
    return _to_float(1.0 - one_minus_ssim)


def sam(pred: torch.Tensor, target: torch.Tensor) -> float:
    """Mean spectral angle in **degrees** (lower better) over [B, C, ...] per
    spatial pixel. Returns a plain float."""
    b, c = pred.shape[0], pred.shape[1]
    p = pred.reshape(b, c, -1)
    t = target.reshape(b, c, -1)
    dot = (p * t).sum(dim=1)            # [B, N]
    norm_p = p.norm(p=2, dim=1) + _EPS  # [B, N]
    norm_t = t.norm(p=2, dim=1) + _EPS
    cos = (dot / (norm_p * norm_t)).clamp(-1.0, 1.0)
    angle_rad = torch.acos(cos)
    return _to_float(angle_rad.mean() * (180.0 / np.pi))


def sam_radians(pred: torch.Tensor, target: torch.Tensor) -> float:
    b, c = pred.shape[0], pred.shape[1]
    p = pred.reshape(b, c, -1)
    t = target.reshape(b, c, -1)
    dot = (p * t).sum(dim=1)
    norm_p = p.norm(p=2, dim=1) + _EPS
    norm_t = t.norm(p=2, dim=1) + _EPS
    cos = (dot / (norm_p * norm_t)).clamp(-1.0, 1.0)
    return _to_float(torch.acos(cos).mean())


def ergas(pred: torch.Tensor, target: torch.Tensor, scale_factor: float = 4.0) -> float:
    """ERGAS (Wald 2002) for the resolution ratio d = scale_factor."""
    b, c = pred.shape[0], pred.shape[1]
    p = pred.reshape(b, c, -1)
    t = target.reshape(b, c, -1)
    rmse_b = ((p - t) ** 2).mean(dim=2)              # [B, C] per-band MSE
    rmse_b = torch.sqrt(rmse_b + _EPS)              # [B, C] per-band RMSE
    mu_b = t.mean(dim=2).abs() + _EPS               # [B, C] per-band mean
    ratio = rmse_b / mu_b                          # [B, C]
    d = float(scale_factor)
    val = (100.0 / d) * torch.sqrt(ratio.pow(2).mean(dim=1))  # [B]
    return _to_float(val.mean())


def l1_metric(pred: torch.Tensor, target: torch.Tensor) -> float:
    return _to_float(F.l1_loss(pred, target, reduction="mean"))


def _as_tensor(x) -> torch.Tensor:
    if isinstance(x, torch.Tensor):
        return x.float()
    return torch.as_tensor(np.ascontiguousarray(x), dtype=torch.float32)


def compute_metrics(
    pred,
    target,
    data_range: float = 1.5,
    scale_factor: float = 4.0,
) -> Dict[str, float]:
    """Single-call metric bundle (averaged over the batch).

    Accepts torch tensors OR numpy arrays (the inference CLI passes numpy).
    Inputs are normalised to float32 torch tensors shaped [B, C, H, W]; a bare
    [C, H, W] array is promoted to a single-sample batch.
    """
    pred = _as_tensor(pred)
    target = _as_tensor(target)
    if pred.dim() == 3:      # [C, H, W] -> [1, C, H, W]
        pred = pred.unsqueeze(0)
    if target.dim() == 3:
        target = target.unsqueeze(0)
    sam_deg = sam(pred, target)
    return {
        "psnr": psnr(pred, target, data_range),
        "ssim": ssim(pred, target, data_range),
        "sam": sam_deg,                       # degrees (lower better)
        "sam_degrees": sam_deg,               # alias for the inference CLI
        "sam_rad": sam_radians(pred, target),
        "ergas": ergas(pred, target, scale_factor) if scale_factor else float("nan"),
        "l1": l1_metric(pred, target),
    }


# Backward-compatible alias used by the Phase 5 inference CLI.
compute_all_metrics = compute_metrics


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    torch.manual_seed(0)
    a = torch.rand(2, 4, 32, 32) * 1.5
    b = a + 0.05 * torch.randn_like(a)
    m = compute_metrics(a, b)
    print("metrics self-test:", {k: round(v, 4) for k, v in m.items()})
