"""
GeoSR — Training Data Pipeline (Phase 4)

Synthetic paired Low-Resolution <-> High-Resolution dataset generation for
Sentinel-2 multispectral super-resolution.

Modules
-------
degradation : Controlled HR -> LR degradation (PSF blur, strided downsample, sensor noise).
transforms  : Paired augmentation that preserves LR/HR spatial alignment & spectral channels.
splits      : Spatially-disjoint train/val/test splits (no leakage) + manifest I/O.
dataset     : SatelliteSRDataset — a torch ``Dataset`` returning {"lr","hr","metadata"}.
"""

from .dataset import SatelliteSRDataset, DatasetConfig
from .degradation import DegradationConfig, degrade, upsample_bicubic
from .splits import SplitConfig, SplitManager, compute_tile_grid, assign_splits
from .transforms import PairedTransform, default_train_transform, default_eval_transform

__all__ = [
    "SatelliteSRDataset",
    "DatasetConfig",
    "DegradationConfig",
    "degrade",
    "upsample_bicubic",
    "SplitConfig",
    "SplitManager",
    "compute_tile_grid",
    "assign_splits",
    "PairedTransform",
    "default_train_transform",
    "default_eval_transform",
]
