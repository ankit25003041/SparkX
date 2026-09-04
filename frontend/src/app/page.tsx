'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { SidebarControls } from '../components/SidebarControls';
import { MapComparisonViewer } from '../components/MapComparisonViewer';
import { SpectralInspector } from '../components/SpectralInspector';
import { MetricsDashboard } from '../components/MetricsDashboard';
import { ExportModal } from '../components/ExportModal';
import { SystemArchitectureModal } from '../components/SystemArchitectureModal';
import { SCENE_PRESETS } from '../lib/constants';
import { 
  ScenePreset, 
  SuperResolutionModelId, 
  ScaleFactor, 
  BandCombination, 
  ViewMode, 
  GeoTIFFMetadata, 
  ProcessingState,
  ValidationMetrics,
  SpectralPoint
} from '../types/geosr';
import { geoSRApi } from '../services/api';

export default function GeoSRDashboardPage() {
  const [selectedPreset, setSelectedPreset] = useState<ScenePreset>(SCENE_PRESETS[0]);
  const [selectedModel, setSelectedModel] = useState<SuperResolutionModelId>('geosr_esrgan');
  const [scaleFactor, setScaleFactor] = useState<ScaleFactor>(4);
  const [bandCombination, setBandCombination] = useState<BandCombination>('RGB');
  const [viewMode, setViewMode] = useState<ViewMode>('swipe');
  const [overlapPercent, setOverlapPercent] = useState<number>(20);
  const [currentCoords, setCurrentCoords] = useState<[number, number]>(selectedPreset.coordinates);
  const [customMetadata, setCustomMetadata] = useState<GeoTIFFMetadata | null>(null);

  const [metrics, setMetrics] = useState<ValidationMetrics>(selectedPreset.defaultMetrics);
  const [spectralPoints, setSpectralPoints] = useState<SpectralPoint[]>(selectedPreset.spectralPoints);

  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    elapsedSeconds: 0,
  });

  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Handle Preset Selection
  const handleSelectPreset = (preset: ScenePreset) => {
    setSelectedPreset(preset);
    setCustomMetadata(null);
    setCurrentCoords(preset.coordinates);
    setMetrics(preset.defaultMetrics);
    setSpectralPoints(preset.spectralPoints);
    setProcessingState({ status: 'idle', progress: 0, elapsedSeconds: 0 });
  };

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    try {
      const meta = await geoSRApi.inspectGeoTIFF(file);
      setCustomMetadata(meta);
      setCurrentCoords(meta.center);
    } catch (err) {
      console.error('Failed to parse uploaded file:', err);
      alert('Could not parse GeoTIFF headers. Please ensure the file has valid projection tags.');
    }
  };

  // Run Super-Resolution Pipeline
  const handleRunSuperResolution = async () => {
    setProcessingState({
      status: 'processing',
      stage: 'Initializing Sentinel-2 SRM Pipeline...',
      progress: 5,
      elapsedSeconds: 0,
    });

    try {
      const result = await geoSRApi.submitSuperResolutionJob(
        {
          file: customMetadata ? undefined : undefined,
          presetId: selectedPreset.id,
          model: selectedModel,
          scaleFactor: scaleFactor,
          bandCombination: bandCombination,
          overlapPercent: overlapPercent,
          tileSize: 256,
          useTiling: true,
        },
        (progress) => {
          setProcessingState({
            status: progress.status === 'completed' ? 'completed' : 'processing',
            stage: progress.stage,
            progress: progress.progressPercent,
            elapsedSeconds: Math.round(progress.elapsedMs / 1000),
          });

          if (progress.metrics) {
            setMetrics(progress.metrics);
          }
        }
      );

      if (result.metrics) {
        setMetrics(result.metrics);
      }
    } catch (e: any) {
      setProcessingState({
        status: 'error',
        progress: 0,
        elapsedSeconds: 0,
        errorMessage: e.message || 'Super-Resolution inference failed',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        currentCoords={currentCoords}
        crs={customMetadata ? customMetadata.crs : selectedPreset.crs}
        isProcessing={processingState.status === 'processing'}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Main Workspace (3-Column Layout: Controls | Visualizer | Spectral Analysis) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Sidebar: Controls */}
        <SidebarControls
          selectedPreset={selectedPreset}
          onSelectPreset={handleSelectPreset}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          scaleFactor={scaleFactor}
          onSelectScaleFactor={setScaleFactor}
          bandCombination={bandCombination}
          onSelectBandCombination={setBandCombination}
          overlapPercent={overlapPercent}
          onOverlapChange={setOverlapPercent}
          customMetadata={customMetadata}
          onFileUpload={handleFileUpload}
          processingState={processingState}
          onRunSuperResolution={handleRunSuperResolution}
        />

        {/* Center: Map Comparison Viewport */}
        <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-4rem)] overflow-hidden">
          <MapComparisonViewer
            preset={selectedPreset}
            bandCombination={bandCombination}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCoordinatesHover={setCurrentCoords}
            scaleFactor={scaleFactor}
            isProcessing={processingState.status === 'processing'}
          />

          {/* Bottom Bar: Metrics */}
          <MetricsDashboard metrics={metrics} scaleFactor={scaleFactor} />
        </main>

        {/* Right Sidebar: Spectral & Radiometric Inspector */}
        <SpectralInspector spectralPoints={spectralPoints} />
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        preset={selectedPreset}
        metrics={metrics}
        scaleFactor={scaleFactor}
      />

      <SystemArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </div>
  );
}
