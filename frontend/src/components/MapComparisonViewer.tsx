'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  SplitSquareVertical, 
  Columns2, 
  ShieldAlert, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Ruler, 
  Eye, 
  Sparkles,
  Info,
  MapPin
} from 'lucide-react';
import { ViewMode, ScenePreset, BandCombination } from '../types/geosr';
import { formatCoords } from '../lib/utils';

interface MapComparisonViewerProps {
  preset: ScenePreset;
  bandCombination: BandCombination;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCoordinatesHover: (coords: [number, number]) => void;
  scaleFactor: number;
  isProcessing: boolean;
}

export const MapComparisonViewer: React.FC<MapComparisonViewerProps> = ({
  preset,
  bandCombination,
  viewMode,
  onViewModeChange,
  onCoordinatesHover,
  scaleFactor,
  isProcessing,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [transectLine, setTransectLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isDrawingTransect, setIsDrawingTransect] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle slider drag
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const percent = (x / rect.width) * 100;

    // Calculate approximate coordinates within bounds
    const lon = preset.coordinates[1] + ((x / rect.width) - 0.5) * 0.05;
    const lat = preset.coordinates[0] - ((y / rect.height) - 0.5) * 0.05;
    onCoordinatesHover([lat, lon]);

    if (isDraggingSlider) {
      setSliderPosition(percent);
    }

    if (viewMode === 'magnifier') {
      setMagnifierPos({ x, y, show: true });
    }
  }, [isDraggingSlider, viewMode, preset.coordinates, onCoordinatesHover]);

  const handleMouseLeave = () => {
    setIsDraggingSlider(false);
    setMagnifierPos((prev) => ({ ...prev, show: false }));
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.75, Math.min(3, prev + delta)));
  };

  const resetView = () => {
    setZoomLevel(1);
    setSliderPosition(50);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 flex items-center justify-between z-20">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
          <button
            onClick={() => onViewModeChange('swipe')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'swipe'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Curtain Swipe</span>
          </button>

          <button
            onClick={() => onViewModeChange('side_by_side')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'side_by_side'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Dual Sync</span>
          </button>

          <button
            onClick={() => onViewModeChange('uncertainty_map')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'uncertainty_map'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
            <span>Uncertainty Heatmap</span>
          </button>

          <button
            onClick={() => onViewModeChange('magnifier')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'magnifier'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Pixel Loupe</span>
          </button>
        </div>

        {/* Zoom & Overlay Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1 transition-all cursor-pointer ${
              showGridOverlay
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GSD Grid</span>
          </button>

          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
            <button
              onClick={() => handleZoom(-0.25)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-cyan-300 font-semibold">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => handleZoom(0.25)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={resetView}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseUp={() => setIsDraggingSlider(false)}
        className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center cursor-crosshair"
      >
        {/* Inner Zoomable Canvas */}
        <div
          className="relative w-full h-full max-w-[850px] max-h-[850px] aspect-square transition-transform duration-100 ease-out flex items-center justify-center p-4"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Mode 1: Curtain Swipe */}
          {viewMode === 'swipe' && (
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-cyan-950/40">
              {/* Layer 1 (Full): Super-Resolved High Resolution */}
              <div className="absolute inset-0 w-full h-full">
                {/* Render High Res SVG */}
                <img
                  src={preset.superResImageUrl}
                  alt="Super-Resolved Output"
                  className="w-full h-full object-cover"
                />
                {/* High Res Badge */}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SUPER-RESOLVED ({scaleFactor === 4 ? '2.5m GSD' : '5.0m GSD'})</span>
                </div>
              </div>

              {/* Layer 2 (Clipped): Original Medium Resolution */}
              <div
                className="absolute inset-0 overflow-hidden border-r-2 border-cyan-400 shadow-2xl"
                style={{ width: `${sliderPosition}%` }}
              >
                <div className="absolute inset-0 w-[850px] h-[850px] max-w-none">
                  <img
                    src={preset.lowResImageUrl}
                    alt="Original Sentinel-2"
                    className="w-full h-full object-cover"
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                  />
                </div>
                {/* Low Res Badge */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-mono font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>ORIGINAL SENTINEL-2 (10m GSD)</span>
                </div>
              </div>

              {/* Interactive Divider Handle */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingSlider(true);
                }}
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 cursor-ew-resize z-30"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-bold hover:scale-110 transition-transform">
                  <SplitSquareVertical className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Side-by-Side Dual View */}
          {viewMode === 'side_by_side' && (
            <div className="grid grid-cols-2 gap-3 w-full h-full">
              {/* Left: Original 10m */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                <img
                  src={preset.lowResImageUrl}
                  alt="Original Sentinel-2"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-slate-300 text-[11px] font-mono font-semibold">
                  Original: 10m Sentinel-2
                </div>
              </div>

              {/* Right: Super-Resolved 2.5m */}
              <div className="relative rounded-xl overflow-hidden border border-cyan-800/60 bg-slate-900">
                <img
                  src={preset.superResImageUrl}
                  alt="Super Resolved"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500 text-cyan-300 text-[11px] font-mono font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  SRM: 2.5m Sub-Pixel
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Uncertainty Heatmap */}
          {viewMode === 'uncertainty_map' && (
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-amber-800/60 shadow-2xl">
              <img
                src={preset.superResImageUrl}
                alt="Base Image"
                className="w-full h-full object-cover"
              />
              <img
                src={preset.uncertaintyMapUrl}
                alt="Uncertainty Overlay"
                className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-85"
              />
              {/* Uncertainty Legend Bar */}
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-950/90 border border-amber-800/60 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Pixel Reconstruction Uncertainty & Variance
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    High variance in high-frequency edges
                  </span>
                </div>
                <div className="h-3 rounded-md bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 w-full" />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span className="text-emerald-400 font-semibold">Low (&lt; 0.05 σ)</span>
                  <span className="text-amber-400 font-semibold">Moderate (&lt; 0.15 σ)</span>
                  <span className="text-rose-400 font-semibold">High (&gt; 0.25 σ)</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode 4: Magnifier Loupe */}
          {viewMode === 'magnifier' && (
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <img
                src={preset.lowResImageUrl}
                alt="Original Sentinel-2"
                className="w-full h-full object-cover"
              />

              {magnifierPos.show && (
                <div
                  className="absolute w-44 h-44 rounded-full border-4 border-cyan-400 shadow-2xl overflow-hidden pointer-events-none z-30"
                  style={{
                    left: `${magnifierPos.x - 88}px`,
                    top: `${magnifierPos.y - 88}px`,
                  }}
                >
                  <div
                    className="w-[850px] h-[850px] absolute"
                    style={{
                      left: `${-magnifierPos.x * 2 + 88}px`,
                      top: `${-magnifierPos.y * 2 + 88}px`,
                      transform: 'scale(2)',
                      transformOrigin: 'top left',
                    }}
                  >
                    <img
                      src={preset.superResImageUrl}
                      alt="Magnified SR"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-2 inset-x-0 text-center text-[9px] font-mono font-bold text-cyan-300 bg-slate-950/80 py-0.5">
                    2.5m SRM Loupe (2x)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional GSD Scale Grid Overlay */}
          {showGridOverlay && (
            <div className="absolute inset-4 pointer-events-none border border-cyan-500/20 grid grid-cols-8 grid-rows-8 opacity-40">
              {Array.from({ length: 64 }).map((_, idx) => (
                <div key={idx} className="border border-cyan-500/10" />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Floating Map Scale & Info Bar */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-300 backdrop-blur-md z-20">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-200 font-semibold">{preset.title}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="w-12 h-1 bg-cyan-400 rounded-full inline-block" />
            <span className="text-slate-400">100m</span>
          </div>
        </div>
      </div>
    </div>
  );
};
