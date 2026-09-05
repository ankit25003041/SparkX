from typing import List, Tuple, Optional
import numpy as np

from app.processing.tiler import PatchGridInfo, PatchCoord


class TileReconstructor:
    """
    Reassembles super-resolved patch predictions into a unified output raster
    using 2D cosine/Hann feathering blending to eliminate tile boundary seams.
    """

    def __init__(self, grid_info: PatchGridInfo, channels: int = 4):
        self.grid_info = grid_info
        self.channels = channels
        self.scale_factor = grid_info.scale_factor
        
        orig_h, orig_w = grid_info.original_shape
        self.out_h = orig_h * self.scale_factor
        self.out_w = orig_w * self.scale_factor

        # Accumulator buffers for weighted blending
        self.output_buffer = np.zeros((self.channels, self.out_h, self.out_w), dtype=np.float32)
        self.weight_buffer = np.zeros((1, self.out_h, self.out_w), dtype=np.float32)

        # Precompute 2D Hann blending weight window for patch size
        out_patch_h = grid_info.patch_size * self.scale_factor
        out_patch_w = grid_info.patch_size * self.scale_factor
        self.patch_weight = self._create_2d_blend_window(out_patch_h, out_patch_w)

    @staticmethod
    def _create_2d_blend_window(h: int, w: int) -> np.ndarray:
        """
        Creates a 2D Hann window for smooth overlap blending.
        Values taper smoothly from 1.0 at center to 0.05 at edges.
        """
        wy = np.hanning(h)
        wx = np.hanning(w)
        # Avoid zero values at extreme edges to prevent division issues
        wy = np.clip(wy, 0.05, 1.0)
        wx = np.clip(wx, 0.05, 1.0)
        weight_2d = np.outer(wy, wx).astype(np.float32)
        return np.expand_dims(weight_2d, axis=0)  # Shape: [1, H, W]

    def add_patch(self, patch: np.ndarray, coord: PatchCoord):
        """
        Adds a single super-resolved patch [C, H_out, W_out] to the accumulator.
        """
        y = coord.y_out
        x = coord.x_out
        h = coord.out_h
        w = coord.out_w

        patch_weight = self.patch_weight[:, :h, :w]
        weighted_patch = patch * patch_weight

        self.output_buffer[:, y:y + h, x:x + w] += weighted_patch
        self.weight_buffer[:, y:y + h, x:x + w] += patch_weight

    def add_batch(self, batch: np.ndarray, coords: List[PatchCoord]):
        """
        Adds a batch of super-resolved patches [B, C, H_out, W_out] to the accumulator.
        """
        b_size = batch.shape[0]
        for i in range(b_size):
            self.add_patch(batch[i], coords[i])

    def finalize(self) -> np.ndarray:
        """
        Computes the final normalized reconstructed raster [C, H_scaled, W_scaled].
        """
        # Safe normalization by accumulated weights
        safe_weight = np.where(self.weight_buffer <= 0, 1.0, self.weight_buffer)
        reconstructed = self.output_buffer / safe_weight

        return reconstructed.astype(np.float32)
