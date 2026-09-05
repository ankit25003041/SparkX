import numpy as np
import pytest

from app.processing.tiler import PatchTiler


def test_patch_tiler_grid_computation():
    """Test grid coordinate calculation and patch counts."""
    tiler = PatchTiler(patch_size=64, overlap=16, scale_factor=4, batch_size=2)
    
    # 128x128 image with patch_size=64, stride=48 -> crops at 0, 48, 64 -> 3x3 = 9 patches
    grid_info = tiler.compute_grid(height=128, width=128)
    assert grid_info.patch_size == 64
    assert grid_info.overlap == 16
    assert grid_info.stride == 48
    assert grid_info.scale_factor == 4
    assert grid_info.total_patches >= 4


def test_patch_tiler_batch_generation():
    """Test batch array shapes [B, C, H, W] yielded by generator."""
    tensor = np.ones((4, 128, 128), dtype=np.float32)
    tiler = PatchTiler(patch_size=64, overlap=16, scale_factor=4, batch_size=2)

    batches = list(tiler.generate_batches(tensor))
    assert len(batches) > 0

    for batch_tensor, coords, grid_info in batches:
        b, c, h, w = batch_tensor.shape
        assert b <= 2
        assert c == 4
        assert h == 64
        assert w == 64
        assert len(coords) == b


def test_patch_tiler_invalid_args():
    """Test validation of patch size and overlap parameters."""
    with pytest.raises(ValueError):
        PatchTiler(patch_size=0)
    with pytest.raises(ValueError):
        PatchTiler(patch_size=64, overlap=64)  # overlap must be < patch_size
