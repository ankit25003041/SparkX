"""Uncertainty / confidence estimation for GeoSR super-resolution (Phase 7).

Why uncertainty matters
-----------------------
A learned SR model *hallucinates* high-frequency detail that is not present in
the LR input. Presenting every reconstructed pixel as ground truth is
scientifically unsound. This module provides a **practical, model-appropriate**
uncertainty estimate for the project's deterministic CNN models.

Method
-------
1. **Self-consistency (round-trip) uncertainty** — the LR input is the only
   ground-truth evidence the model has. We ask: *does the SR output, degraded
   back to the LR resolution with the SAME degradation operator used during
   training, reproduce the input LR?* Where the round-trip residual is large,
   the model invented structure that is *not supported* by the input → low
   confidence. This is cheap (one extra forward pass through the fixed
   degradation + compare) and works for ANY model without retraining.

2. **Input-perturbation ensemble uncertainty** — we run the model `n` times with
   small Gaussian noise added to the LR tensor and measure per-pixel prediction
   spread. High spread = the model is sensitive to input perturbations =
   epistemic-style uncertainty. This is the standard practical substitute for
   Bayesian MC-dropout when a model has no dropout/MC layers.

Both produce a per-pixel **confidence** map in [0, 1] (1 = confident) plus a
numeric summary. The maps are written alongside the SR GeoTIFF.

Assumptions
-----------
* The training degradation (`degradation.degrade`) is a reasonable
  approximation of the true sensor downsampling for the round-trip check.
* Input-noise spread is a lower-bound proxy for model uncertainty (it measures
  sensitivity, not true posterior variance).
* Confidence is a *reliability* indicator, not a per-pixel correctness label.

Limitations
-----------
* Without an HR ground truth, "correctness" is never measured — confidence only
  measures *self-consistency* and *sensitivity*. A model can be confidently
  wrong (e.g. consistent artifacts).
* Self-consistency can be optimistic for very smooth areas (the model easily
  reproduces a near-constant region).
* Ensemble uncertainty scales linearly with `n` (extra forward passes).
"""
from __future__ import annotations

from typing import Dict, Optional, Tuple

import numpy as np
import torch

from model.datasets.degradation import DegradationConfig, degrade


def degrade_back_to_lr(
    sr_refl: np.ndarray,
    scale_factor: int,
    config: Optional[DegradationConfig] = None,
    seed: int = 0,
) -> np.ndarray:
    """Degrade an HR reflectance array back to the LR resolution.

    sr_refl: [C, H, W] float32 reflectance (the SR output).
    Returns: [C, h, W] where h = H / scale_factor (the round-tripped LR).
    Reuses the *exact* degradation operator used to synthesise training LR.
    """
    cfg = config or DegradationConfig()
    return degrade(sr_refl, cfg, seed=seed).astype(np.float32)


def _normalize_confidence(score: np.ndarray) -> np.ndarray:
    """Map a raw per-pixel error/score to a [0,1] confidence (1 = confident)."""
    s = score.astype(np.float32)
    mx = float(np.max(s))
    if mx <= 0:
        return np.ones_like(s, dtype=np.float32)
    return np.clip(1.0 / (1.0 + s) * mx, 0.0, 1.0)  # normalize so max agreement = 1


def self_consistency(
    sr_refl: np.ndarray,
    lr_refl: np.ndarray,
    scale_factor: int,
    config: Optional[DegradationConfig] = None,
    seed: int = 0,
) -> Dict[str, np.ndarray | float | dict]:
    """Self-consistency uncertainty via LR round-trip residual.

    Produces:
      confidence_map   [H, W] float32 in [0,1]  (1 = model output is consistent
                              with the input LR evidence)
      uncertainty_map  [H, W] float32 in [0,1]  (1 - confidence)
      summary          numeric summary (see `_summary`)
    """
    sr_refl = np.ascontiguousarray(sr_refl, dtype=np.float32)
    lr_refl = np.ascontiguousarray(lr_refl, dtype=np.float32)
    # degrade SR output back to LR resolution
    lr_hat = degrade_back_to_lr(sr_refl, scale_factor, config=config, seed=seed)
    # align spatial dims to the input LR (degrade should already match)
    ch, lh, lw = lr_hat.shape
    lr_refl = lr_refl[:, :lh, :lw]
    lr_hat = lr_hat[:, :lh, :lw]
    residual = np.abs(lr_hat - lr_refl).mean(axis=0)  # [H, W] (LR spatial) per-band-averaged L1
    confidence_lr = _normalize_confidence(residual)
    uncertainty_lr = 1.0 - confidence_lr
    # upsample to output (HR) resolution so the confidence map aligns with the SR
    # GeoTIFF; nearest-neighbour is appropriate (confidence is spatially smooth).
    up = int(round(scale_factor))
    confidence = np.repeat(np.repeat(confidence_lr, up, axis=0), up, axis=1)
    uncertainty = np.repeat(np.repeat(uncertainty_lr, up, axis=0), up, axis=1)
    return {
        "confidence_map": confidence,
        "uncertainty_map": uncertainty,
        "residual_mean": float(residual.mean()),
        "summary": _summary(confidence, uncertainty),
    }


def input_noise_ensemble(
    model,
    lr_tensor: torch.Tensor,
    scale_factor: int,
    n: int = 5,
    noise_std: float = 0.01,
    device: Optional[torch.device] = None,
    dtype=torch.float32,
) -> Dict[str, np.ndarray | float | dict]:
    """Input-perturbation ensemble uncertainty for a deterministic CNN.

    Runs the model `n` times with small additive Gaussian noise on the input
    and measures per-pixel prediction spread (std over bands then mean).

    Produces the same output structure as `self_consistency`.
    """
    if n <= 1:
        # fall back to a zero-spread (fully confident) trivial ensemble
        with torch.no_grad():
            out = model(lr_tensor.to(device)).float().cpu().numpy()[0]
        c, h, w = out.shape
        confidence = np.ones((h, w), dtype=np.float32)
        uncertainty = np.zeros((h, w), dtype=np.float32)
        return {
            "confidence_map": confidence,
            "uncertainty_map": uncertainty,
            "residual_mean": 0.0,
            "summary": _summary(confidence, uncertainty),
        }

    device = device or torch.device("cpu")
    preds = []
    with torch.no_grad():
        for _ in range(n):
            noisy = lr_tensor.to(device) + torch.randn_like(lr_tensor) * noise_std
            preds.append(model(noisy).float().cpu().squeeze(0))  # [C, H, W]
    preds = torch.stack(preds, dim=0)  # [n, C, H, W]
    spread = preds.std(dim=0).mean(dim=0).numpy().astype(np.float32)  # [H, W] mean over bands
    confidence = _normalize_confidence(spread)
    uncertainty = 1.0 - confidence
    return {
        "confidence_map": confidence,
        "uncertainty_map": uncertainty,
        "residual_mean": float(spread.mean()),
        "summary": _summary(confidence, uncertainty),
    }


def _summary(confidence: np.ndarray, uncertainty: np.ndarray) -> dict:
    c = confidence.astype(np.float32)
    u = uncertainty.astype(np.float32)
    high_unc = float(np.mean(u > 0.30)) * 100.0  # % of pixels above 0.30 uncertainty
    return {
        "confidence_score": float(np.mean(c) * 100.0),            # 0-100
        "confidence_mean": float(np.mean(c)),
        "confidence_std": float(np.std(c)),
        "max_uncertainty": float(np.max(u)),
        "mean_uncertainty": float(np.mean(u)),
        "high_uncertainty_pixel_percent": float(high_unc),
    }


def confidence_to_uint8(confidence: np.ndarray) -> np.ndarray:
    """Map a [0,1] confidence map to uint8 (0=uncertain .. 255=confident)."""
    c = np.clip(confidence.astype(np.float32), 0.0, 1.0)
    return np.round(c * 255.0).astype(np.uint8)


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from model.architectures import build_advanced
    print("uncertainty module OK")
    m = build_advanced(num_channels=4, scale_factor=4)
    lr = torch.rand(1, 4, 16, 16)
    res = input_noise_ensemble(m, lr, scale_factor=4, n=3)
    print("ensemble summary:", res["summary"])
    s = np.random.rand(4, 64, 64).astype(np.float32)
    l = np.random.rand(4, 16, 16).astype(np.float32)
    res2 = self_consistency(s, l, scale_factor=4)
    print("self-consistency summary:", res2["summary"])
