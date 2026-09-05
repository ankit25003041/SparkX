import numpy as np
import pytest

from app.processing.normalization import Normalizer, NormalizationMethod


@pytest.fixture
def sample_tensor():
    """Synthetic multispectral array [C=4, H=64, W=64] with realistic DN values."""
    np.random.seed(42)
    return np.random.uniform(200, 8000, size=(4, 64, 64)).astype(np.float32)


def test_sentinel2_reflectance_normalization(sample_tensor):
    """Test Sentinel-2 DN / 10000.0 normalization and restoration."""
    norm, params = Normalizer.normalize(sample_tensor, method=NormalizationMethod.SENTINEL2_REFLECTANCE)
    
    assert norm.shape == sample_tensor.shape
    assert np.all(norm >= 0.0)
    assert np.all(norm <= 1.5)

    restored = Normalizer.denormalize(norm, params, target_dtype=np.uint16)
    assert restored.dtype == np.uint16
    assert np.allclose(restored, sample_tensor, atol=1.0)


def test_minmax_normalization(sample_tensor):
    """Test MinMax normalization to [0, 1] and restoration."""
    norm, params = Normalizer.normalize(sample_tensor, method=NormalizationMethod.MINMAX)
    
    assert norm.shape == sample_tensor.shape
    assert np.min(norm) >= 0.0
    assert np.max(norm) <= 1.0

    restored = Normalizer.denormalize(norm, params, target_dtype=np.float32)
    assert np.allclose(restored, sample_tensor, atol=1e-3)


def test_percentile_normalization(sample_tensor):
    """Test Percentile normalization."""
    norm, params = Normalizer.normalize(sample_tensor, method=NormalizationMethod.PERCENTILE)
    assert norm.shape == sample_tensor.shape
    assert np.all(norm >= 0.0)
    assert np.all(norm <= 1.0)


def test_zscore_normalization(sample_tensor):
    """Test ZScore normalization."""
    norm, params = Normalizer.normalize(sample_tensor, method=NormalizationMethod.ZSCORE)
    assert norm.shape == sample_tensor.shape
    # Check approximately zero mean and unit variance per channel
    means = np.mean(norm, axis=(1, 2))
    stds = np.std(norm, axis=(1, 2))
    assert np.allclose(means, 0.0, atol=1e-5)
    assert np.allclose(stds, 1.0, atol=1e-3)
