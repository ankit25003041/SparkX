export type SpectralBandId = 
  | 'B02' // Blue (490 nm, 10m)
  | 'B03' // Green (560 nm, 10m)
  | 'B04' // Red (665 nm, 10m)
  | 'B05' // Red Edge 1 (705 nm, 20m)
  | 'B06' // Red Edge 2 (740 nm, 20m)
  | 'B07' // Red Edge 3 (783 nm, 20m)
  | 'B08' // NIR (842 nm, 10m)
  | 'B8A' // Narrow NIR (865 nm, 20m)
  | 'B11' // SWIR 1 (1610 nm, 20m)
  | 'B12'; // SWIR 2 (2190 nm, 20m)

export type BandCombination = 
  | 'RGB' // True Color: B04, B03, B02
  | 'NIR_FALSE_COLOR' // Color Infrared: B08, B04, B03
  | 'AGRICULTURE' // Agriculture: B11, B08, B02
  | 'GEOLOGY_SWIR' // SWIR Geology: B12, B08, B04
  | 'NDVI_HEATMAP'; // Normalized Difference Vegetation Index

export type SuperResolutionModelId = 
  | 'bicubic_baseline'
  | 'rcan_sat'
  | 'geosr_esrgan'
  | 'swin_sr_geo';

export type ScaleFactor = 2 | 4; // 2x: 10m -> 5m, 4x: 10m -> 2.5m

export type ViewMode = 
  | 'swipe' // Curtain wipe comparison
  | 'side_by_side' // Dual synchronized panes
  | 'uncertainty_map' // Uncertainty & confidence heatmap
  | 'magnifier'; // Real-time zoom loupe

export interface GeoTIFFMetadata {
  filename: string;
  filesizeBytes: number;
  width: number;
  height: number;
  channels: number;
  crs: string; // e.g., 'EPSG:32643'
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: [number, number]; // [lat, lon]
  gsdOriginalMeters: number; // e.g., 10.0
  gsdTargetMeters: number; // e.g., 2.5
  cloudCoverPercent: number;
  sensor: string; // 'Sentinel-2 MSI Level-2A'
  acquisitionDate: string;
  bandsAvailable: SpectralBandId[];
}

export interface SpectralPoint {
  band: SpectralBandId;
  name: string;
  wavelengthNm: number;
  originalReflectance: number; // 0.0 - 1.0 (or scaled DN)
  srReflectance: number; // 0.0 - 1.0
  diffPercent: number;
}

export interface TransectSample {
  distanceMeters: number;
  originalValue: number;
  srValue: number;
}

export interface ValidationMetrics {
  psnr: number; // dB (e.g. 34.82)
  ssim: number; // 0-1 (e.g. 0.924)
  sam: number; // degrees (Spectral Angle Mapper, lower is better, e.g. 2.15°)
  ergas: number; // Relative Dimensionless Global Error, e.g. 1.84
  uiqi: number; // Universal Image Quality Index, e.g. 0.941
  spatialCorrelation: number; // e.g. 0.968
  inferenceTimeMs: number; // e.g. 340
  pixelCountOriginal: number;
  pixelCountSuperResolved: number;
}

export interface UncertaintyMetrics {
  meanVariance: number;
  maxUncertainty: number;
  confidenceScore: number; // 0 - 100%
  highUncertaintyPixelPercent: number; // % of pixels requiring caution
}

export interface ScenePreset {
  id: string;
  title: string;
  location: string;
  category: 'Urban' | 'Agriculture' | 'Coastal' | 'Mountain' | 'Forest';
  description: string;
  coordinates: [number, number]; // [lat, lon]
  crs: string;
  cloudCoverPercent: number;
  acquisitionDate: string;
  lowResImageUrl: string;
  superResImageUrl: string;
  uncertaintyMapUrl: string;
  defaultMetrics: ValidationMetrics;
  spectralPoints: SpectralPoint[];
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  stage?: string; // 'Tiling GeoTIFF' | 'DL Super-Resolution Inference' | 'Reconstructing Spatial Grid' | 'Validating Radiometry'
  progress: number; // 0 - 100
  elapsedSeconds: number;
  errorMessage?: string;
}
