'use client';

import React from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  Leaf, 
  Globe2,
  RefreshCw
} from 'lucide-react';

export type MapOverlayId = 'sr_overlay' | 'confidence_overlay' | 'ndvi_overlay' | 'none';

interface LayerControlProps {
  activeOverlay: MapOverlayId;
  onSelectOverlay: (overlay: MapOverlayId) => void;
  overlayOpacity: number; // 0 to 100
  onOpacityChange: (opacity: number) => void;
  isBeforeAfterToggled: boolean;
  onToggleBeforeAfter: () => void;
  showTileBoundaries: boolean;
  onToggleTileBoundaries: () => void;
  className?: string;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  activeOverlay,
  onSelectOverlay,
  overlayOpacity,
  onOpacityChange,
  isBeforeAfterToggled,
  onToggleBeforeAfter,
  showTileBoundaries,
  onToggleTileBoundaries,
  className = '',
}) => {
  return (
    <div className={`p-4 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-4 ${className}`}>
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            GIS Layer Stack
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80">
          EPSG:32643
        </span>
      </div>

      {/* Before / After Instant Toggle Switch */}
      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-white">Before / After Flip</div>
          <div className="text-[10px] font-mono text-slate-400">
            {isBeforeAfterToggled ? 'Viewing: 2.5m Super-Resolved' : 'Viewing: 10m Sentinel-2 Input'}
          </div>
        </div>
        <button
          onClick={onToggleBeforeAfter}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shadow-sm ${
            isBeforeAfterToggled
              ? 'bg-cyan-600 text-white shadow-cyan-950'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {isBeforeAfterToggled ? '2.5m SR' : '10m LR'}
        </button>
      </div>

      {/* Active Overlays Radio Selection */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">
          Active Raster Overlays:
        </div>

        {/* Option 1: GeoSR 2.5m Super-Resolution */}
        <button
          onClick={() => onSelectOverlay('sr_overlay')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-mono border transition-all ${
            activeOverlay === 'sr_overlay'
              ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
              : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>GeoSR 4x Super-Resolution</span>
          </div>
          <span className="text-[10px] text-cyan-400 font-semibold">2.5m GSD</span>
        </button>

        {/* Option 2: Model Confidence Heatmap */}
        <button
          onClick={() => onSelectOverlay('confidence_overlay')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-mono border transition-all ${
            activeOverlay === 'confidence_overlay'
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
              : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Uncertainty Heatmap</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">96.4% Conf</span>
        </button>

        {/* Option 3: NDVI Vegetation Mask */}
        <button
          onClick={() => onSelectOverlay('ndvi_overlay')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-mono border transition-all ${
            activeOverlay === 'ndvi_overlay'
              ? 'bg-purple-950/60 border-purple-500/60 text-purple-300'
              : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Leaf className="w-3.5 h-3.5 text-purple-400" />
            <span>NDVI Spectral Index</span>
          </div>
          <span className="text-[10px] text-purple-400 font-semibold">B08/B04</span>
        </button>

        {/* Option 4: None (Base satellite only) */}
        <button
          onClick={() => onSelectOverlay('none')}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-mono border transition-all ${
            activeOverlay === 'none'
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Sentinel-2 Base Layer Only</span>
          </div>
          <span className="text-[10px] text-slate-500">10m GSD</span>
        </button>
      </div>

      {/* Layer Opacity Slider */}
      {activeOverlay !== 'none' && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Overlay Opacity:
            </span>
            <span className="text-cyan-400 font-bold">{overlayOpacity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={overlayOpacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {/* Tile Boundaries Toggle */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
        <span>256x256 Inference Grid:</span>
        <button
          onClick={onToggleTileBoundaries}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
            showTileBoundaries
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'bg-slate-900 text-slate-500 border border-slate-800'
          }`}
        >
          {showTileBoundaries ? 'SHOWN' : 'HIDDEN'}
        </button>
      </div>
    </div>
  );
};
