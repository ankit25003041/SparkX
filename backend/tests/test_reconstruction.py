import numpy as np
import pytest

from app.processing.tiler import PatchTiler
from app.processing.reconstruction import TileReconstructor


def test_reconstruction_shape_consistency():
    """Test output shape scales by scale_factor."""
    h, w = 100, 100
    scale = 4
    tensor = np.random.uniform(0, 1, size=(4, h, w)).astype(np.float32)

    tiler = PatchTiler(patch_size=32, overlap=8, scale_factor=scale, batch_size=4)
    _, grid_info = tiler.extract_patches(tensor)

    reconstructor = TileReconstructor(grid_info=grid_info, channels=4)

    for batch, coords, _ in tiler.generate_batches(tensor):
        # Fake upsampler: repeat pixels by scale
        upsampled_batch = np.repeat(np.repeat(batch, scale, axis=2), scale, axis=3)
        reconstructor.add_batch(upsampled_batch, coords)

    reconstructed = reconstructor.finalize()
    assert reconstructed.shape == (4, h * scale, w * scale)
    assert not np.any(np.isnan(reconstructed))


def test_reconstruction_seamlessness():
    """Test that a uniform input array reconstructs without seam boundary artifacts."""
    h, w = 96, 96
    scale = 2
    constant_val = 0.75
    tensor = np.full((4, h, w), fill_value=constant_val, dtype=np.float32)

    tiler = PatchTiler(patch_size=32, overlap=12, scale_factor=scale, batch_size=4)
    _, grid_info = tiler.extract_patches(tensor)

    reconstructor = TileReconstructor(grid_info=grid_info, channels=4)

    for batch, coords, _ in tiler.generate_batches(tensor):
        upsampled_batch = np.repeat(np.repeat(batch, scale, axis=2), scale, axis=3)
        reconstructor.add_batch(upsampled_batch, coords)

    reconstructed = reconstructor.finalize()
    
    # Check that all reconstructed pixels are within tiny epsilon of constant_val
    assert np.allclose(reconstructed, constant_val, atol=1e-3)
