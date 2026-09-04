'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Map as MapIcon } from 'lucide-react';
import { SCENE_PRESETS } from '../../lib/mockData';
import { ScenePreset } from '../../types/geosr';
import { LayerControl, MapOverlayId } from '../../components/LayerControl';
import { LoadingState } from '../../components/LoadingState';

// Dynamically import Leaflet MapViewer with ssr: false
const MapViewer = dynamic(
  () => import('../../components/MapViewer').then((mod) => mod.MapViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <LoadingState
          message="Initializing Leaflet GIS Canvas..."
          submessage="Loading Esri World Imagery tiles and Sentinel-2 georeferenced rasters"
        />
      </div>
    ),
  }
);

function GISExplorerContent() {
  const searchParams = useSearchParams();
  const sceneParam = searchParams.get('scene');

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const selectedPreset: ScenePreset = 
    (selectedPresetId ? SCENE_PRESETS.find((p) => p.id === selectedPresetId) : null) ||
    (sceneParam ? SCENE_PRESETS.find((p) => p.id === sceneParam) : null) ||
    SCENE_PRESETS[0];

  const [activeOverlay, setActiveOverlay] = useState<MapOverlayId>('sr_overlay');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [isBeforeAfterToggled, setIsBeforeAfterToggled] = useState<boolean>(true);
  const [showTileBoundaries, setShowTileBoundaries] = useState<boolean>(false);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden relative select-none">
      {/* Top GIS Status Bar */}
      <div className="h-11 bg-slate-950/95 border-b border-slate-800 px-4 flex items-center justify-between z-30 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <MapIcon className="w-3.5 h-3.5" />
            <span>GIS EXPLORER</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">SCENE:</span>
            <select
              value={selectedPreset.id}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-cyan-300 focus:outline-none"
            >
              {SCENE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title} ({preset.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-slate-400 text-[11px]">
          <span>PROJECTION: <strong className="text-slate-200">{selectedPreset.crs}</strong></span>
          <span>•</span>
          <span>NATIVE GSD: <strong className="text-slate-200">10.0m</strong></span>
          <span>•</span>
          <span>SR GSD: <strong className="text-cyan-300">2.5m (4x)</strong></span>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="flex-1 relative w-full h-full">
        <MapViewer
          preset={selectedPreset}
          activeOverlay={activeOverlay}
          overlayOpacity={overlayOpacity}
          isBeforeAfterToggled={isBeforeAfterToggled}
          showTileBoundaries={showTileBoundaries}
        />

        {/* Floating GIS Layer Controls Drawer (Top Right) */}
        <div className="absolute top-4 right-4 z-20 w-72 sm:w-80">
          <LayerControl
            activeOverlay={activeOverlay}
            onSelectOverlay={setActiveOverlay}
            overlayOpacity={overlayOpacity}
            onOpacityChange={setOverlayOpacity}
            isBeforeAfterToggled={isBeforeAfterToggled}
            onToggleBeforeAfter={() => setIsBeforeAfterToggled(!isBeforeAfterToggled)}
            showTileBoundaries={showTileBoundaries}
            onToggleTileBoundaries={() => setShowTileBoundaries(!showTileBoundaries)}
          />
        </div>
      </div>
    </div>
  );
}

export default function GISExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 h-[calc(100vh-4rem)]">
          <LoadingState message="Loading GIS Explorer..." />
        </div>
      }
    >
      <GISExplorerContent />
    </Suspense>
  );
}
