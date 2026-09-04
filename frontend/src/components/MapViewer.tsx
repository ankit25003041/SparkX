'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, ImageOverlay, Rectangle, LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ScenePreset } from '../types/geosr';
import { MapOverlayId } from './LayerControl';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';
import { formatCoords } from '../lib/utils';

interface MapViewerProps {
  preset: ScenePreset;
  activeOverlay: MapOverlayId;
  overlayOpacity: number; // 0 - 100
  isBeforeAfterToggled: boolean;
  showTileBoundaries: boolean;
  onCoordinatesHover?: (coords: [number, number]) => void;
  className?: string;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  preset,
  activeOverlay,
  overlayOpacity,
  isBeforeAfterToggled,
  showTileBoundaries,
  onCoordinatesHover,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const overlayLayerRef = useRef<ImageOverlay | null>(null);
  const gridLayerRef = useRef<Rectangle | null>(null);

  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [hoverCoords, setHoverCoords] = useState<[number, number]>(preset.coordinates);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to avoid SSR window errors
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up existing instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: preset.coordinates,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Base Satellite Tile Layer (Esri World Imagery)
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Esri, Maxar, Earthstar Geographics',
        }
      );
      satelliteLayer.addTo(map);

      // Track cursor coordinates
      map.on('mousemove', (e: LeafletMouseEvent) => {
        const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
        setHoverCoords(coords);
        onCoordinatesHover?.(coords);
      });

      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // Add image overlay for the scene bounding box
      const halfSize = 0.025; // ~2.5km box
      const bounds = L.latLngBounds(
        [preset.coordinates[0] - halfSize, preset.coordinates[1] - halfSize],
        [preset.coordinates[0] + halfSize, preset.coordinates[1] + halfSize]
      );

      // Initial overlay
      const overlayUrl = isBeforeAfterToggled
        ? preset.superResImageUrl
        : preset.lowResImageUrl;

      const overlay = L.imageOverlay(overlayUrl, bounds, {
        opacity: overlayOpacity / 100,
        interactive: false,
      });
      overlay.addTo(map);
      overlayLayerRef.current = overlay;

      // Grid overlay if enabled
      if (showTileBoundaries) {
        const grid = L.rectangle(bounds, {
          color: '#06b6d4',
          weight: 1.5,
          dashArray: '4, 4',
          fillOpacity: 0.05,
        });
        grid.addTo(map);
        gridLayerRef.current = grid;
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [preset.id]);

  // Update center when preset changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(preset.coordinates, 14, { animate: true });
    }
  }, [preset.coordinates]);

  // Update overlay opacity & image when props change
  useEffect(() => {
    if (overlayLayerRef.current) {
      const targetOpacity = activeOverlay === 'none' ? 0 : overlayOpacity / 100;
      overlayLayerRef.current.setOpacity(targetOpacity);

      let targetUrl = preset.superResImageUrl;
      if (activeOverlay === 'confidence_overlay') {
        targetUrl = preset.uncertaintyMapUrl;
      } else if (!isBeforeAfterToggled && activeOverlay === 'sr_overlay') {
        targetUrl = preset.lowResImageUrl;
      }
      overlayLayerRef.current.setUrl(targetUrl);
    }
  }, [activeOverlay, overlayOpacity, isBeforeAfterToggled, preset]);

  // Zoom controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleReset = () => mapInstanceRef.current?.setView(preset.coordinates, 14);

  return (
    <div className={`relative w-full h-full bg-slate-950 overflow-hidden ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Scene Title & Geodetic HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-md shadow-xl max-w-sm pointer-events-auto">
          <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
            Active Satellite Scene
          </div>
          <div className="text-sm font-bold text-white mt-0.5 truncate">
            {preset.title}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            {preset.crs} • Cloud: {preset.cloudCoverPercent}%
          </div>
        </div>
      </div>

      {/* Floating Coordinates Telemetry Crosshair (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur-md text-xs font-mono shadow-xl text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>CURSOR:</span>
          <span className="text-cyan-300 font-semibold">
            {formatCoords(hoverCoords[0], hoverCoords[1])}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">ZOOM: {currentZoom}x</span>
        </div>
      </div>

      {/* Floating Zoom Controls (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Reset Center"
          aria-label="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
