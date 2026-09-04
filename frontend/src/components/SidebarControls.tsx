'use client';

import React, { useRef } from 'react';
import { 
  Upload, 
  Layers, 
  Cpu, 
  Zap, 
  MapPin, 
  FileCheck, 
  Sliders, 
  Sparkles, 
  AlertCircle,
  Eye,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { 
  BandCombination, 
  ScenePreset, 
  SuperResolutionModelId, 
  ScaleFactor,
  GeoTIFFMetadata,
  ProcessingState 
} from '../types/geosr';
import { AVAILABLE_MODELS, SCENE_PRESETS } from '../lib/constants';
import { formatBytes } from '../lib/utils';

interface SidebarControlsProps {
  selectedPreset: ScenePreset;
  onSelectPreset: (preset: ScenePreset) => void;
  selectedModel: SuperResolutionModelId;
  onSelectModel: (model: SuperResolutionModelId) => void;
  scaleFactor: ScaleFactor;
  onSelectScaleFactor: (scale: ScaleFactor) => void;
  bandCombination: BandCombination;
  onSelectBandCombination: (bands: BandCombination) => void;
  overlapPercent: number;
  onOverlapChange: (overlap: number) => void;
  customMetadata: GeoTIFFMetadata | null;
  onFileUpload: (file: File) => void;
  processingState: ProcessingState;
  onRunSuperResolution: () => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  selectedPreset,
  onSelectPreset,
  selectedModel,
  onSelectModel,
  scaleFactor,
  onSelectScaleFactor,
  bandCombination,
  onSelectBandCombination,
  overlapPercent,
  onOverlapChange,
  customMetadata,
  onFileUpload,
  processingState,
  onRunSuperResolution,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(tif|tiff|zip)$/i)) {
        alert('Please select a valid Sentinel-2 GeoTIFF file (.tif, .tiff or .zip archive).');
        return;
      }
      onFileUpload(file);
    }
  };

  return (
    <aside className="w-full lg:w-96 border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar text-slate-200">
      <div className="p-4 space-y-6">
        {/* Section 1: GeoTIFF Input / Presets */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              1. Satellite Input (Sentinel-2)
            </label>
            <span className="text-[10px] text-slate-400 font-mono">10m GSD L2A</span>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-900/40 hover:bg-cyan-950/20 rounded-xl p-3.5 text-center cursor-pointer transition-all duration-200 group relative overflow-hidden"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".tif,.tiff,.zip"
              className="hidden"
            />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-cyan-500/20 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 transition-colors">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-200">
                Upload Sentinel-2 GeoTIFF
              </div>
              <p className="text-[10px] text-slate-400">
                Drag & drop .tif, .tiff (12 Bands BOA Reflectance)
              </p>
            </div>
          </div>

          {/* Active File / Custom Metadata Info */}
          {customMetadata && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-xs space-y-1">
              <div className="flex items-center justify-between text-cyan-300 font-semibold">
                <span className="truncate max-w-[200px] flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                  {customMetadata.filename}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatBytes(customMetadata.filesizeBytes)}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>CRS: {customMetadata.crs.split(' ')[0]}</span>
                <span>Original GSD: {customMetadata.gsdOriginalMeters}m</span>
              </div>
            </div>
          )}

          {/* Preset Scenes Library */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>Or Choose High-Variability Presets:</span>
              <span className="text-[10px] text-cyan-400/80 font-mono">5 Tested Scenes</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {SCENE_PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id && !customMetadata;
                return (
                  <button
                    key={preset.id}
                    onClick={() => onSelectPreset(preset)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500/80 ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>
                          {preset.title}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{preset.location}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 2: Spectral Band Combination */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2.5">
            <Layers className="w-3.5 h-3.5" />
            2. Multispectral Composition
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'RGB', label: 'True Color (RGB)', bands: 'B4-B3-B2', desc: 'Natural visual spectrum' },
              { id: 'NIR_FALSE_COLOR', label: 'Color Infrared (NIR)', bands: 'B8-B4-B3', desc: 'Vegetation vigor & biomass' },
              { id: 'AGRICULTURE', label: 'Agriculture Index', bands: 'B11-B8-B2', desc: 'Crop health & moisture' },
              { id: 'GEOLOGY_SWIR', label: 'SWIR Geology', bands: 'B12-B8-B4', desc: 'Soil & mineral bounds' },
            ].map((band) => (
              <button
                key={band.id}
                onClick={() => onSelectBandCombination(band.id as BandCombination)}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  bandCombination === band.id
                    ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${bandCombination === band.id ? 'text-indigo-200' : 'text-slate-200'}`}>
                    {band.label}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/90 mt-0.5">{band.bands}</div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">{band.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Deep Learning Super-Resolution Model */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              3. Deep SRM Architecture
            </label>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold">PyTorch Ready</span>
          </div>

          <div className="space-y-2">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = selectedModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => onSelectModel(model.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/50 border-emerald-500/80 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-emerald-200' : 'text-slate-200'}`}>
                      {model.name}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                      {model.parameters}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{model.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[10px]">
                    <span className="text-slate-400">
                      Spectral Preservation: <strong className="text-emerald-400">{model.spectralPreservationScore}%</strong>
                    </span>
                    <span className="text-slate-400">
                      Speed: <strong className="text-cyan-300">{model.speedRating}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4: Resolution & Pipeline Parameters */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Target Resolution
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">
              {scaleFactor === 4 ? '<4m Target (2.5m GSD)' : '5.0m GSD'}
            </span>
          </div>

          {/* Scale Factor Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelectScaleFactor(4)}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                scaleFactor === 4
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              4x Scale (10m → 2.5m)
            </button>
            <button
              onClick={() => onSelectScaleFactor(2)}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                scaleFactor === 2
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              2x Scale (10m → 5.0m)
            </button>
          </div>

          {/* Overlap Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Tile Overlap Blending</span>
              <span className="font-mono text-cyan-300">{overlapPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={overlapPercent}
              onChange={(e) => onOverlapChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[9px] text-slate-400">
              Eliminates tile edge seams during large GeoTIFF spatial reconstruction.
            </p>
          </div>
        </div>

        {/* Section 5: Run Super Resolution Action */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onRunSuperResolution}
            disabled={processingState.status === 'processing'}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
              processingState.status === 'processing'
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/25 border border-cyan-400/40 hover:scale-[1.01]'
            }`}
          >
            {processingState.status === 'processing' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Running DL Pipeline...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Execute SRM Pipeline</span>
              </>
            )}
          </button>

          {/* Processing Progress Telemetry */}
          {processingState.status === 'processing' && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-semibold truncate max-w-[220px]">
                  {processingState.stage}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{processingState.progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${processingState.progress}%` }}
                />
              </div>
            </div>
          )}

          {processingState.status === 'completed' && (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Super-resolution completed in {processingState.elapsedSeconds}s</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
