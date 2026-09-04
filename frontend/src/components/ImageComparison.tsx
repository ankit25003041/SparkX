'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  SplitSquareVertical, 
  Columns2, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Eye, 
  Sparkles,
  Layers,
  Compass
} from 'lucide-react';
import { BandCombination, ViewMode } from '../types/geosr';
import { formatCoords } from '../lib/utils';

interface ImageComparisonProps {
  lowResImageUrl: string;
  superResImageUrl: string;
  uncertaintyMapUrl?: string;
  title?: string;
  coordinates?: [number, number];
  scaleFactor?: number;
  initialMode?: ViewMode;
  bandCombination?: BandCombination;
  onBandCombinationChange?: (combo: BandCombination) => void;
  className?: string;
}

export const ImageComparison: React.FC<ImageComparisonProps> = ({
  lowResImageUrl,
  superResImageUrl,
  uncertaintyMapUrl,
  title = 'Satellite Image Comparison',
  coordinates = [28.6139, 77.2090],
  scaleFactor = 4,
  initialMode = 'swipe',
  bandCombination = 'RGB',
  onBandCombinationChange,
  className = '',
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number; show: boolean }>({
    x: 0,
    y: 0,
    show: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Drag handler for the swipe slider
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

      if (isDragging) {
        setSliderPosition((x / rect.width) * 100);
      }

      if (viewMode === 'magnifier') {
        setMagnifierPos({ x, y, show: true });
      }
    },
    [isDragging, viewMode]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!containerRef.current || !isDragging) return;
      const rect = containerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
    },
    [isDragging]
  );

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  // Get CSS filters depending on selected band combination
  const getFilterStyle = (combo: BandCombination) => {
    switch (combo) {
      case 'NIR_FALSE_COLOR':
        return 'hue-rotate(90deg) saturate(1.8) contrast(1.1)';
      case 'AGRICULTURE':
        return 'hue-rotate(50deg) saturate(1.6) brightness(1.05)';
      case 'GEOLOGY_SWIR':
        return 'sepia(0.8) hue-rotate(180deg) contrast(1.2)';
      case 'NDVI_HEATMAP':
        return 'invert(0.1) saturate(2.4) hue-rotate(80deg)';
      case 'RGB':
      default:
        return 'none';
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => {
        setIsDragging(false);
        setMagnifierPos((prev) => ({ ...prev, show: false }));
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
      className={`relative flex flex-col rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden select-none group shadow-xl ${className}`}
    >
      {/* Top Toolbar */}
      <div className="h-12 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        {/* Left: View Modes */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('swipe')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              viewMode === 'swipe'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Swipe</span>
          </button>

          <button
            onClick={() => setViewMode('side_by_side')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              viewMode === 'side_by_side'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dual</span>
          </button>

          <button
            onClick={() => setViewMode('magnifier')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              viewMode === 'magnifier'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Loupe</span>
          </button>
        </div>

        {/* Center: Band Selection Dropdown */}
        {onBandCombinationChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 hidden md:inline">Spectral:</span>
            <select
              value={bandCombination}
              onChange={(e) => onBandCombinationChange(e.target.value as BandCombination)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="RGB">True Color (RGB 4-3-2)</option>
              <option value="NIR_FALSE_COLOR">Color Infrared (NIR 8-4-3)</option>
              <option value="AGRICULTURE">Agriculture (SWIR 11-8-2)</option>
              <option value="NDVI_HEATMAP">NDVI Vegetation Index</option>
            </select>
          </div>
        )}

        {/* Right: Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-slate-400">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
              className="p-1 hover:text-white hover:bg-slate-900 rounded"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
              className="p-1 hover:text-white hover:bg-slate-900 rounded"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:text-white hover:bg-slate-900 rounded ml-1"
              title="Reset Zoom"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
            title="Toggle fullscreen"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full min-h-[420px] max-h-[640px] overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* Mode 1: Swipe (Curtain Wipe) */}
        {viewMode === 'swipe' && (
          <div className="relative w-full h-full overflow-hidden">
            {/* Background Layer: Super-Resolved (Output 2.5m) */}
            <div
              className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-100"
              style={{
                transform: `scale(${zoomLevel})`,
                filter: getFilterStyle(bandCombination),
              }}
            >
              <img
                src={superResImageUrl}
                alt="Super Resolved Satellite"
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>

            {/* Foreground Clipped Layer: Low Resolution (Input 10m) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
              }}
            >
              <div
                className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-100"
                style={{
                  transform: `scale(${zoomLevel})`,
                  filter: getFilterStyle(bandCombination),
                }}
              >
                <img
                  src={lowResImageUrl}
                  alt="Original Sentinel-2 Input"
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Split Slider Handle Bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 cursor-ew-resize select-none"
              style={{ left: `${sliderPosition}%` }}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
            >
              {/* Central Drag Knob */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-slate-950/90 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950/80 text-cyan-300">
                <SplitSquareVertical className="w-4 h-4" />
              </div>
            </div>

            {/* Labels overlay */}
            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-300 shadow-md">
                INPUT: Sentinel-2 10.0m GSD
              </span>
            </div>
            <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-600 text-cyan-300 shadow-md">
                OUTPUT: GeoSR 2.5m GSD ({scaleFactor}x)
              </span>
            </div>
          </div>
        )}

        {/* Mode 2: Side-by-Side Dual Pane */}
        {viewMode === 'side_by_side' && (
          <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
            {/* Left Pane: Low Res */}
            <div className="relative h-full overflow-hidden flex items-center justify-center">
              <div
                className="w-full h-full"
                style={{
                  transform: `scale(${zoomLevel})`,
                  filter: getFilterStyle(bandCombination),
                }}
              >
                <img
                  src={lowResImageUrl}
                  alt="Original Sentinel-2 Input"
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              </div>
              <div className="absolute bottom-3 left-3 z-10">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700 text-slate-300">
                  Input: Sentinel-2 10m GSD
                </span>
              </div>
            </div>

            {/* Right Pane: Super Res */}
            <div className="relative h-full overflow-hidden flex items-center justify-center">
              <div
                className="w-full h-full"
                style={{
                  transform: `scale(${zoomLevel})`,
                  filter: getFilterStyle(bandCombination),
                }}
              >
                <img
                  src={superResImageUrl}
                  alt="GeoSR Output"
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              </div>
              <div className="absolute bottom-3 right-3 z-10">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-600 text-cyan-300">
                  Output: GeoSR 2.5m GSD ({scaleFactor}x)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Magnifier Loupe */}
        {viewMode === 'magnifier' && (
          <div className="relative w-full h-full overflow-hidden cursor-crosshair">
            {/* Low Res Base Image */}
            <div
              className="w-full h-full"
              style={{
                transform: `scale(${zoomLevel})`,
                filter: getFilterStyle(bandCombination),
              }}
            >
              <img
                src={lowResImageUrl}
                alt="Base Satellite"
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>

            {/* Hover Magnifier Loupe showing Super-Res */}
            {magnifierPos.show && (
              <div
                className="absolute pointer-events-none rounded-full border-2 border-cyan-400 shadow-2xl overflow-hidden z-30"
                style={{
                  width: '180px',
                  height: '180px',
                  left: `${magnifierPos.x - 90}px`,
                  top: `${magnifierPos.y - 90}px`,
                }}
              >
                <div
                  className="absolute w-[800px] h-[600px]"
                  style={{
                    left: `${-magnifierPos.x * 2 + 90}px`,
                    top: `${-magnifierPos.y * 2 + 90}px`,
                    transform: 'scale(2)',
                    transformOrigin: 'top left',
                    filter: getFilterStyle(bandCombination),
                  }}
                >
                  <img
                    src={superResImageUrl}
                    alt="Magnified 4x High Resolution"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Loupe Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-0.5 bg-cyan-400/80" />
                  <div className="h-4 w-0.5 bg-cyan-400/80 absolute" />
                </div>
                <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-mono text-cyan-300 bg-slate-950/80">
                  4x SR LOUPE
                </div>
              </div>
            )}

            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-300">
                Hover cursor to inspect 4x enhanced sub-pixel textures
              </span>
            </div>
          </div>
        )}

        {/* Live Coordinate Overlay Badge */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>{formatCoords(coordinates[0], coordinates[1])}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
