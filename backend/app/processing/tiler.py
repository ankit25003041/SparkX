from dataclasses import dataclass
from typing import Generator, List, Tuple
import numpy as np
from rasterio.windows import Window


@dataclass
class WindowTile:
    tile_idx: int
    total_tiles: int
    row_idx: int
    col_idx: int
    window: Window
    out_window: Window
    is_border: bool


class RasterTiler:
    """
    Computes and manages overlapping tile windows for safe chunked raster processing.
    Avoids loading full multi-gigabyte rasters into RAM.
    """
    def __init__(
        self,
        width: int,
        height: int,
        tile_size: int = 256,
        overlap_percent: int = 20,
        scale_factor: int = 4,
    ):
        self.width = width
        self.height = height
        self.tile_size = max(64, tile_size)
        self.overlap_percent = max(0, min(50, overlap_percent))
        self.scale_factor = scale_factor

        self.overlap_pixels = int(self.tile_size * (self.overlap_percent / 100.0))
        self.stride = max(1, self.tile_size - self.overlap_pixels)

        # Output dimensions
        self.out_width = self.width * self.scale_factor
        self.out_height = self.height * self.scale_factor
        self.out_tile_size = self.tile_size * self.scale_factor
        self.out_stride = self.stride * self.scale_factor
        self.out_overlap_pixels = self.overlap_pixels * self.scale_factor

    def compute_tiles(self) -> List[WindowTile]:
        """Generates list of tile windows covering the raster."""
        tiles: List[WindowTile] = []
        tile_idx = 0

        # Calculate coordinates
        y_coords: List[int] = []
        curr_y = 0
        while curr_y < self.height:
            y_coords.append(curr_y)
            if curr_y + self.tile_size >= self.height:
                break
            curr_y += self.stride

        x_coords: List[int] = []
        curr_x = 0
        while curr_x < self.width:
            x_coords.append(curr_x)
            if curr_x + self.tile_size >= self.width:
                break
            curr_x += self.stride

        total_tiles = len(y_coords) * len(x_coords)

        for row_idx, y in enumerate(y_coords):
            for col_idx, x in enumerate(x_coords):
                w = min(self.tile_size, self.width - x)
                h = min(self.tile_size, self.height - y)

                in_win = Window(col_off=x, row_off=y, width=w, height=h)
                
                out_x = x * self.scale_factor
                out_y = y * self.scale_factor
                out_w = w * self.scale_factor
                out_h = h * self.scale_factor
                out_win = Window(col_off=out_x, row_off=out_y, width=out_w, height=out_h)

                is_border = (x == 0 or y == 0 or (x + w) == self.width or (y + h) == self.height)

                tiles.append(
                    WindowTile(
                        tile_idx=tile_idx,
                        total_tiles=total_tiles,
                        row_idx=row_idx,
                        col_idx=col_idx,
                        window=in_win,
                        out_window=out_win,
                        is_border=is_border
                    )
                )
                tile_idx += 1

        return tiles

    @staticmethod
    def get_blend_weights(tile_shape: Tuple[int, int]) -> np.ndarray:
        """
        Creates a 2D Hann window weighting matrix for seamless feathering
        across overlapping tile boundaries.
        """
        h, w = tile_shape
        wy = np.hanning(h)
        wx = np.hanning(w)
        # Avoid zero division at borders
        wy = np.clip(wy, 0.05, 1.0)
        wx = np.clip(wx, 0.05, 1.0)
        weight_2d = np.outer(wy, wx)
        return weight_2d.astype(np.float32)
