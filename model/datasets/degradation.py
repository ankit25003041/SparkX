"""
Controlled degradation model for GeoSR synthetic training pairs.

Pipeline (HR -> LR):
    HR reflectance [0,1.5]
        -> Gaussian PSF blur  (optics + atmospheric MTF approximation)
        -> Strided area-averaging downsample  (sensor integration + decimation)
        -> Additive Gaussian noise  (sensor read/photon noise approximation)
        -> LR reflectance [0,1.5]

Scientific note (see DATASET.md):
    Sentinel-2 acquisition physics include wavelength-dependent PSFs,
    spectral band registration offsets, and quantization noise. Synthetic
    degradation approximates the *net* spatial blurring of the imaging
    chain but does NOT perfectly reproduce on-orbit PSF behaviour, band
    co-registration jitter, or aliasing from the original scan geometry.
    It is a training approximation, not a physical simulator.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np
from scipy.ndimage import gaussian_filter


@dataclass
class DegradationConfig:
    """Parameters controlling the HR -> LR degradation.

    All parameters are wavelength-agnostic (applied identically per band)
    so that spectral channel correspondence between LR and HR is preserved.
    """

    scale_factor: int = 4            # LR GSD = scale_factor * HR GSD (>=2)
    blur_kernel_size: int = 0        # 0 = sigma-driven (recommended). Odd int to force a fixed footprint.
    gaussian_sigma: float = 1.0      # PSF blur std-dev in HR pixels (per-axis, isotropic)
    noise_std: float = 0.01          # additive Gaussian noise std in reflectance units ([0,1.5] scale)
    anti_alias: bool = True          # downsample via area-averaging (True) or stride-subsample (False)
    clip_range: Tuple[float, float] = (0.0, 1.5)  # valid BOA reflectance range after DN/10000 normalization
    reflectance_scale: float = 10000.0  # DN -> reflectance divisor (Sentinel-2 L2A convention)


def _block_downsample(arr: np.ndarray, scale: int) -> np.ndarray:
    """Strided area-averaging downsample by integer `scale`.

    `arr` shape: [C, H, W]. H and W MUST be divisible by `scale`.
    """
    if scale == 1:
        return arr
    c, h, w = arr.shape
    if h % scale != 0 or w % scale != 0:
        raise ValueError(
            f"Spatial dims ({h},{w}) must be divisible by scale_factor {scale} for clean tiling. "
            f"Crop/pad your HR patch to a multiple of {scale}."
        )
    new_h, new_w = h // scale, w // scale
    trimmed = arr[:, : new_h * scale, : new_w * scale]
    reshaped = trimmed.reshape(c, new_h, scale, new_w, scale)
    return reshaped.mean(axis=(2, 4))


def _stride_downsample(arr: np.ndarray, scale: int) -> np.ndarray:
    """Decimation-only downsample (no anti-aliasing)."""
    return arr[:, ::scale, ::scale]


def degrade(
    hr: np.ndarray,
    config: DegradationConfig,
    seed: int = 42,
) -> np.ndarray:
    """Generate a synthetic LR image from a HR reflectance tensor.

    Parameters
    ----------
    hr : np.ndarray
        High-resolution reflectance, shape [C, H, W], dtype float32.
        Expects already-normalized reflectance in ``clip_range`` (DN/10000).
    config : DegradationConfig
        Degradation hyper-parameters.
    seed : int
        Seed for the noise RNG — makes degradation reproducible.

    Returns
    -------
    np.ndarray
        Low-resolution reflectance [C, H//s, W//s], same dtype/range as `hr`.
    """
    if hr.ndim != 3:
        raise ValueError(f"Expected HR array of shape [C,H,W], got {hr.shape}")
    c, h, w = hr.shape
    scale = config.scale_factor
    if scale < 1:
        raise ValueError("scale_factor must be >= 1")

    hr = hr.astype(np.float64, copy=True)

    # 1) PSF blur — approximate optics + atmospheric MTF.
    #    Per-band independent Gaussian; applied identically to all bands by sigma.
    if config.gaussian_sigma > 0:
        sigma = config.gaussian_sigma if config.blur_kernel_size == 0 else None
        for ch in range(c):
            if sigma is not None:
                hr[ch] = gaussian_filter(hr[ch], sigma=sigma, mode="nearest")
            else:
                # Explicit odd kernel footprint via truncate
                gaussian_filter(hr[ch], sigma=config.gaussian_sigma, radius=config.blur_kernel_size // 2, mode="nearest", output=hr[ch])

    # 2) Decimation / sensor sampling
    if config.anti_alias:
        lr = _block_downsample(hr, scale)
    else:
        lr = _stride_downsample(hr, scale)

    # 3) Additive sensor noise (reproducible)
    if config.noise_std > 0:
        rng = np.random.default_rng(seed)
        lr = lr + rng.normal(0.0, config.noise_std, size=lr.shape)

    # 4) Clip back to physically valid reflectance range
    lo, hi = config.clip_range
    lr = np.clip(lr, lo, hi)

    return lr.astype(np.float32)


def upsample_bicubic(lr: np.ndarray, scale: int) -> np.ndarray:
    """Reference up-sampler (bicubic) for quality checks: LR -> HR grid size.

    Uses scipy's Order-3 spline (bicubic) interpolation applied per band.
    """
    from scipy.ndimage import zoom

    if lr.ndim != 3:
        raise ValueError(f"Expected LR array of shape [C,H,W], got {lr.shape}")
    c, h, w = lr.shape
    zoomed = np.stack([
        zoom(lr[ch], scale, order=3, mode="nearest")[: h * scale, : w * scale]
        for ch in range(c)
    ], axis=0)
    return zoomed.astype(np.float32)


def reflectance_to_uint8(ref: np.ndarray, scale: float = 10000.0) -> np.ndarray:
    """Map reflectance [0, ~1.5] -> display uint8 [0,255] for visualization."""
    ref = np.clip(ref / 1.5, 0.0, 1.0) if ref.max() > 1.0 else np.clip(ref, 0.0, 1.0)
    return (ref * 255.0).round().astype(np.uint8)
