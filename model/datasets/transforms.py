"""
Paired spatial augmentation for LR<->HR super-resolution pairs.

The KEY constraint: every geometric transform applied to the HR patch MUST be
applied identically (same parameters) to the LR patch so that spatial alignment
and spectral-band correspondence are preserved. Only axis-aligned operations
(90deg rotations / flips) are used so that the LR/HR pixel grids stay perfectly
registerable — no sub-pixel interpolation drift is introduced between the pair.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

import numpy as np


# Sentinel-2 10 m band order used throughout GeoSR: [B02, B03, B04, B08]
BAND_NAMES: Tuple[str, ...] = ("B02", "B03", "B04", "B08")
# RGB composite (true colour) uses B04-B03-B02 -> indices 2,1,0
RGB_BANDS: Tuple[int, ...] = (2, 1, 0)
# False-colour NIR composite B08-B04-B03 -> indices 3,2,1
NIR_BANDS: Tuple[int, ...] = (3, 2, 1)


def _flip_lr(arr: np.ndarray) -> np.ndarray:
    return np.ascontiguousarray(arr[:, :, ::-1])


def _flip_ud(arr: np.ndarray) -> np.ndarray:
    return np.ascontiguousarray(arr[:, ::-1, :])


def _rot90(arr: np.ndarray, k: int) -> np.ndarray:
    return np.ascontiguousarray(np.rot90(arr, k=k, axes=(1, 2)))


def _transpose(arr: np.ndarray) -> np.ndarray:
    # swap H and W axes (axes 1,2) — alignment preserved because same op on both
    return np.ascontiguousarray(arr.transpose(0, 2, 1))


@dataclass
class PairedTransform:
    """Compose of paired augmentations sampled from a seeded RNG.

    Each augmentation decision (flip/rotate) is drawn once and applied to BOTH
    the LR and HR tensor, guaranteeing registration integrity.
    """

    flip_lr: bool = True
    flip_ud: bool = True
    rot90: bool = True           # random k in {0,1,2,3}
    transpose: bool = False      # random transpose (H<->W)
    rng_seed: Optional[int] = None

    def _sample_params(self, rng: np.random.Generator) -> Tuple[int, int, int, bool]:
        k = int(rng.integers(0, 4)) if self.rot90 else 0
        f_lr = bool(rng.random() < 0.5) if self.flip_lr else False
        f_ud = bool(rng.random() < 0.5) if self.flip_ud else False
        tp = bool(rng.random() < 0.5) if self.transpose else False
        return k, int(f_lr), int(f_ud), tp

    def apply(self, lr: np.ndarray, hr: np.ndarray, rng: Optional[np.random.Generator] = None) -> Tuple[np.ndarray, np.ndarray]:
        """Apply the SAME random augmentation to (lr, hr)."""
        if rng is None:
            rng = np.random.default_rng(self.rng_seed)
        k, f_lr, f_ud, tp = self._sample_params(rng)

        def _apply(arr: np.ndarray) -> np.ndarray:
            if tp:
                arr = _transpose(arr)
            if k:
                arr = _rot90(arr, k)
            if f_lr:
                arr = _flip_lr(arr)
            if f_ud:
                arr = _flip_ud(arr)
            return arr

        return _apply(lr), _apply(hr)


def default_train_transform() -> PairedTransform:
    """Standard training augmentation: flips + 90deg rotations (rotationally safe for grids)."""
    return PairedTransform(flip_lr=True, flip_ud=True, rot90=True, transpose=False, rng_seed=None)


def default_eval_transform() -> PairedTransform:
    """No-op transform for validation/test (identity pairing)."""
    return PairedTransform(flip_lr=False, flip_ud=False, rot90=False, transpose=False, rng_seed=None)


def make_composite(ref: np.ndarray, bands: Tuple[int, ...] = RGB_BANDS) -> np.ndarray:
    """Render a [C,H,W] reflectance tensor to a uint8 [H,W,3] RGB composite for plotting.

    Bands are normalized per-channel using 2nd/98th percentiles for contrast.
    """
    import numpy as np  # local import keeps module importable without numpy at import time of transforms

    sel = ref[list(bands), :, :]  # [3, H, W]
    out = np.zeros((3, sel.shape[1], sel.shape[2]), dtype=np.float32)
    for i in range(sel.shape[0]):
        ch = sel[i].astype(np.float32)
        lo, hi = np.percentile(ch, 2), np.percentile(ch, 98)
        rng = (hi - lo) if (hi - lo) > 1e-6 else 1.0
        out[i] = np.clip((ch - lo) / rng, 0.0, 1.0)
    return (out.transpose(1, 2, 0) * 255.0).round().astype(np.uint8)
