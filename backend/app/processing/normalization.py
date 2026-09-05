from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Tuple, Any, Union
import numpy as np


class NormalizationMethod(str, Enum):
    SENTINEL2_REFLECTANCE = "sentinel2_reflectance"  # Standard S2 L2A BOA: DN / 10000.0 -> [0.0, 1.0]
    MINMAX = "minmax"                                # Per-channel or global min-max scaling to [0.0, 1.0]
    PERCENTILE = "percentile"                        # 2nd-98th percentile robust normalization
    ZSCORE = "zscore"                                # Standard score (x - mean) / std


@dataclass
class NormalizationParams:
    method: NormalizationMethod
    mins: Optional[np.ndarray] = None      # Shape: [C, 1, 1]
    maxs: Optional[np.ndarray] = None      # Shape: [C, 1, 1]
    means: Optional[np.ndarray] = None     # Shape: [C, 1, 1]
    stds: Optional[np.ndarray] = None      # Shape: [C, 1, 1]
    scale_val: float = 10000.0             # Default Sentinel-2 BOA scale
    clip_range: Tuple[float, float] = (0.0, 1.0)


class Normalizer:
    """
    Configurable normalizer supporting multiple remote sensing normalization
    strategies and bidirectional denormalization.
    """

    @staticmethod
    def normalize(
        tensor: np.ndarray,
        method: Union[NormalizationMethod, str] = NormalizationMethod.SENTINEL2_REFLECTANCE,
        percentile_range: Tuple[float, float] = (2.0, 98.0),
    ) -> Tuple[np.ndarray, NormalizationParams]:
        """
        Normalizes a multispectral tensor [C, H, W] to model-ready float32 array in [0.0, 1.0].
        """
        if isinstance(method, str):
            method = NormalizationMethod(method.lower())

        c, h, w = tensor.shape
        data = tensor.astype(np.float32)

        if method == NormalizationMethod.SENTINEL2_REFLECTANCE:
            # Standard Sentinel-2 BOA Level-2A scaling: DN 10,000 corresponds to 1.0 BOA reflectance
            norm_data = np.clip(data / 10000.0, 0.0, 1.5)
            params = NormalizationParams(
                method=method,
                scale_val=10000.0,
                clip_range=(0.0, 1.5)
            )
            return norm_data, params

        elif method == NormalizationMethod.MINMAX:
            mins = np.min(data, axis=(1, 2), keepdims=True)
            maxs = np.max(data, axis=(1, 2), keepdims=True)
            diff = np.where((maxs - mins) == 0, 1.0, (maxs - mins))
            norm_data = np.clip((data - mins) / diff, 0.0, 1.0)
            params = NormalizationParams(
                method=method,
                mins=mins,
                maxs=maxs,
                clip_range=(0.0, 1.0)
            )
            return norm_data, params

        elif method == NormalizationMethod.PERCENTILE:
            p_low, p_high = percentile_range
            mins = np.percentile(data, p_low, axis=(1, 2), keepdims=True)
            maxs = np.percentile(data, p_high, axis=(1, 2), keepdims=True)
            diff = np.where((maxs - mins) == 0, 1.0, (maxs - mins))
            norm_data = np.clip((data - mins) / diff, 0.0, 1.0)
            params = NormalizationParams(
                method=method,
                mins=mins,
                maxs=maxs,
                clip_range=(0.0, 1.0)
            )
            return norm_data, params

        elif method == NormalizationMethod.ZSCORE:
            means = np.mean(data, axis=(1, 2), keepdims=True)
            stds = np.std(data, axis=(1, 2), keepdims=True)
            stds = np.where(stds == 0, 1.0, stds)
            norm_data = (data - means) / stds
            params = NormalizationParams(
                method=method,
                means=means,
                stds=stds,
                clip_range=(-3.0, 3.0)
            )
            return norm_data, params

        else:
            raise ValueError(f"Unknown normalization method: {method}")

    @staticmethod
    def denormalize(
        norm_tensor: np.ndarray,
        params: NormalizationParams,
        target_dtype: np.dtype = np.uint16
    ) -> np.ndarray:
        """
        Inverts normalization to restore original reflectance or digital number scale
        for GeoTIFF export.
        """
        data = norm_tensor.astype(np.float32)

        if params.method == NormalizationMethod.SENTINEL2_REFLECTANCE:
            restored = data * params.scale_val
        elif params.method in (NormalizationMethod.MINMAX, NormalizationMethod.PERCENTILE):
            if params.mins is not None and params.maxs is not None:
                diff = params.maxs - params.mins
                restored = (data * diff) + params.mins
            else:
                restored = data * 10000.0
        elif params.method == NormalizationMethod.ZSCORE:
            if params.means is not None and params.stds is not None:
                restored = (data * params.stds) + params.means
            else:
                restored = data * 10000.0
        else:
            restored = data

        # Cast to target datatype safely
        if np.issubdtype(target_dtype, np.integer):
            info = np.iinfo(target_dtype)
            restored = np.clip(np.round(restored), info.min, info.max).astype(target_dtype)
        else:
            restored = restored.astype(target_dtype)

        return restored
