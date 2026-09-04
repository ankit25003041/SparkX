'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  Sparkles, 
  Cpu, 
  Sliders, 
  ArrowRight, 
  FileCode2, 
  Layers, 
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UploadDropzone } from '../../components/UploadDropzone';
import { MetadataCard } from '../../components/MetadataCard';
import { AVAILABLE_MODELS, SCENE_PRESETS } from '../../lib/mockData';
import { 
  SuperResolutionModelId, 
  ScaleFactor, 
  BandCombination, 
  GeoTIFFMetadata, 
  ScenePreset 
} from '../../types/geosr';
import { geoSRApi } from '../../services/api';

export default function UploadPage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ScenePreset | null>(SCENE_PRESETS[0]);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<GeoTIFFMetadata>({
    filename: 'S2A_MSIL2A_20260218T054851_N0500_R048_T43RER_20260218T082914.tif',
    filesizeBytes: 142850000,
    width: 10980,
    height: 10980,
    channels: 12,
    crs: 'EPSG:32643 (WGS 84 / UTM zone 43N)',
    bounds: [76.85, 28.40, 77.45, 28.90],
    center: [28.6139, 77.2090],
    gsdOriginalMeters: 10.0,
    gsdTargetMeters: 2.5,
    cloudCoverPercent: 0.8,
    sensor: 'Sentinel-2 MSI Level-2A BOA Reflectance',
    acquisitionDate: '2026-02-18',
    bandsAvailable: ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B11', 'B12'],
  });

  // Pipeline configuration parameters
  const [selectedModel, setSelectedModel] = useState<SuperResolutionModelId>('geosr_esrgan');
  const [scaleFactor, setScaleFactor] = useState<ScaleFactor>(4);
  const [bandCombination, setBandCombination] = useState<BandCombination>('RGB');
  const [overlapPercent, setOverlapPercent] = useState<number>(20);

  // Handle local file selection
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setSelectedPreset(null);
    setIsInspecting(true);

    try {
      const inspected = await geoSRApi.inspectGeoTIFF(file);
      setMetadata(inspected);
    } catch (err) {
      console.error('Inspection error:', err);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setSelectedPreset(SCENE_PRESETS[0]);
    setMetadata({
      filename: 'S2A_MSIL2A_20260218T054851_N0500_R048_T43RER.tif',
      filesizeBytes: 142850000,
      width: 10980,
      height: 10980,
      channels: 12,
      crs: SCENE_PRESETS[0].crs,
      bounds: [76.85, 28.40, 77.45, 28.90],
      center: SCENE_PRESETS[0].coordinates,
      gsdOriginalMeters: 10.0,
      gsdTargetMeters: 2.5,
      cloudCoverPercent: SCENE_PRESETS[0].cloudCoverPercent,
      sensor: 'Sentinel-2 MSI Level-2A BOA Reflectance',
      acquisitionDate: SCENE_PRESETS[0].acquisitionDate,
      bandsAvailable: ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B11', 'B12'],
    });
  };

  // Handle sample preset selection
  const handleSelectPreset = (preset: ScenePreset) => {
    setSelectedPreset(preset);
    setSelectedFile(null);
    setMetadata({
      filename: `${preset.id.toUpperCase()}_MSIL2A_EPSG32643.tif`,
      filesizeBytes: 154200000,
      width: 10980,
      height: 10980,
      channels: 12,
      crs: preset.crs,
      bounds: [
        preset.coordinates[1] - 0.25,
        preset.coordinates[0] - 0.25,
        preset.coordinates[1] + 0.25,
        preset.coordinates[0] + 0.25,
      ],
      center: preset.coordinates,
      gsdOriginalMeters: 10.0,
      gsdTargetMeters: 2.5,
      cloudCoverPercent: preset.cloudCoverPercent,
      sensor: 'Sentinel-2 MSI Level-2A BOA Reflectance',
      acquisitionDate: preset.acquisitionDate,
      bandsAvailable: ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B11', 'B12'],
    });
  };

  // Start analysis and redirect to /processing/[id]
  const handleStartAnalysis = () => {
    const analysisId = selectedPreset
      ? selectedPreset.id
      : 'geosr_' + Math.random().toString(36).substring(2, 9);

    router.push(`/processing/${analysisId}?model=${selectedModel}&scale=${scaleFactor}&bands=${bandCombination}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Upload className="w-3.5 h-3.5" />
            Phase 1 • Analysis Pipeline Setup
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Upload & Configure Sentinel-2 Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Provide a Sentinel-2 GeoTIFF (.tif, .tiff) or pick an Indian test preset. Configure deep learning super-resolution parameters before launching the 8-stage inference pipeline.
          </p>
        </div>

        {/* 2-Column Main Layout: Left = Upload/Presets, Right = Params & Metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload Dropzone & Sample Scenes */}
          <div className="lg:col-span-7 space-y-6">
            {/* Dropzone */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                1. Select Satellite Raster File
              </h2>
              <UploadDropzone
                onFileSelected={handleFileSelected}
                selectedFile={selectedFile}
                onClearFile={handleClearFile}
                isInspecting={isInspecting}
              />
            </div>

            {/* Quick-Pick Sentinel-2 Sample Scenes */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  Or choose a pre-loaded Sentinel-2 L2A scene:
                </h3>
                <span className="text-[10px] font-mono text-cyan-400">SIH Benchmark Presets</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SCENE_PRESETS.map((preset) => {
                  const isSelected = selectedPreset?.id === preset.id && !selectedFile;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500/60 ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium text-xs">
                        <span className="text-white truncate">{preset.title.split('(')[0]}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {preset.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1">
                        {preset.crs} • Cloud: {preset.cloudCoverPercent}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata Preview */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                2. GeoTIFF Metadata Inspection Preview
              </h2>
              <MetadataCard metadata={metadata} targetScale={scaleFactor} />
            </div>
          </div>

          {/* Right Column: Model Selection & Parameter Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 sticky top-20">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2 pb-3 border-b border-slate-800">
                <Sliders className="w-4 h-4 text-cyan-400" />
                3. Super-Resolution Parameters
              </h2>

              {/* Model Choice */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Deep Learning Architecture:
                </label>
                <div className="space-y-2">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200 ring-1 ring-cyan-500/30'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-950 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-white">
                          <span>{model.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                            {model.speed}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {model.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scale Factor: 2x vs 4x */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Enhancement Scale Factor:</span>
                  <span className="text-cyan-400 font-bold">
                    {scaleFactor}x (10m → {scaleFactor === 4 ? '2.5m' : '5.0m'} GSD)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <button
                    type="button"
                    onClick={() => setScaleFactor(4)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      scaleFactor === 4
                        ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-sm font-bold">4x GSD Boost</div>
                    <div className="text-[10px] text-slate-400">10m → 2.5m (Recommended)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScaleFactor(2)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      scaleFactor === 2
                        ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-sm font-bold">2x GSD Boost</div>
                    <div className="text-[10px] text-slate-400">10m → 5.0m</div>
                  </button>
                </div>
              </div>

              {/* Band Combination Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-slate-400">
                  Primary Spectral Composite:
                </label>
                <select
                  value={bandCombination}
                  onChange={(e) => setBandCombination(e.target.value as BandCombination)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="RGB">True Color (RGB B04, B03, B02)</option>
                  <option value="NIR_FALSE_COLOR">Color Infrared (NIR B08, B04, B03)</option>
                  <option value="AGRICULTURE">Agriculture SWIR (B11, B08, B02)</option>
                  <option value="GEOLOGY_SWIR">Geology SWIR (B12, B08, B04)</option>
                  <option value="NDVI_HEATMAP">Normalized Difference Vegetation Index (NDVI)</option>
                </select>
              </div>

              {/* Tile Overlap Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Sub-Tile Boundary Overlap:</span>
                  <span className="text-cyan-400 font-bold">{overlapPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="5"
                  value={overlapPercent}
                  onChange={(e) => setOverlapPercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="text-[10px] font-mono text-slate-500">
                  Gaussian taper blending applied across border pixels to eliminate seam artifacts.
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                Start Super-Resolution Analysis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
