"""
PyTorch Dataset for Sentinel-2 super-resolution training pairs (LR <-> HR).

Design
------
* HR source = real Sentinel-2 10 m bands [B02, B03, B04, B08], normalized to
  BOA reflectance (DN / 10000, clipped to [0, 1.5]) — matching the backend
  Normalizer convention.
* LR is synthesized ON THE FLY from each HR patch via `degrade()` with a
  deterministic per-patch seed (base_seed, patch_index). This makes the LR<->HR
  correspondence fixed and reproducible regardless of access order or epoch.
* Spatial augmentation (flips / 90 deg rotations) uses the SAME parameters on
  LR and HR so registration + spectral bands are preserved. Augmentation seed
  incorporates the epoch (set_epoch) for per-epoch variety while staying
  reproducible across worker processes.
* No spatial leakage: each item belongs to exactly one split (see splits.py);
  train/val/test tile coordinates are disjoint.

Item output
-----------
{
  "lr":      torch.FloatTensor [C, H//s, W//s],
  "hr":      torch.FloatTensor [C, H, W],
  "metadata": {
      "scene_id", "split", "patch_index", "y", "x",
      "hr_shape", "lr_shape", "crs", "gsd_hr", "gsd_lr",
      "bands", "scale_factor", "nodata_present", "value_range_hr",
      "value_range_lr",
  },
}
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import rasterio
import torch
from torch.utils.data import Dataset

from .degradation import DegradationConfig, degrade
from .splits import SplitConfig, SplitManager, BAND_NAMES_10M
from .transforms import PairedTransform, default_train_transform, default_eval_transform

DEFAULT_REFLECTANCE_SCALE = 10000.0


@dataclass
class DatasetConfig:
    tiff_path: str
    split: str = "train"
    patch_size: int = 64
    scale_factor: int = 4
    overlap: int = 0
    ratios: Tuple[float, float, float] = (0.8, 0.1, 0.1)
    seed: int = 42
    bands: Tuple[str, ...] = BAND_NAMES_10M
    degrade_config: DegradationConfig = field(default_factory=DegradationConfig)
    reflectance_scale: float = DEFAULT_REFLECTANCE_SCALE
    clip_range: Tuple[float, float] = (0.0, 1.5)
    use_augmentation: bool = True
    transform: Optional[PairedTransform] = None
    epoch: int = 0


def _select_band_indices(count: int, descriptions: Optional[List]) -> List[int]:
    """Resolve 1-based band indices for the 4 Sentinel-2 10 m bands.

    Mirrors backend.raster_reader.RasterReader.identify_10m_band_indices so the
    model pipeline reads the same bands as the inference backend.
    """
    targets = ["B02", "B03", "B04", "B08"]
    if descriptions and len(descriptions) >= 4:
        desc_upper = [str(d).upper() for d in descriptions if d]
        matched: List[int] = []
        for t in targets:
            for idx, d in enumerate(desc_upper):
                if t in d:
                    matched.append(idx + 1)
                    break
        if len(matched) == 4:
            return matched
    if count >= 12:   # full 12-band S2 L2A layout
        return [2, 3, 4, 8]
    if count == 10:
        return [1, 2, 3, 7]
    if count == 4:
        return [1, 2, 3, 4]
    if count == 3:
        return [1, 2, 3, 3]
    if count == 1:
        return [1, 1, 1, 1]
    return [min(i + 1, count) for i in range(4)]


class _SceneSource:
    """Loads + normalizes a full HR scene into a [C,H,W] reflectance float32 array."""

    def __init__(
        self,
        tiff_path: str,
        bands: Tuple[str, ...] = BAND_NAMES_10M,
        reflectance_scale: float = DEFAULT_REFLECTANCE_SCALE,
        clip_range: Tuple[float, float] = (0.0, 1.5),
    ) -> None:
        self.tiff_path = str(tiff_path)
        path = Path(tiff_path)
        if not path.exists():
            raise FileNotFoundError(f"GeoTIFF not found: {path}")

        with rasterio.open(self.tiff_path) as src:
            self.count = src.count
            self.height = src.height
            self.width = src.width
            self.crs = str(src.crs) if src.crs else "UNKNOWN"
            self.transform = src.transform
            self.gsd = float(abs(src.transform.a or src.transform[0]))
            self.nodata = src.nodata
            self.band_names = [str(d) if d else f"Band_{i+1}" for i, d in enumerate(src.descriptions)]
            indices = _select_band_indices(self.count, src.descriptions)
            if len(indices) > self.count:
                indices = [min(i, self.count) for i in indices]
            data = src.read(indices).astype(np.float32)  # [C, H, W]

        # radiometric normalization to BOA reflectance
        lo, hi = clip_range
        self.data = np.clip(data / reflectance_scale, lo, hi).astype(np.float32)
        self.band_labels = list(bands)
        self.nodata_mask = self._compute_nodata_mask(data)

    def _compute_nodata_mask(self, raw: np.ndarray) -> np.ndarray:
        if self.nodata is not None and not np.isnan(self.nodata):
            return np.any(raw == self.nodata, axis=0)
        return np.any(~np.isfinite(raw), axis=0)

    def hr_value_range(self) -> Tuple[float, float]:
        return (float(np.min(self.data)), float(np.max(self.data)))


class SatelliteSRDataset(Dataset):
    """Paired LR/HR Sentinel-2 super-resolution dataset."""

    def __init__(self, config: DatasetConfig) -> None:
        if config.split not in ("train", "validation", "test"):
            raise ValueError(f"split must be one of train/validation/test, got {config.split}")
        if config.patch_size % config.scale_factor != 0:
            raise ValueError(
                f"patch_size ({config.patch_size}) must be divisible by scale_factor "
                f"({config.scale_factor}) so LR patches align cleanly."
            )

        self.config = config
        self.scale_factor = config.scale_factor

        self.source = _SceneSource(
            tiff_path=config.tiff_path,
            bands=config.bands,
            reflectance_scale=config.reflectance_scale,
            clip_range=config.clip_range,
        )
        hr_h, hr_w = self.source.height, self.source.width
        if hr_h < config.patch_size or hr_w < config.patch_size:
            raise ValueError(
                f"Scene ({hr_h}x{hr_w}) smaller than patch_size ({config.patch_size})."
            )

        split_cfg = SplitConfig(
            patch_size=config.patch_size,
            overlap=config.overlap,
            scale_factor=config.scale_factor,
            ratios=config.ratios,
            seed=config.seed,
        )
        self.split_manager = SplitManager(split_cfg)
        all_splits = self.split_manager.compute(hr_h, hr_w)
        self.tile_coords: List[Tuple[int, int]] = all_splits[config.split]
        if len(self.tile_coords) == 0:
            raise ValueError(f"No tiles generated for split '{config.split}'. Reduce patch_size or increase image size.")

        self.transform: Optional[PairedTransform] = (
            config.transform
            if config.transform is not None
            else (default_train_transform() if config.use_augmentation else default_eval_transform())
        )

    # -- reproducibility helpers -------------------------------------------------
    def set_epoch(self, epoch: int) -> None:
        self.config.epoch = epoch

    def __len__(self) -> int:
        return len(self.tile_coords)

    def _degrade_seed(self, patch_index: int) -> int:
        # deterministic per-patch LR generation
        return self.config.seed * 100003 + patch_index * 97 + self.scale_factor

    def _augmentation_rng(self, patch_index: int) -> np.random.Generator:
        # per-epoch, per-patch augmentation seed (reproducible yet epoch-varying)
        seed_seq = np.random.SeedSequence([
            int(self.config.seed),
            int(self.config.epoch),
            patch_index,
        ])
        return np.random.default_rng(seed_seq)

    # -- core -------------------------------------------------------------------
    def __getitem__(self, index: int) -> Dict[str, Any]:
        if index < 0 or index >= len(self.tile_coords):
            raise IndexError(index)

        y, x = self.tile_coords[index]
        ps = self.config.patch_size
        hr_patch = self.source.data[:, y : y + ps, x : x + ps].astype(np.float32).copy()

        # sanity: pad short edge tiles (kept aligned because we crop LR from HR)
        _, h, w = hr_patch.shape
        if h != ps or w != ps:
            padded = np.zeros((hr_patch.shape[0], ps, ps), dtype=np.float32)
            padded[:, :h, :w] = hr_patch
            hr_patch = padded

        # deterministic degradation
        lr_patch = degrade(hr_patch, self.config.degrade_config, seed=self._degrade_seed(index))

        # paired augmentation (same params on LR & HR)
        if self.transform is not None:
            lr_patch, hr_patch = self.transform.apply(lr_patch, hr_patch, rng=self._augmentation_rng(index))

        lr_tensor = torch.from_numpy(np.ascontiguousarray(lr_patch))
        hr_tensor = torch.from_numpy(np.ascontiguousarray(hr_patch))

        nodata_present = bool(self.source.nodata_mask[y : y + ps, x : x + ps].any())
        lr_h, lr_w = lr_tensor.shape[1], lr_tensor.shape[2]

        metadata = {
            "scene_id": Path(self.config.tiff_path).stem,
            "split": self.config.split,
            "patch_index": int(index),
            "y": int(y),
            "x": int(x),
            "hr_shape": [hr_tensor.shape[1], hr_tensor.shape[2]],
            "lr_shape": [lr_h, lr_w],
            "crs": self.source.crs,
            "gsd_hr": float(self.source.gsd),
            "gsd_lr": float(self.source.gsd * self.scale_factor),
            "bands": list(self.config.bands),
            "scale_factor": int(self.scale_factor),
            "nodata_present": nodata_present,
            "value_range_hr": [float(hr_tensor.min().item()), float(hr_tensor.max().item())],
            "value_range_lr": [float(lr_tensor.min().item()), float(lr_tensor.max().item())],
        }
        return {"lr": lr_tensor, "hr": hr_tensor, "metadata": metadata}

    def scene_metadata(self) -> Dict[str, Any]:
        return {
            "source_file": self.source.tiff_path,
            "bands": self.source.band_labels,
            "crs": self.source.crs,
            "height": self.source.height,
            "width": self.source.width,
            "gsd_meters": float(self.source.gsd),
            "nodata": self.source.nodata,
            "value_range_hr": self.source.hr_value_range(),
        }
