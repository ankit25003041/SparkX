"""
Spectral consistency losses.

These explicitly penalise distortions in the inter-band (spectral) relationship
of the prediction — the weakness identified in the baseline (high SAM). The
primary objective mirrors the SAM *metric* so optimising the loss directly
improves the reported SAM score.
"""
from __future__ import annotations

import torch
import torch.nn as nn


def _to_2d(x: torch.Tensor) -> torch.Tensor:
    """Flatten spatial dims -> [B, C, H*W]."""
    b, c = x.shape[0], x.shape[1]
    return x.reshape(b, c, -1)


class SpectralAngleLoss(nn.Module):
    """Differentiable mean Spectral Angle (radians) over the channel vector.

    L = mean_{pixel} arccos( clamp( (p·t)/(|p||t|), eps, 1-eps ) )

    Reflectance vectors are non-negative in practice, so cos >= 0 and angles
    stay in [0, 90 deg]; clamping to [eps, 1-eps] keeps arccos stable.
    """

    def __init__(self, eps: float = 1e-7) -> None:
        super().__init__()
        self.eps = eps

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        p = _to_2d(pred)
        t = _to_2d(target)
        dot = torch.sum(p * t, dim=1)                      # [B, H*W]
        norm = torch.linalg.norm(p, dim=1) * torch.linalg.norm(t, dim=1) + self.eps
        cos = torch.clamp(dot / norm, self.eps, 1.0 - self.eps)
        angle = torch.arccos(cos)
        return angle.mean()


class CosineSpectralLoss(nn.Module):
    """Cosine dissimilarity on the channel vector (1 - cosine similarity).

    Numerically very stable; monotonically related to the spectral angle for
    small angles, so it is a soft surrogate for SAM.
    """

    def __init__(self, eps: float = 1e-7) -> None:
        super().__init__()
        self.eps = eps

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        p = _to_2d(pred)
        t = _to_2d(target)
        dot = torch.sum(p * t, dim=1)
        norm = torch.linalg.norm(p, dim=1) * torch.linalg.norm(t, dim=1) + self.eps
        return (1.0 - dot / norm).mean()


class SpectralConsistencyLoss(nn.Module):
    """Combined spectral loss: SAM (angle) + band-ratio preservation.

    The band-ratio term penalises relative distortions between bands (e.g.
    NIR/Red ratio drift) which pure angle loss can miss when both vectors scale
    together.
    """

    def __init__(self, angle_weight: float = 0.5, ratio_weight: float = 0.5) -> None:
        super().__init__()
        self.angle_weight = angle_weight
        self.ratio_weight = ratio_weight
        self.sam = SpectralAngleLoss()

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        angle = self.sam(pred, target)
        # band-ratio (relative) loss: compare per-band ratios pred/target
        eps = 1e-6
        safe_t = torch.clamp(target, min=eps)
        ratio = pred / safe_t
        angle_ratio = torch.atan(torch.abs(ratio - 1.0)).mean()
        return self.angle_weight * angle + self.ratio_weight * angle_ratio
