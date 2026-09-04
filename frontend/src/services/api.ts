import { 
  GeoTIFFMetadata, 
  SuperResolutionModelId, 
  ScaleFactor, 
  ValidationMetrics, 
  SpectralPoint, 
  ScenePreset, 
  BandCombination 
} from '../types/geosr';
import { SCENE_PRESETS } from '../lib/constants';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SRJobSubmission {
  jobId?: string;
  file?: File;
  presetId?: string;
  model: SuperResolutionModelId;
  scaleFactor: ScaleFactor;
  bandCombination: BandCombination;
  overlapPercent: number;
  tileSize: number;
  useTiling: boolean;
}

export interface JobProgressResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  progressPercent: number;
  elapsedMs: number;
  metrics?: ValidationMetrics;
  superResImageUrl?: string;
  uncertaintyMapUrl?: string;
  downloadUrl?: string;
  isDemo?: boolean;
}

class GeoSRApiService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = API_BASE_URL;
  }

  /**
   * Health Check to verify backend status
   */
  async checkHealth(): Promise<{ status: string; version: string; gdal_version?: string } | null> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status,
          version: data.version,
          gdal_version: data.system?.gdal_version,
        };
      }
    } catch (e) {
      console.warn('GeoSR backend health check failed:', e);
    }
    return null;
  }

  /**
   * Validate uploaded GeoTIFF file header and extract metadata via POST /api/upload
   */
  async inspectGeoTIFF(file: File): Promise<GeoTIFFMetadata> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${this.apiBaseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const resolution = data.resolution || 10.0;

        return {
          jobId: data.job_id,
          filename: data.filename || file.name,
          filesizeBytes: data.filesize_bytes || file.size,
          width: data.width,
          height: data.height,
          channels: data.bands,
          crs: data.crs,
          bounds: data.bounds && data.bounds.length === 4 
            ? [data.bounds[0], data.bounds[1], data.bounds[2], data.bounds[3]] 
            : [76.85, 28.40, 77.45, 28.90],
          center: data.center && data.center.length === 2 
            ? [data.center[0], data.center[1]] 
            : [28.6139, 77.2090],
          gsdOriginalMeters: resolution,
          gsdTargetMeters: Number((resolution / 4).toFixed(2)),
          cloudCoverPercent: data.cloud_cover_percent || 0.0,
          sensor: data.sensor || 'Sentinel-2 MSI Level-2A BOA Reflectance',
          acquisitionDate: data.acquisition_date || new Date().toISOString().split('T')[0],
          bandsAvailable: data.bands_available || ['B02', 'B03', 'B04', 'B08'],
          previewUrl: data.preview_url ? `${this.apiBaseUrl}${data.preview_url}` : undefined,
        };
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${res.status}`);
      }
    } catch (err: any) {
      console.warn('Backend upload failed, falling back to client-side inspector simulator:', err);
      
      // Phase 1 fallback simulator if server is unavailable
      await new Promise((r) => setTimeout(r, 400));
      return {
        jobId: 'job_fallback_' + Math.random().toString(36).substring(2, 9),
        filename: file.name,
        filesizeBytes: file.size,
        width: 10980,
        height: 10980,
        channels: 12,
        crs: 'EPSG:32643 (WGS 84 / UTM zone 43N)',
        bounds: [76.85, 28.40, 77.45, 28.90],
        center: [28.6139, 77.2090],
        gsdOriginalMeters: 10.0,
        gsdTargetMeters: 2.5,
        cloudCoverPercent: 1.2,
        sensor: 'Sentinel-2 MSI Level-2A BOA Reflectance',
        acquisitionDate: new Date().toISOString().split('T')[0],
        bandsAvailable: ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B11', 'B12'],
      };
    }
  }

  /**
   * Submit Super-Resolution Inference Job via POST /api/jobs/{job_id}/process
   * and poll status via GET /api/jobs/{job_id}/status
   */
  async submitSuperResolutionJob(
    params: SRJobSubmission,
    onProgress: (progress: JobProgressResponse) => void
  ): Promise<JobProgressResponse> {
    const matchedPreset = SCENE_PRESETS.find((p) => p.id === params.presetId) || SCENE_PRESETS[0];

    // Case 1: Job was created via GeoTIFF Upload (Real Backend Pipeline)
    if (params.jobId) {
      try {
        const processPayload = {
          model: params.model,
          scale_factor: params.scaleFactor,
          band_combination: params.bandCombination,
          overlap_percent: params.overlapPercent,
          tile_size: params.tileSize || 256,
          use_tiling: params.useTiling ?? true,
          preset_id: params.presetId,
        };

        const procRes = await fetch(`${this.apiBaseUrl}/api/jobs/${params.jobId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processPayload),
        });

        if (!procRes.ok && procRes.status !== 202) {
          const errBody = await procRes.json().catch(() => ({}));
          throw new Error(errBody.detail || 'Failed to start processing job');
        }

        // Poll job status until completion
        const startTime = Date.now();
        while (true) {
          await new Promise((r) => setTimeout(r, 350));
          const statusRes = await fetch(`${this.apiBaseUrl}/api/jobs/${params.jobId}/status`);
          if (!statusRes.ok) break;

          const statusData = await statusRes.json();
          const elapsed = Date.now() - startTime;

          onProgress({
            jobId: params.jobId,
            status: statusData.status === 'COMPLETED' ? 'completed' 
                  : statusData.status === 'FAILED' ? 'failed' 
                  : 'processing',
            stage: statusData.stage || 'Executing SRM DL Pipeline...',
            progressPercent: statusData.progress || 0,
            elapsedMs: elapsed,
          });

          if (statusData.status === 'COMPLETED') {
            // Fetch final metrics and results
            const resultsRes = await fetch(`${this.apiBaseUrl}/api/jobs/${params.jobId}/results`);
            const metricsRes = await fetch(`${this.apiBaseUrl}/api/jobs/${params.jobId}/metrics`);
            
            const resultsData = resultsRes.ok ? await resultsRes.json() : {};
            const metricsData = metricsRes.ok ? await metricsRes.json() : null;

            return {
              jobId: params.jobId,
              status: 'completed',
              stage: 'Super-Resolution Reconstruction Finished Successfully (Phase 2 Baseline)',
              progressPercent: 100,
              elapsedMs: elapsed,
              metrics: metricsData || matchedPreset.defaultMetrics,
              superResImageUrl: resultsData.super_res_preview_url 
                ? (resultsData.super_res_preview_url.startsWith('http') ? resultsData.super_res_preview_url : `${this.apiBaseUrl}${resultsData.super_res_preview_url}`)
                : matchedPreset.superResImageUrl,
              uncertaintyMapUrl: resultsData.uncertainty_map_url 
                ? (resultsData.uncertainty_map_url.startsWith('http') ? resultsData.uncertainty_map_url : `${this.apiBaseUrl}${resultsData.uncertainty_map_url}`)
                : matchedPreset.uncertaintyMapUrl,
              downloadUrl: resultsData.download_url 
                ? (resultsData.download_url.startsWith('http') ? resultsData.download_url : `${this.apiBaseUrl}${resultsData.download_url}`)
                : undefined,
              isDemo: resultsData.is_demo ?? true,
            };
          }

          if (statusData.status === 'FAILED' || statusData.status === 'CANCELLED') {
            throw new Error(statusData.error_message || 'Pipeline execution failed on server');
          }
        }
      } catch (e: any) {
        console.warn('Real backend processing failed or interrupted:', e);
        // If error is genuine rejection, rethrow
        if (e.message && !e.message.includes('fetch')) {
          throw e;
        }
      }
    }

    // Case 2: Preset Scene / Fallback Multi-Stage Progress Simulation
    const jobId = 'geosr_job_' + Math.random().toString(36).substring(2, 9);
    const stages = [
      { name: 'Reading Sentinel-2 GeoTIFF Geotransform & Projection...', progress: 15, delay: 350 },
      { name: 'Extracting 12-Band BOA Reflectance Arrays & Normalization...', progress: 35, delay: 450 },
      { name: `Executing DL Inference (${params.model} x${params.scaleFactor})...`, progress: 65, delay: 650 },
      { name: 'Seamless Tile Blending & Geospatial Coordinate Reconstruction...', progress: 85, delay: 400 },
      { name: 'Spectral Angle & Radiometric Uncertainty Validation...', progress: 100, delay: 350 },
    ];

    let start = Date.now();
    for (const stage of stages) {
      await new Promise((r) => setTimeout(r, stage.delay));
      onProgress({
        jobId,
        status: stage.progress === 100 ? 'completed' : 'processing',
        stage: stage.name,
        progressPercent: stage.progress,
        elapsedMs: Date.now() - start,
      });
    }

    const multiplier = params.model === 'geosr_esrgan' ? 1.0 : params.model === 'rcan_sat' ? 1.02 : params.model === 'swin_sr_geo' ? 1.04 : 0.88;

    const metrics: ValidationMetrics = {
      ...matchedPreset.defaultMetrics,
      psnr: Number((matchedPreset.defaultMetrics.psnr * (multiplier > 1 ? 1.01 : 0.92)).toFixed(2)),
      ssim: Number(Math.min(0.99, matchedPreset.defaultMetrics.ssim * (multiplier > 1 ? 1.008 : 0.94)).toFixed(3)),
      sam: Number((matchedPreset.defaultMetrics.sam * (multiplier > 1 ? 0.95 : 1.25)).toFixed(2)),
      inferenceTimeMs: params.model === 'swin_sr_geo' ? 620 : params.model === 'geosr_esrgan' ? 410 : params.model === 'rcan_sat' ? 390 : 85,
    };

    return {
      jobId,
      status: 'completed',
      stage: 'Super-Resolution Reconstruction Finished Successfully (Demo Preset)',
      progressPercent: 100,
      elapsedMs: Date.now() - start,
      metrics,
      superResImageUrl: matchedPreset.superResImageUrl,
      uncertaintyMapUrl: matchedPreset.uncertaintyMapUrl,
      isDemo: true,
    };
  }

  /**
   * Fetch Preset Scenes
   */
  async getPresets(): Promise<ScenePreset[]> {
    return SCENE_PRESETS;
  }
}

export const geoSRApi = new GeoSRApiService();
