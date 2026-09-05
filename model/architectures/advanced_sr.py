"""
Advanced multispectral super-resolution model (Phase 6).

Design rationale (NOT a blind copy of any single paper). The architecture is
built to fix the *specific* weaknesses found in the Phase 5 baseline:

  * Baseline weakness A — **spectral distortion** (high SAM): band relationships
    degrade because plain convs treat channels independently. -> add
    **SpectralAttention** (squeeze-and-excitation over the channel axis) and a
    spectral SAM-based training loss so inter-band angles are preserved.
  * Baseline weakness B — **structural blur** (low SSIM, missing edges): L1
    collapses high frequencies -> add **multi-scale spatial blocks** (parallel
    3x3 / 5x5 / dilated-3x3 kernels for a richer multi-scale receptive field)
    plus an **edge-aware + SSIM training loss**.
  * Baseline weakness C — shallow depth -> **residual groups** (nested local +
    group residuals) + a **global residual** (nearest-upsampled LR added to the
    output), standard practice to stabilise deep SR nets.

The four explicit requirements from the brief are mapped as:
  1. Spatial feature learning  -> MultiScaleSpatialBlock
  2. Spectral feature learning -> SpectralAttention (channel-wise recalibration)
  3. Multi-scale reconstruction-> multi-branch conv + stacked sub-pixel upsample
  4. Residual learning         -> local block residual + residual-group residual + global residual
"""
from __future__ import annotations

from typing import Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


class UpsampleBlock(nn.Module):
    """Sub-pixel (pixel-shuffle) upsample by 2x (inlined for script-runnability)."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv = nn.Conv2d(channels, channels * 4, kernel_size=3, padding=1)
        self.pixel_shuffle = nn.PixelShuffle(2)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(self.pixel_shuffle(self.conv(x)))


class SpectralAttention(nn.Module):
    """Squeeze-and-Excitation style channel recalibration.

    Learns a per-channel attention that captures cross-band dependencies, which
    is what plain convolutions miss and what causes spectral drift (high SAM).
    """

    def __init__(self, channels: int, reduction: int = 4) -> None:
        super().__init__()
        self.se = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),            # [B, C, 1, 1]
            nn.Conv2d(channels, channels // reduction, 1),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels // reduction, channels, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.se(x)


class MultiScaleSpatialBlock(nn.Module):
    """Parallel multi-scale spatial convolution (3x3, 5x5, dilated-3x3).

    Concatenates three receptive fields then projects back with a 1x1 conv.
    This gives the network simultaneous access to fine / medium / contextual
    spatial structure — improving SSIM and edge fidelity vs a single 3x3 stack.
    Includes a local identity residual.
    """

    def __init__(self, channels: int) -> None:
        super().__init__()
        third = max(1, channels // 3)
        self.conv3 = nn.Conv2d(channels, third, kernel_size=3, padding=1)
        self.conv5 = nn.Conv2d(channels, third, kernel_size=5, padding=2)
        self.conv_dil = nn.Conv2d(channels, third, kernel_size=3, padding=2, dilation=2)
        concat_ch = third * 3
        # project the multi-scale concatenation back to ``channels`` so the
        # local residual is shape-valid even when channels is not divisible by 3.
        self.proj = nn.Sequential(
            nn.Conv2d(concat_ch, channels, kernel_size=1),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = torch.cat([self.conv3(x), self.conv5(x), self.conv_dil(x)], dim=1)
        out = self.proj(out)
        return x + out  # local residual


class ResidualGroup(nn.Module):
    """Stack of multi-scale spatial blocks followed by spectral attention,
    wrapped in a residual group (the group learns a residual update)."""

    def __init__(self, channels: int, n_blocks: int, reduction: int) -> None:
        super().__init__()
        blocks = [MultiScaleSpatialBlock(channels) for _ in range(n_blocks)]
        blocks.append(SpectralAttention(channels, reduction))
        self.body = nn.Sequential(*blocks)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.body(x)  # residual-group residual


class AdvancedSR(nn.Module):
    """Multi-scale spectral super-resolution CNN.

    Parameters
    ----------
    num_channels : int
        Input/output spectral bands (4 for Sentinel-2 10 m).
    base_channels : int
        Feature width.
    num_groups : int
        Number of residual groups.
    blocks_per_group : int
        Multi-scale blocks per group.
    reduction : int
        SE channel-reduction ratio for spectral attention.
    scale_factor : int
        Upsampling factor (must be 1, 2, or 4).
    use_global_residual : bool
        Add a nearest-upsampled LR as a global residual (EDSR-style).
    """

    def __init__(
        self,
        num_channels: int = 4,
        base_channels: int = 32,
        num_groups: int = 2,
        blocks_per_group: int = 2,
        reduction: int = 4,
        scale_factor: int = 4,
        use_global_residual: bool = True,
    ) -> None:
        super().__init__()
        if scale_factor not in (1, 2, 4):
            raise ValueError("scale_factor must be 1, 2, or 4 (powers of two).")
        self.scale_factor = scale_factor
        self.num_channels = num_channels

        self.entry = nn.Conv2d(num_channels, base_channels, kernel_size=3, padding=1)

        self.groups = nn.Sequential(*[
            ResidualGroup(base_channels, blocks_per_group, reduction) for _ in range(num_groups)
        ])

        # progressive sub-pixel upsampling (one block per factor of 2)
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
        feat = self.groups(self.entry(lr))         # [B, base, h, w]
        feat = self.upsample(feat)                 # [B, base, H, W]
        out = self.reconstruction(feat)            # [B, num_channels, H, W]
        if self.lr_upsample is not None:
            out = out + self.lr_upsample(lr)       # global residual (output channel space)
        return torch.clamp(out, 0.0, 1.5)


def build_advanced(
    num_channels: int = 4,
    base_channels: int = 32,
    num_groups: int = 2,
    blocks_per_group: int = 2,
    reduction: int = 4,
    scale_factor: int = 4,
) -> AdvancedSR:
    """Factory matching the Phase 6 experiment config."""
    return AdvancedSR(
        num_channels=num_channels,
        base_channels=base_channels,
        num_groups=num_groups,
        blocks_per_group=blocks_per_group,
        reduction=reduction,
        scale_factor=scale_factor,
        use_global_residual=True,
    )


if __name__ == "__main__":
    m = build_advanced(num_channels=4, scale_factor=4)
    lr = torch.randn(1, 4, 16, 16)
    with torch.no_grad():
        out = m(lr)
    params = sum(p.numel() for p in m.parameters())
    print("input", tuple(lr.shape), "-> output", tuple(out.shape), "params", params)
    assert out.shape == (1, 4, 64, 64)
    print("AdvancedSR self-test OK")
