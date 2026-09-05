"""
Geospatial processing pipeline for Sentinel-2 multispectral imagery.
"""
from app.processing.metadata import RasterMetadata, MetadataExtractor
from app.processing.raster_reader import RasterReader, RasterData, S2_10M_BANDS
from app.processing.preprocessing import Sentinel2Preprocessor, PreprocessedData
from app.processing.normalization import Normalizer, NormalizationMethod, NormalizationParams
from app.processing.tiler import PatchTiler, PatchCoord, PatchGridInfo
from app.processing.reconstruction import TileReconstructor
from app.processing.geotiff_writer import GeoTIFFWriter
from app.processing.pipeline import (
    PipelineConfig,
    PipelineResult,
    process_satellite_image,
    BaselineDeterministicUpsampler,
    BASELINE_MODEL_LABEL,
)

__all__ = [
    "RasterMetadata",
    "MetadataExtractor",
    "RasterReader",
    "RasterData",
    "S2_10M_BANDS",
    "Sentinel2Preprocessor",
    "PreprocessedData",
    "Normalizer",
    "NormalizationMethod",
    "NormalizationParams",
    "PatchTiler",
    "PatchCoord",
    "PatchGridInfo",
    "TileReconstructor",
    "GeoTIFFWriter",
    "PipelineConfig",
    "PipelineResult",
    "process_satellite_image",
    "BaselineDeterministicUpsampler",
    "BASELINE_MODEL_LABEL",
]
