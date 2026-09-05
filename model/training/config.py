"""Training configuration for the GeoSR baseline SR pipeline.

Configuration is a single source of truth for an experiment. It is serialized
into checkpoints and experiment logs so any result is fully reproducible from
the config + dataset manifest.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Tuple


@dataclass
class LossWeights:
    """Per-component weights for the multi-component GeoSR loss.

    The combined loss is: total = w_l1*recon + w_spectral*spec + w_ssim*struct
    + w_edge*edge + w_tv*TV, matching ``model/losses/combined.GeoSRLoss``.
    Any component whose weight is 0 is not instantiated (cheap).
    """

    l1: float = 1.0          # L1 reconstruction (primary)
    spectral: float = 0.2    # spectral angle / cosine (preserves band angles)
    ssim: float = 0.1        # structural (1 - SSIM)
    edge: float = 0.05       # edge-aware (Charbonnier on gradients)
    total_variation: float = 0.0  # TV smoothing (optional regulariser)


@dataclass
class TrainConfig:
    # --- data ---
    tiff_path: str = "data/sample_sentinel2_10m.tif"
    patch_size: int = 64
    scale_factor: int = 4
    seed: int = 42
    ratios: Tuple[float, float, float] = (0.8, 0.1, 0.1)
    num_workers: int = 0
    max_train_iters: int = 0  # cap iters/epoch (0 = off)

    # --- model ---
    model_name: str = "advanced"  # "baseline" | "advanced"
    num_channels: int = 4
    base_channels: int = 32
    num_resblocks: int = 4        # used by the baseline architecture
    num_groups: int = 2           # used by the advanced architecture
    blocks_per_group: int = 2     # used by the advanced architecture
    reduction: int = 4            # SE channel-reduction for spectral attention
    use_global_residual: bool = True

    # --- loss ---
    loss: str = "geosr"  # "l1" | "geosr" (multi-component) | "charbonnier"
    loss_weights: "LossWeights" = field(default_factory=lambda: LossWeights())

    # --- optimiser / training ---
    epochs: int = 20
    batch_size: int = 8
    lr: float = 1e-4
    weight_decay: float = 1e-5
    lr_scheduler: str = "cosine"  # "cosine" | "multistep" | "none"
    lr_milestones: Tuple[int, ...] = (12, 16)
    clip_grad: float = 0.0  # 0 = no clipping

    # --- precision ---
    use_amp: bool = False  # auto-enabled when CUDA is available in train.py
    # device is resolved at runtime (cuda if available else cpu)

    # --- output dirs ---
    experiment_name: str = "baseline_run"
    checkpoint_dir: str = "model/checkpoints"
    log_dir: str = "model/logs"
    dataset_manifest: str = "data/processed/geosr_v1/manifest.json"

    # --- dataset version stamp (recorded verbatim for experiment tracking) ---
    dataset_version: str = "geosr_v1"

    # extras
    extra: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.checkpoint_dir = str(self.checkpoint_dir)
        self.log_dir = str(self.log_dir)

    @property
    def device(self) -> str:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"

    @property
    def amp_enabled(self) -> bool:
        import torch
        return bool(self.use_amp and torch.cuda.is_available())

    def as_dict(self) -> dict:
        d = asdict(self)
        d["device"] = self.device
        d["amp_enabled"] = self.amp_enabled
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "TrainConfig":
        d = dict(d)
        d.pop("device", None)
        d.pop("amp_enabled", None)
        lw = d.pop("loss_weights", None)
        if isinstance(lw, dict):
            lw = LossWeights(**{k: v for k, v in lw.items() if k in LossWeights.__dataclass_fields__})
        out = cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})
        if lw is not None:
            out.loss_weights = lw
        return out

    def checkpoint_dir_for_run(self, run_name: str) -> Path:
        return Path(self.checkpoint_dir, run_name)

    def log_dir_for_run(self, run_name: str) -> Path:
        return Path(self.log_dir, self.experiment_name, run_name)
