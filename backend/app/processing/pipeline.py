import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple, Union, Any
import numpy as np
from PIL import Image

from app.core.logging import logger
from app.processing.metadata import RasterMetadata, MetadataExtractor
from app.processing.raster_reader import RasterReader, RasterData, S2_10M_BANDS
from app.processing.preprocessing import Sentinel2Preprocessor, PreprocessedData
from app.processing.normalization import Normalizer, NormalizationMethod, NormalizationParams
from app.processing.tiler import PatchTiler, PatchGridInfo
from app.processing.reconstruction import TileReconstructor
from app.processing.geotiff_writer import GeoTIFFWriter


# Explicit label for temporary pipeline test placeholder
BASELINE_MODEL_LABEL = "BASELINE_BICUBIC_DETERMINISTIC (Pipeline Testing Placeholder — Not Final DL Model)"


ModelInferenceFn = Callable[[np.ndarray], np.ndarray]


class BaselineDeterministicUpsampler:
    """
    Temporary deterministic spatial upsampler used strictly for verifying
    pipeline tiling, batching, reconstruction, and geospatial alignment.
    
    IMPORTANT: This is a BASELINE test placeholder, NOT the final deep-learning model.
    """
    def __init__(self, scale_factor: int = 4):
        self.scale_factor = scale_factor
        self.label = BASELINE_MODEL_LABEL

    def __call__(self, batch: np.ndarray) -> np.ndarray:
        """
        Executes deterministic multi-channel bicubic upsampling on batch [B, C, H, W].
        Returns upsampled batch [B, C, H * scale, W * scale].
        """
        b, c, h, w = batch.shape
        out_h = h * self.scale_factor
        out_w = w * self.scale_factor

        out_batch = np.zeros((b, c, out_h, out_w), dtype=np.float32)

        for b_idx in range(b):
            for c_idx in range(c):
                channel_2d = batch[b_idx, c_idx]
                pil_img = Image.fromarray(channel_2d)
                resampled = pil_img.resize((out_w, out_h), Image.Resampling.BICUBIC)
                out_batch[b_idx, c_idx] = np.array(resampled, dtype=np.float32)

        return out_batch


@dataclass
class PipelineConfig:
    patch_size: int = 256
    overlap: int = 32
    scale_factor: int = 4
    batch_size: int = 4
    normalization_method: NormalizationMethod = NormalizationMethod.SENTINEL2_REFLECTANCE
    target_dtype: str = "uint16"
    clip_negative: bool = True
    impute_nodata: bool = True
    compress: str = "lzw"
    tiled_output: bool = True


@dataclass
class PipelineResult:
    output_geotiff_path: Path
    input_metadata: RasterMetadata
    output_metadata: RasterMetadata
    alignment_diagnostics: Dict[str, Any]
    total_patches: int
    elapsed_seconds: float
    model_name: str = BASELINE_MODEL_LABEL
    is_baseline: bool = True


def process_satellite_image(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    config: Optional[PipelineConfig] = None,
    model_fn: Optional[ModelInferenceFn] = None,
    progress_cb: Optional[Callable[[int, str], None]] = None
) -> PipelineResult:
    """
    Complete Geospatial Processing Pipeline:
    GeoTIFF
    → validation & metadata extraction
    → Sentinel-2 10m band selection (B02, B03, B04, B08)
    → NoData handling & imputation
    → Configurable Normalization
    → Window Tiling [B, C, H, W]
    → Model Inference Interface (or Baseline Upsampler)
    → 2D Feathering Tile Reconstruction
    → Denormalization & NoData restoration
    → GeoTIFF export with preserved CRS
    → Geospatial alignment verification
    """
    start_time = time.time()
    cfg = config or PipelineConfig()
    in_file = Path(input_path)
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    def report_progress(pct: int, msg: str):
        if progress_cb:
            progress_cb(pct, msg)
        logger.info(f"[{pct}%] {msg}")

    report_progress(5, f"Opening and validating GeoTIFF '{in_file.name}'...")

    # Step 1: Read raster data & 10m Sentinel-2 bands [B02, B03, B04, B08]
    raster_data = RasterReader.read_raster(in_file)
    input_meta = raster_data.metadata
    report_progress(15, f"Read {raster_data.data.shape[0]} bands ({input_meta.width}x{input_meta.height}) with CRS {input_meta.crs_string}")

    # Step 2: Compute scaled output metadata
    target_np_dtype = np.dtype(cfg.target_dtype)
    output_meta = MetadataExtractor.compute_scaled_metadata(
        meta=input_meta,
        scale_factor=cfg.scale_factor,
        out_channels=4,
        target_dtype=cfg.target_dtype
    )

    # Step 3: Preprocessing & NoData handling
    report_progress(25, "Preprocessing multispectral bands and managing NoData masks...")
    preprocessor = Sentinel2Preprocessor(
        clip_negative=cfg.clip_negative,
        impute_nodata=cfg.impute_nodata
    )
    preprocessed: PreprocessedData = preprocessor.process(raster_data)

    # Step 4: Configurable Normalization
    report_progress(35, f"Normalizing multispectral tensor using method '{cfg.normalization_method.value}'...")
    norm_tensor, norm_params = Normalizer.normalize(
        preprocessed.tensor,
        method=cfg.normalization_method
    )

    # Step 5: Patch Tiling
    report_progress(45, f"Tiling raster into {cfg.patch_size}x{cfg.patch_size} patches (overlap={cfg.overlap}px)...")
    tiler = PatchTiler(
        patch_size=cfg.patch_size,
        overlap=cfg.overlap,
        scale_factor=cfg.scale_factor,
        batch_size=cfg.batch_size
    )

    # Step 6: Initialize Reconstructor
    _, grid_info = tiler.extract_patches(norm_tensor)
    total_patches = grid_info.total_patches
    reconstructor = TileReconstructor(grid_info=grid_info, channels=4)

    # Step 7: Execute Model Inference (or Baseline Deterministic Upsampler)
    inference_fn = model_fn or BaselineDeterministicUpsampler(scale_factor=cfg.scale_factor)
    model_name = getattr(inference_fn, "label", "Custom Model Interface")
    is_baseline = (model_name == BASELINE_MODEL_LABEL)

    report_progress(50, f"Executing inference on {total_patches} patches using {model_name}...")

    processed_count = 0
    for batch_tensor, batch_coords, _ in tiler.generate_batches(norm_tensor):
        # batch_tensor shape: [B, C=4, H_in, W_in]
        out_batch = inference_fn(batch_tensor)  # Expected shape: [B, C=4, H_out, W_out]
        
        # Verify model output shape
        expected_h = batch_tensor.shape[2] * cfg.scale_factor
        expected_w = batch_tensor.shape[3] * cfg.scale_factor
        if out_batch.shape[2] != expected_h or out_batch.shape[3] != expected_w:
            raise ValueError(
                f"Model output spatial dimension mismatch: expected ({expected_h}, {expected_w}), got {out_batch.shape[2:]}"
            )

        # Add to seamless reconstructor
        reconstructor.add_batch(out_batch, batch_coords)
        processed_count += len(batch_coords)

        pct = int(50 + (processed_count / max(1, total_patches)) * 30)
        report_progress(pct, f"Processed {processed_count}/{total_patches} patches...")

    # Step 8: Finalize Reconstruction
    report_progress(82, "Seamless 2D feathering blending and spatial reconstruction...")
    reconstructed_norm = reconstructor.finalize()  # Shape: [4, H_scaled, W_scaled]

    # Step 9: Denormalize to target GeoTIFF dynamic range
    report_progress(88, f"Denormalizing to target data type '{cfg.target_dtype}'...")
    reconstructed_raw = Normalizer.denormalize(
        reconstructed_norm,
        params=norm_params,
        target_dtype=target_np_dtype
    )

    # Step 10: Scale NoData mask to output resolution and restore NoData values if present
    if np.any(preprocessed.nodata_mask) and input_meta.nodata is not None:
        pil_mask = Image.fromarray(preprocessed.nodata_mask.astype(np.uint8))
        out_mask_img = pil_mask.resize(
            (output_meta.width, output_meta.height),
            Image.Resampling.NEAREST
        )
        out_nodata_mask = np.array(out_mask_img, dtype=bool)
        for ch in range(4):
            reconstructed_raw[ch][out_nodata_mask] = input_meta.nodata

    # Step 11: GeoTIFF Export with preserved CRS
    report_progress(92, f"Exporting super-resolved GeoTIFF to '{out_file.name}'...")
    band_names = [f"{name} (Super-Resolved x{cfg.scale_factor})" for name in S2_10M_BANDS]
    GeoTIFFWriter.write_raster(
        output_path=out_file,
        data=reconstructed_raw,
        metadata=output_meta,
        band_names=band_names,
        compress=cfg.compress,
        tiled=cfg.tiled_output
    )

    # Step 12: Verify Geospatial Alignment
    report_progress(98, "Verifying geospatial alignment and geotransform precision...")
    alignment = GeoTIFFWriter.verify_geospatial_alignment(
        input_raster_path=in_file,
        output_raster_path=out_file,
        scale_factor=cfg.scale_factor
    )

    elapsed = round(time.time() - start_time, 3)
    report_progress(100, f"Geospatial pipeline completed successfully in {elapsed}s (Aligned: {alignment['is_aligned']})")

    return PipelineResult(
        output_geotiff_path=out_file,
        input_metadata=input_meta,
        output_metadata=output_meta,
        alignment_diagnostics=alignment,
        total_patches=total_patches,
        elapsed_seconds=elapsed,
        model_name=model_name,
        is_baseline=is_baseline
    )
