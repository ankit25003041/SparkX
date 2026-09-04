from dataclasses import dataclass
from typing import Generator, List, Tuple, Optional
import numpy as np


@dataclass
class PatchCoord:
    patch_idx: int
    y_in: int
    x_in: int
    in_h: int
    in_w: int
    y_out: int
    x_out: int
    out_h: int
    out_w: int


@dataclass
class PatchGridInfo:
    original_shape: Tuple[int, int]  # (H, W)
    padded_shape: Tuple[int, int]    # (H_pad, W_pad)
    padding: Tuple[int, int, int, int]  # (pad_top, pad_bottom, pad_left, pad_right)
    patch_size: int
    overlap: int
    stride: int
    scale_factor: int
    total_patches: int
    coords: List[PatchCoord]


class PatchTiler:
    """
    Extracts overlapping patches from a multispectral tensor [C, H, W]
    and packages them into model-ready tensor batches [B, C, H, W].
    """

    def __init__(
        self,
        patch_size: int = 256,
        overlap: int = 32,
        scale_factor: int = 4,
        batch_size: int = 4
    ):
        if patch_size <= 0:
            raise ValueError(f"patch_size must be positive, got {patch_size}")
        if overlap < 0 or overlap >= patch_size:
            raise ValueError(f"overlap must be in [0, patch_size), got {overlap} for patch_size {patch_size}")
        if scale_factor <= 0:
            raise ValueError(f"scale_factor must be positive, got {scale_factor}")

        self.patch_size = patch_size
        self.overlap = overlap
        self.scale_factor = scale_factor
        self.batch_size = max(1, batch_size)
        self.stride = patch_size - overlap

    def compute_grid(self, height: int, width: int) -> Tuple[np.ndarray, PatchGridInfo]:
        """
        Calculates grid coordinates and pads the input shape if necessary
        to guarantee complete coverage.
        """
        stride = self.stride
        ps = self.patch_size

        # Determine y crop coordinates
        y_coords = []
        curr_y = 0
        while curr_y + ps <= height:
            y_coords.append(curr_y)
            curr_y += stride
        if not y_coords or y_coords[-1] + ps < height:
            y_coords.append(max(0, height - ps))

        # Determine x crop coordinates
        x_coords = []
        curr_x = 0
        while curr_x + ps <= width:
            x_coords.append(curr_x)
            curr_x += stride
        if not x_coords or x_coords[-1] + ps < width:
            x_coords.append(max(0, width - ps))

        coords: List[PatchCoord] = []
        idx = 0
        for y in y_coords:
            for x in x_coords:
                coords.append(
                    PatchCoord(
                        patch_idx=idx,
                        y_in=y,
                        x_in=x,
                        in_h=ps,
                        in_w=ps,
                        y_out=y * self.scale_factor,
                        x_out=x * self.scale_factor,
                        out_h=ps * self.scale_factor,
                        out_w=ps * self.scale_factor
                    )
                )
                idx += 1

        grid_info = PatchGridInfo(
            original_shape=(height, width),
            padded_shape=(height, width),
            padding=(0, 0, 0, 0),
            patch_size=self.patch_size,
            overlap=self.overlap,
            stride=self.stride,
            scale_factor=self.scale_factor,
            total_patches=len(coords),
            coords=coords
        )

        return grid_info

    def extract_patches(
        self,
        tensor: np.ndarray
    ) -> Tuple[List[np.ndarray], PatchGridInfo]:
        """
        Extracts all patches from tensor [C, H, W].
        Returns list of patch arrays [C, patch_size, patch_size] and GridInfo.
        """
        c, h, w = tensor.shape
        grid_info = self.compute_grid(h, w)
        
        patches = []
        for coord in grid_info.coords:
            patch = tensor[:, coord.y_in:coord.y_in + coord.in_h, coord.x_in:coord.x_in + coord.in_w]
            patches.append(patch)

        return patches, grid_info

    def generate_batches(
        self,
        tensor: np.ndarray
    ) -> Generator[Tuple[np.ndarray, List[PatchCoord], PatchGridInfo], None, None]:
        """
        Yields model-ready batches of patches [B, C, H, W] along with their coordinates.
        """
        patches, grid_info = self.extract_patches(tensor)
        total = len(patches)

        for i in range(0, total, self.batch_size):
            batch_patches = patches[i:i + self.batch_size]
            batch_coords = grid_info.coords[i:i + self.batch_size]
            batch_tensor = np.stack(batch_patches, axis=0)  # Shape: [B, C, H, W]
            yield batch_tensor, batch_coords, grid_info
