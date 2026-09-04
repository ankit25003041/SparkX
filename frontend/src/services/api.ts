import { 
  GeoTIFFMetadata, 
  SuperResolutionModelId, 
  ScaleFactor, 
  ValidationMetrics, 
  SpectralPoint, 
  ScenePreset, 
  BandCombination,
  AnalysisRecord,
  JobStatus
} from '../types/geosr';
import { 
  SCENE_PRESETS, 
  AVAILABLE_MODELS, 
  RECENT_ANALYSES, 
  SYSTEM_TELEMETRY,
  ANALYTICS_DATA,
  generatePipelineLogs
} from '../lib/mockData';

export interface SRJobSubmission {
  file?: File;
  presetId?: string;
  model: SuperResolutionModelId;
  scaleFactor: ScaleFactor;
  bandCombination: BandCombination;
  overlapPercent: number;
  tileSize: number;
  useTiling: boolean;
}

class GeoSRApiService {
  /**
   * Validate uploaded GeoTIFF file header and extract realistic Sentinel-2 metadata
   */
  async inspectGeoTIFF(file: File): Promise<GeoTIFFMetadata> {
    // Phase 1 Mock inspection simulation
    await new Promise((r) => setTimeout(r, 600));

    // Choose preset-like coordinates based on filename or default to Delhi
    const preset = SCENE_PRESETS[0];

    return {
      filename: file.name,
      filesizeBytes: file.size,
      width: 10980,
      height: 10980,
      channels: 12,
      crs: preset.crs,
      bounds: [76.85, 28.40, 77.45, 28.90],
      center: preset.coordinates,
      gsdOriginalMeters: 10.0,
      gsdTargetMeters: 2.5,
      cloudCoverPercent: 0.8,
      sensor: 'Sentinel-2 MSI Level-2A BOA Reflectance',
      acquisitionDate: '2026-02-18',
      bandsAvailable: ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B11', 'B12'],
    };
  }

  /**
   * Fetch Preset Scenes
   */
  async getPresets(): Promise<ScenePreset[]> {
    return SCENE_PRESETS;
  }

  /**
   * Fetch Preset Scene by ID
   */
  async getPresetById(id: string): Promise<ScenePreset | undefined> {
    return SCENE_PRESETS.find((p) => p.id === id);
  }

  /**
   * Fetch Recent Analyses
   */
  async getRecentAnalyses(): Promise<AnalysisRecord[]> {
    return RECENT_ANALYSES;
  }

  /**
   * Fetch Analysis by ID
   */
  async getAnalysisById(id: string): Promise<AnalysisRecord | undefined> {
    const found = RECENT_ANALYSES.find((a) => a.id === id);
    if (found) return found;

    // If ID matches a scene or new generated ID, synthesize an analysis record
    const matchedPreset = SCENE_PRESETS.find((p) => p.id === id || id.includes(p.id.replace('s2_', ''))) || SCENE_PRESETS[0];

    return {
      id,
      title: matchedPreset.title,
      location: matchedPreset.location,
      sceneId: matchedPreset.id,
      model: 'geosr_esrgan',
      scaleFactor: 4,
      status: 'completed',
      createdAt: 'Just now (Simulated)',
      elapsedMs: 4120,
      metrics: matchedPreset.defaultMetrics,
      lowResImageUrl: matchedPreset.lowResImageUrl,
      superResImageUrl: matchedPreset.superResImageUrl,
      uncertaintyMapUrl: matchedPreset.uncertaintyMapUrl,
      crs: matchedPreset.crs,
      coordinates: matchedPreset.coordinates,
      cloudCoverPercent: matchedPreset.cloudCoverPercent,
      filesizeBytes: 142850000,
    };
  }

  /**
   * Fetch System Telemetry
   */
  async getSystemTelemetry() {
    return SYSTEM_TELEMETRY;
  }

  /**
   * Fetch Analytics Data
   */
  async getAnalyticsData() {
    return ANALYTICS_DATA;
  }
}

export const geoSRApi = new GeoSRApiService();
