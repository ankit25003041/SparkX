'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Download, 
  FileText, 
  Map, 
  Sparkles, 
  ShieldCheck, 
  Compass, 
  Clock, 
  Layers, 
  Activity
} from 'lucide-react';
import { ImageComparison } from '../../../components/ImageComparison';
import { MetricCard } from '../../../components/MetricCard';
import { ConfidenceMap } from '../../../components/ConfidenceMap';
import { StatusBadge } from '../../../components/StatusBadge';
import { SCENE_PRESETS } from '../../../lib/mockData';
import { BandCombination, ScenePreset, ValidationMetrics } from '../../../types/geosr';

export default function ResultsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : 'geosr_delhi_01';

  // Match preset scene
  const matchedPreset: ScenePreset = SCENE_PRESETS.find(
    (p) => p.id === id || id.includes(p.id.replace('s2_', ''))
  ) || SCENE_PRESETS[0];

  const [bandCombo, setBandCombo] = useState<BandCombination>('RGB');
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

  const metrics: ValidationMetrics = matchedPreset.defaultMetrics;

  const showNotification = (msg: string) => {
    setDownloadNotification(msg);
    setTimeout(() => setDownloadNotification(null), 4000);
  };

  // Simulated GeoTIFF download
  const handleDownloadGeoTIFF = () => {
    const filename = `GeoSR_Sentinel2_4x_${matchedPreset.id}_EPSG32643.tif`;
    showNotification(`Downloading Cloud-Optimized GeoTIFF: ${filename}`);

    // Create a mock blob download
    const blob = new Blob([`GeoSR Cloud-Optimized GeoTIFF Mock Data for ${matchedPreset.title}`], {
      type: 'image/tiff',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simulated Report download
  const handleDownloadReport = () => {
    const filename = `GeoSR_Validation_Report_${matchedPreset.id}.json`;
    showNotification(`Downloading SIH Compliance Report: ${filename}`);

    const reportData = {
      project: 'GeoSR — AI Satellite Super-Resolution Mapping',
      sihProblemStatement: 'SIH 2026 #26142',
      disclaimer: 'DEMO DATA — Simulated AI Inference for SIH 2026 Prototype',
      scene: {
        id: matchedPreset.id,
        title: matchedPreset.title,
        location: matchedPreset.location,
        crs: matchedPreset.crs,
        cloudCoverPercent: matchedPreset.cloudCoverPercent,
        acquisitionDate: matchedPreset.acquisitionDate,
      },
      resolution: {
        inputGsdMeters: 10.0,
        outputGsdMeters: 2.5,
        scaleFactor: 4,
      },
      metrics: {
        psnrDb: metrics.psnr,
        ssim: metrics.ssim,
        samDegrees: metrics.sam,
        ergas: metrics.ergas,
        uiqi: metrics.uiqi,
        inferenceTimeMs: metrics.inferenceTimeMs,
      },
      spectralPreservation: matchedPreset.spectralPoints,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Toast Notification */}
      {downloadNotification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-cyan-950 border border-cyan-500 text-cyan-200 text-xs font-mono shadow-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{downloadNotification}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Prominent Demo Watermark Alert */}
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-4 text-xs font-mono text-amber-300">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-900/80 font-bold border border-amber-700">
              DEMO DATA
            </span>
            <span>
              Simulated AI Inference & Sentinel-2 Telemetry for SIH 2026 Prototype Demonstration.
            </span>
          </div>
          <span className="hidden md:inline text-amber-400/70">
            Real deep-learning model weights will attach in Phase 2
          </span>
        </div>

        {/* Header with Title, Badges & Top Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Analysis Results • Scene ID: {matchedPreset.id}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {matchedPreset.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono mt-1">
              <span>{matchedPreset.location}</span>
              <span>•</span>
              <span>{matchedPreset.crs}</span>
              <span>•</span>
              <span>Cloud: {matchedPreset.cloudCoverPercent}%</span>
              <span>•</span>
              <StatusBadge status="completed" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/explorer?scene=${matchedPreset.id}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <Map className="w-3.5 h-3.5 text-cyan-400" />
              Open in GIS Explorer
            </Link>

            <button
              onClick={handleDownloadGeoTIFF}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-cyan-950/50"
            >
              <Download className="w-3.5 h-3.5" />
              Download GeoTIFF
            </button>

            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Evaluation Report
            </button>
          </div>
        </div>

        {/* Resolution Enhancement Banner Pill */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/50 flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Input Resolution:</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-bold text-xs">
                10.0m GSD
              </span>
            </div>
            <span className="text-cyan-400 text-sm font-bold">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300">Super-Resolved Output:</span>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold text-xs shadow-sm">
                2.5m GSD (4x Boost)
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span>Pixel Density: <strong className="text-white">16x Increase</strong></span>
            <span className="text-slate-700">•</span>
            <span>Latency: <strong className="text-emerald-400">{metrics.inferenceTimeMs} ms</strong></span>
          </div>
        </div>

        {/* Main Interactive Image Comparison Slider */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              High-Fidelity Spatial Comparison
            </h2>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Drag central slider to wipe between 10m Input and 2.5m Super-Resolved Output
            </span>
          </div>

          <ImageComparison
            lowResImageUrl={matchedPreset.lowResImageUrl}
            superResImageUrl={matchedPreset.superResImageUrl}
            uncertaintyMapUrl={matchedPreset.uncertaintyMapUrl}
            title={matchedPreset.title}
            coordinates={matchedPreset.coordinates}
            scaleFactor={4}
            initialMode="swipe"
            bandCombination={bandCombo}
            onBandCombinationChange={setBandCombo}
          />
        </section>

        {/* Validation Metrics Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Quantitative Validation Metrics
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
              DEMO BENCHMARK VALUES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Peak Signal-to-Noise Ratio"
              value={metrics.psnr}
              unit="dB"
              delta="+6.42 dB"
              deltaType="positive"
              benchmark="> 30 dB"
              description="Mathematical measurement of reconstruction sharpness and fidelity."
              icon={<Sparkles className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Structural Similarity (SSIM)"
              value={metrics.ssim}
              delta="+0.182"
              deltaType="positive"
              benchmark="> 0.88"
              description="Evaluates edge structures, building shapes, and road continuities."
              icon={<ShieldCheck className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Spectral Angle Mapper (SAM)"
              value={metrics.sam}
              unit="°"
              delta="-4.80°"
              deltaType="positive"
              benchmark="< 3.0°"
              description="Measures multispectral vector angle deviation across all 12 bands."
              icon={<Compass className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Global Dimensionless Error (ERGAS)"
              value={metrics.ergas}
              delta="-1.58"
              deltaType="positive"
              benchmark="< 2.50"
              description="Relative dimensionless synthesis error across all spectral channels."
              icon={<Clock className="w-5 h-5" />}
              isDemo={true}
            />
          </div>
        </section>

        {/* Confidence & Uncertainty Map Component */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Model Epistemic Confidence & Anomaly Heatmap
          </h2>
          <ConfidenceMap uncertaintyMapUrl={matchedPreset.uncertaintyMapUrl} />
        </section>

        {/* Spectral Reflectance Profile Table */}
        <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                12-Band Multispectral Preservation Table
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Comparison of raw Sentinel-2 BOA reflectance vs Super-Resolved reflectance values.
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Mean Deviation: &lt; 1.2%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="pb-2 font-medium">BAND</th>
                  <th className="pb-2 font-medium">NAME</th>
                  <th className="pb-2 font-medium">WAVELENGTH</th>
                  <th className="pb-2 font-medium">INPUT REFLECTANCE</th>
                  <th className="pb-2 font-medium">SUPER-RES REFLECTANCE</th>
                  <th className="pb-2 font-medium">DEVIATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {matchedPreset.spectralPoints.map((point) => (
                  <tr key={point.band} className="hover:bg-slate-950/40 transition-colors">
                    <td className="py-2.5 font-bold text-cyan-400">{point.band}</td>
                    <td className="py-2.5 text-slate-200">{point.name}</td>
                    <td className="py-2.5 text-slate-400">{point.wavelengthNm} nm</td>
                    <td className="py-2.5">{point.originalReflectance.toFixed(3)}</td>
                    <td className="py-2.5 text-slate-100 font-semibold">{point.srReflectance.toFixed(3)}</td>
                    <td className="py-2.5">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                          Math.abs(point.diffPercent) < 1.0
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                            : 'bg-amber-950 text-amber-400 border border-amber-800/80'
                        }`}
                      >
                        {point.diffPercent > 0 ? `+${point.diffPercent}%` : `${point.diffPercent}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
