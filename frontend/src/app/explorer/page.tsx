'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Map as MapIcon } from 'lucide-react';
import { SCENE_PRESETS } from '../../lib/mockData';
import { fetchJobResults } from '../../lib/api';
import { ScenePreset, JobResultsResponse } from '../../types/geosr';
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
  const jobParam = searchParams.get('job');

  const fallbackPreset: ScenePreset =
    (sceneParam ? SCENE_PRESETS.find((p) => p.id === sceneParam) : null) || SCENE_PRESETS[0];

  const [selectedPreset, setSelectedPreset] = useState<ScenePreset>(fallbackPreset);
  const [activeOverlay, setActiveOverlay] = useState<MapOverlayId>('sr_overlay');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [isBeforeAfterToggled, setIsBeforeAfterToggled] = useState<boolean>(true);
  const [showTileBoundaries, setShowTileBoundaries] = useState<boolean>(false);
  const [isRealData, setIsRealData] = useState<boolean>(false);

  // When a real job id is supplied, fetch its preview rasters from the backend
  // and override the demo preset URLs so the GIS explorer renders live SR output.
  useEffect(() => {
    if (!jobParam) return;
    let cancelled = false;
    fetchJobResults(jobParam).then((r: JobResultsResponse | null) => {
      if (!r || !r.metadata || cancelled) return;
      const meta = r.metadata;
      setSelectedPreset((prev) => ({
        ...prev,
        id: `job_${jobParam}`,
        title: meta.filename || prev.title,
        crs: meta.crs || prev.crs,
        cloudCoverPercent: meta.cloudCoverPercent,
        coordinates: (meta.center as [number, number]) || prev.coordinates,
        lowResImageUrl: r.low_res_preview_url || prev.lowResImageUrl,
        superResImageUrl: r.super_res_preview_url || prev.superResImageUrl,
        uncertaintyMapUrl: r.uncertainty_map_url || prev.uncertaintyMapUrl,
      }));
      setIsRealData(true);
    });
    return () => {
      cancelled = true;
    };
  }, [jobParam]);

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
            {jobParam ? (
              <span className="text-xs text-emerald-300 font-mono">
                Real Job: <span className="text-cyan-300">{selectedPreset.title}</span>
              </span>
            ) : (
              <>
                <span className="text-slate-500">SCENE:</span>
                <select
                  value={selectedPreset.id}
                  onChange={(e) => setSelectedPreset(
                    SCENE_PRESETS.find((p) => p.id === e.target.value) || SCENE_PRESETS[0]
                  )}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-cyan-300 focus:outline-none"
                >
                  {SCENE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.title} ({preset.category})
                    </option>
                  ))}
                </select>
              </>
            )}
            {isRealData && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                LIVE DATA
              </span>
            )}
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
