"""
Reconstruction losses for GeoSR super-resolution.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class L1ReconstructionLoss(nn.Module):
    """Mean Absolute Error on reflectance [B, C, H, W]."""

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        return F.l1_loss(pred, target, reduction="mean")


class CharbonnierLoss(nn.Module):
    """Smoothed L1 (epsilon-regularised) — robust alternative."""

    def __init__(self, eps: float = 1e-6) -> None:
        super().__init__()
        self.eps = eps

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        return torch.mean(torch.sqrt((pred - target) ** 2 + self.eps ** 2))


class ReconstructionLoss(nn.Module):
    """Dispatchable reconstruction loss returning a component dict.

    Returns: {"reconstruction": scalar, "total": scalar} so the combined loss
    can aggregate components while the training loop reads ["total"].
    """

    _REGISTRY = {
        "l1": L1ReconstructionLoss,
        "charbonnier": CharbonnierLoss,
    }

    def __init__(self, name: str = "l1") -> None:
        super().__init__()
        name = name.lower()
        if name not in self._REGISTRY:
            raise ValueError(f"Unknown reconstruction loss '{name}'. Choose from {list(self._REGISTRY)}.")
        self.name = name
        self.fn: nn.Module = self._REGISTRY[name]()

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> dict:
        val = self.fn(pred, target)
        return {"reconstruction": val, "total": val}
