"""
Baseline super-resolution CNN for 4-band Sentinel-2 imagery.

Architecture: EDSR-style residual CNN (compact).

    LR [C, h, w]  -- entry conv -->  feat [B, base, h, w]
                                       |
                         N x ResidualBlock (Conv-BN-ReLU-Conv-BN + residual)
                                       |
                              Sub-pixel Upsample (x2 repeated)
                                       |
        + (global residual: nearest-upsampled LR, EDSR style)
                                       |
                           recon conv ->  HR [C, H, W]

The model takes a LOW-RESOLUTION reflectance tensor and produces a HIGH-RESOLUTION
prediction at ``scale_factor`` x spatial size. It does NOT perform degradation;
degradation is handled by the dataset pipeline (Phase 4).

Why EDSR-style (no batch-norm in the original EDSR)? For compactness and stable
small-sample training we keep BN inside residual blocks; this variant is sometimes
called "Residual-CNN + global residual".

This is a BASELINE — not the final research architecture. It exists to prove the
train/infer loop and to establish a performance floor against which the
Phase-5 bicubic baseline is compared.
"""
from __future__ import annotations

from typing import Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidualBlock(nn.Module):
    """Conv(3x3) -> BN -> ReLU -> Conv(3x3) -> BN, with an identity residual."""

    def __init__(self, channels: int, bn: bool = True) -> None:
        super().__init__()
        self.bn = bn
        layers = [nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=not bn)]
        if bn:
            layers.append(nn.BatchNorm2d(channels))
        layers.append(nn.ReLU(inplace=True))
        layers.append(nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=not bn))
        if bn:
            layers.append(nn.BatchNorm2d(channels))
        self.block = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)


class UpsampleBlock(nn.Module):
    """Sub-pixel (pixel-shuffle) upsample by 2x with a channel-expand conv."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv = nn.Conv2d(channels, channels * 4, kernel_size=3, padding=1)
        self.pixel_shuffle = nn.PixelShuffle(2)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(self.pixel_shuffle(self.conv(x)))


class BaselineSR(nn.Module):
    """Compact residual CNN super-resolution model.

    Parameters
    ----------
    num_channels : int
        Number of spectral bands (4 for Sentinel-2 B02/B03/B04/B08).
    base_channels : int
        Feature width through the residual body.
    num_resblocks : int
        Number of residual blocks.
    scale_factor : int
        Spatial upsampling factor. Must be a power of 2 (supports 2 and 4).
    use_global_residual : bool
        If True (EDSR-style), add a nearest-neighbour upsampled LR as a global
        residual to the reconstructed features before the output conv.
    """

    def __init__(
        self,
        num_channels: int = 4,
        base_channels: int = 32,
        num_resblocks: int = 4,
        scale_factor: int = 4,
        use_global_residual: bool = True,
    ) -> None:
        super().__init__()
        if scale_factor < 1:
            raise ValueError("scale_factor must be >= 1")
        if scale_factor not in (1, 2, 4):
            raise ValueError("scale_factor must be 1, 2, or 4 (powers of two).")

        self.num_channels = num_channels
        self.scale_factor = scale_factor
        self.use_global_residual = use_global_residual

        self.entry = nn.Conv2d(num_channels, base_channels, kernel_size=3, padding=1)

        self.body = nn.Sequential(*[ResidualBlock(base_channels) for _ in range(num_resblocks)])

        # sub-pixel upsampling: one block per factor of 2
        n_up = 0
        s = scale_factor
        while s > 1:
            n_up += 1
            s //= 2
        self.upsample = nn.Sequential(*[UpsampleBlock(base_channels) for _ in range(n_up)]) if n_up else nn.Identity()

        if use_global_residual and scale_factor > 1:
            self.lr_upsample = nn.Upsample(scale_factor=scale_factor, mode="nearest")
        else:
            self.lr_upsample = None

        self.reconstruction = nn.Conv2d(base_channels, num_channels, kernel_size=3, padding=1)

    def forward(self, lr: torch.Tensor) -> torch.Tensor:
        # lr: [B, C, h, w]  reflectance in [0, 1.5]
        feat = self.body(self.entry(lr))       # [B, base, h, w]
        feat = self.upsample(feat)             # [B, base, H, W]
        out = self.reconstruction(feat)        # [B, C, H, W]
        if self.lr_upsample is not None:
            # EDSR-style global residual in the OUTPUT channel space
            out = out + self.lr_upsample(lr)
        return torch.clamp(out, 0.0, 1.5)


def build_baseline(num_channels: int = 4, base_channels: int = 32, num_resblocks: int = 4, scale_factor: int = 4) -> BaselineSR:
    """Factory matching the experiment-config hyper-parameters."""
    return BaselineSR(
        num_channels=num_channels,
        base_channels=base_channels,
        num_resblocks=num_resblocks,
        scale_factor=scale_factor,
        use_global_residual=True,
    )


if __name__ == "__main__":
    # quick self-test
    m = build_baseline(num_channels=4, scale_factor=4)
    lr = torch.randn(1, 4, 16, 16)
    with torch.no_grad():
        out = m(lr)
    print("input ", tuple(lr.shape), "-> output", tuple(out.shape))
    assert out.shape == (1, 4, 64, 64)
    print("BaselineSR self-test OK")
