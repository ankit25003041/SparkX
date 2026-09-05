"""Backward-compatible re-export for Phase 5 (canonical home is model/losses/)."""
from model.losses import (  # noqa: F401
    L1ReconstructionLoss,
    CharbonnierLoss,
    ReconstructionLoss,
    SpectralAngleLoss,
    SpectralConsistencyLoss,
    CosineSpectralLoss,
    SsimLoss,
    EdgeAwareLoss,
    StructuralLoss,
    GeoSRLoss,
)

# Phase 5 train.py historically used the name below.
__all__ = [
    "L1ReconstructionLoss",
    "CharbonnierLoss",
    "ReconstructionLoss",
    "SpectralAngleLoss",
    "SpectralConsistencyLoss",
    "CosineSpectralLoss",
    "SsimLoss",
    "EdgeAwareLoss",
    "StructuralLoss",
    "GeoSRLoss",
]
