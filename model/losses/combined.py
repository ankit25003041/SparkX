"""
Combined GeoSR loss:

    L_total = λ1 L_reconstruction + λ2 L_spectral + λ3 L_structural

All component weights default to 0 except reconstruction (1.0). Setting any
spectral/structural weight > 0 activates the corresponding term. The forward
returns both the total scalar and per-component values for logging.

Weights are NOT pre-assumed: the experiment script sweeps a few combos and the
best is chosen by validation PSNR.
"""
from __future__ import annotations

from typing import Dict

import torch
import torch.nn as nn

from .reconstruction import ReconstructionLoss
from .spectral import SpectralConsistencyLoss
from .structural import StructuralLoss


class GeoSRLoss(nn.Module):
    def __init__(
        self,
        reconstruction: str = "l1",
        reconstruction_weight: float = 1.0,
        spectral_weight: float = 0.0,
        structural_weight: float = 0.0,
        spectral_angle_weight: float = 0.5,
        spectral_ratio_weight: float = 0.5,
        edge_weight: float = 1.0,
        ssim_weight: float = 1.0,
        data_range: float = 1.5,
    ) -> None:
        super().__init__()
        self.reconstruction_weight = float(reconstruction_weight)
        self.spectral_weight = float(spectral_weight)
        self.structural_weight = float(structural_weight)

        self.recon = ReconstructionLoss(reconstruction)
        self.spectral = SpectralConsistencyLoss(spectral_angle_weight, spectral_ratio_weight) if self.spectral_weight > 0 else None
        self.structural = StructuralLoss(ssim_weight=ssim_weight, edge_weight=edge_weight,
                                         data_range=data_range) if self.structural_weight > 0 else None

    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> Dict[str, torch.Tensor]:
        components: Dict[str, torch.Tensor] = {}
        total = self.reconstruction_weight * self.recon(pred, target)["total"]
        components["reconstruction"] = total.clone().detach()

        if self.spectral_weight > 0 and self.spectral is not None:
            l_spec = self.spectral(pred, target)
            total = total + self.spectral_weight * l_spec
            components["spectral"] = l_spec.detach()

        if self.structural_weight > 0 and self.structural is not None:
            l_str = self.structural(pred, target)
            total = total + self.structural_weight * l_str
            components["structural"] = l_str.detach()

        components["total"] = total
        return components

    def config(self) -> dict:
        return {
            "reconstruction_weight": self.reconstruction_weight,
            "spectral_weight": self.spectral_weight,
            "structural_weight": self.structural_weight,
        }
