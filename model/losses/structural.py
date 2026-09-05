"""
Structural / edge-aware losses.

These push reconstruction towards sharp edges and realistic local structure —
the weakness identified in the baseline (low SSIM, blurry L1 output).
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class SsimLoss(nn.Module):
    """Differentiable (1 - SSIM) loss using 3x3 avg-pool local statistics.

    Operates on [B, C, H, W]. Returns 1 - mean SSIM (lower is better).
    """

    def __init__(self, data_range: float = 1.5) -> None:
        super().__init__()
        self.c1 = (0.01 * data_range) ** 2
        self.c2 = (0.03 * data_range) ** 2

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        mu_x = F.avg_pool2d(pred, 3, 1, 1)
        mu_y = F.avg_pool2d(target, 3, 1, 1)
        sigma_x = F.avg_pool2d(pred * pred, 3, 1, 1) - mu_x * mu_x
        sigma_y = F.avg_pool2d(target * target, 3, 1, 1) - mu_y * mu_y
        sigma_xy = F.avg_pool2d(pred * target, 3, 1, 1) - mu_x * mu_y
        ssim_map = ((2 * sigma_xy + self.c2) / (sigma_x + sigma_y + self.c2)) * \
                   ((2 * mu_x * mu_y + self.c1) / (mu_x * mu_x + mu_y * mu_y + self.c1))
        return 1.0 - ssim_map.mean()


class EdgeAwareLoss(nn.Module):
    """Edge-aware L1 loss on Sobel gradients.

    Computes per-band horizontal/vertical gradients and takes L1 between the
    prediction and target gradient maps — encouraging sharp, well-aligned edges.
    """

    def __init__(self) -> None:
        super().__init__()

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        gx_pred, gy_pred = _sobel(pred)
        gx_tgt, gy_tgt = _sobel(target)
        return F.l1_loss(gx_pred, gx_tgt) + F.l1_loss(gy_pred, gy_tgt)


def _sobel(x: torch.Tensor):
    b, c, h, w = x.shape
    kx = torch.tensor([[1.0, 0.0, -1.0], [2.0, 0.0, -2.0], [1.0, 0.0, -1.0]],
                      device=x.device, dtype=x.dtype).view(1, 1, 3, 3)  # [1,1,3,3]
    ky = torch.tensor([[1.0, 2.0, 1.0], [0.0, 0.0, 0.0], [-1.0, -2.0, -1.0]],
                      device=x.device, dtype=x.dtype).view(1, 1, 3, 3)
    kx = kx.repeat(c, 1, 1, 1)  # [c,1,3,3] — one 1-input-channel group per band
    ky = ky.repeat(c, 1, 1, 1)
    gx = F.conv2d(x, kx, padding=1, groups=c)
    gy = F.conv2d(x, ky, padding=1, groups=c)
    return gx, gy


class StructuralLoss(nn.Module):
    """Weighted combination of SSIM + edge-aware gradient loss."""

    def __init__(self, ssim_weight: float = 1.0, edge_weight: float = 1.0, data_range: float = 1.5) -> None:
        super().__init__()
        self.ssim_weight = ssim_weight
        self.edge_weight = edge_weight
        self.ssim = SsimLoss(data_range)
        self.edge = EdgeAwareLoss()

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        return self.ssim_weight * self.ssim(pred, target) + self.edge_weight * self.edge(pred, target)
