'use client';

import React, { useEffect, useState } from 'react';
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
  Layers,
} from 'lucide-react';
import { ImageComparison } from '../../../components/ImageComparison';
import { MetricCard } from '../../../components/MetricCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { ValidationSummary } from '../../../components/ValidationSummary';
import { SCENE_PRESETS } from '../../../lib/mockData';
import {
  BandCombination,
  ScenePreset,
  SpectralPoint,
  ValidationMetrics,
  ValidationReport,
  JobResultsResponse,
} from '../../../types/geosr';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return 'N/A';
  return v.toFixed(digits);
}

export default function ResultsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : 'geosr_delhi_01';

  const matchedPreset: ScenePreset =
    SCENE_PRESETS.find((p) => p.id === id || id.includes(p.id.replace('s2_', ''))) ||
    SCENE_PRESETS[0];

  const [bandCombo, setBandCombo] = useState<BandCombination>('RGB');
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);
  const [results, setResults] = useState<JobResultsResponse | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);

  const isReal = !!results && !results.is_demo && !!report;
  const isDemo = !isReal;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${API_BASE}/api/jobs/${id}/results`, { cache: 'no-store' });
        if (r.ok) {
          const data = (await r.json()) as JobResultsResponse;
          if (!cancelled) setResults(data);
        }
      } catch {
        if (!cancelled) setResults(null);
      }
      try {
        const rp = await fetch(`${API_BASE}/api/jobs/${id}/validation-report`, { cache: 'no-store' });
        if (rp.ok) {
          const data = (await rp.json()) as ValidationReport;
          if (!cancelled) setReport(data);
        }
      } catch {
        if (!cancelled) setReport(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const showNotification = (msg: string) => {
    setDownloadNotification(msg);
    setTimeout(() => setDownloadNotification(null), 4000);
  };

  const handleDownloadGeoTIFF = () => {
    if (results?.download_url) {
      window.open(results.download_url, '_blank', 'noopener,noreferrer');
      showNotification(`Downloading Cloud-Optimized GeoTIFF via backend stream`);
      return;
    }
    const filename = `GeoSR_Sentinel2_2x_${isReal ? id : matchedPreset.id}_EPSG32643.tif`;
    showNotification(`Downloading Cloud-Optimized GeoTIFF: ${filename}`);
  };

  const handleDownloadReport = () => {
    if (results?.validation_report_url) {
      window.open(results.validation_report_url, '_blank', 'noopener,noreferrer');
      showNotification(`Downloading validation report`);
      return;
    }
    showNotification(
      report
        ? `Downloading validation report: GeoSR_Validation_Report_${matchedPreset.id}.json`
        : `Downloading SIH Compliance Report: GeoSR_Validation_Report_${matchedPreset.id}.json`
    );
  };

  // Real metrics come from the validation report; demo metrics come from the preset.
  const realMetrics: ValidationReport | null = report;
  const demoMetrics: ValidationMetrics = matchedPreset.defaultMetrics;

  const referenceAvailable = !!report?.reference_available;

  type WireSpectralPoint = {
    band: string;
    name: string;
    wavelength_nm?: number;
    original_reflectance?: number;
    sr_reflectance?: number;
    diff_percent?: number;
  };
  const spectralRows: SpectralPoint[] =
    isReal && results?.spectral_points?.length
      ? (results.spectral_points as WireSpectralPoint[]).map((sp) => ({
          band: (sp.band || 'B02') as SpectralPoint['band'],
          name: sp.name || sp.band,
          wavelengthNm: sp.wavelength_nm ?? 0,
          originalReflectance: sp.original_reflectance ?? 0,
          srReflectance: sp.sr_reflectance ?? 0,
          diffPercent: sp.diff_percent ?? 0,
        }))
      : matchedPreset.spectralPoints;

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
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Analysis Results • Scene ID: {matchedPreset.id}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isReal ? (results?.metadata?.filename || id) : matchedPreset.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
              <span>{isReal ? (results?.metadata?.filename || id) : matchedPreset.location}</span>
              <span>•</span>
              <span>{isReal ? (results?.metadata?.crs || matchedPreset.crs) : matchedPreset.crs}</span>
              <span>•</span>
              <span>
                Scale: {isReal
                  ? `${realMetrics?.scale_factor ?? 2}x (${fmt(realMetrics?.input_gsd_meters ?? 10, 1)}m -&gt; ${fmt(realMetrics?.output_gsd_meters ?? 5, 1)}m)`
                  : `${matchedPreset.cloudCoverPercent}% cloud`}
              </span>
              <span>•</span>
              <StatusBadge status="completed" showIcon={true} />
            </div>
          </div>

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
            {report && (
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Validation Report
              </button>
            )}
          </div>
        </div>

        {/* Resolution Enhancement Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/50 flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Input Resolution:</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-bold text-xs">
                 {fmt(realMetrics?.input_gsd_meters ?? 10, 1)}m GSD
              </span>
            </div>
            <span className="text-cyan-400 text-sm font-bold">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300">Super-Resolved Output:</span>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold text-xs shadow-sm">
                {realMetrics?.output_gsd_meters
                  ? `${realMetrics.output_gsd_meters.toFixed(1)}m GSD (${realMetrics.scale_factor ?? 2}x Boost)`
                  : '5m GSD (2x Boost)'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span>Spatial Upscaling: <strong className="text-white">2x (10 m -&gt; 5 m)</strong></span>
            <span className="text-slate-700">•</span>
            <span>Latency: <strong className="text-emerald-400">{fmt(realMetrics ? undefined : demoMetrics.inferenceTimeMs)} ms</strong></span>
          </div>
        </div>

        {/* Image Comparison */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              High-Fidelity Spatial Comparison
            </h2>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Drag central slider to wipe between {fmt(realMetrics?.input_gsd_meters ?? 10, 1)}m Input and{' '}
              {fmt(realMetrics?.output_gsd_meters ?? 5.0, 1)}m Super-Resolved Output
            </span>
          </div>
          <ImageComparison
            lowResImageUrl={results?.low_res_preview_url || matchedPreset.lowResImageUrl}
            superResImageUrl={results?.super_res_preview_url || matchedPreset.superResImageUrl}
            uncertaintyMapUrl={results?.uncertainty_map_url || matchedPreset.uncertaintyMapUrl}
            title={matchedPreset.title}
            coordinates={matchedPreset.coordinates}
            scaleFactor={realMetrics?.scale_factor ?? 2}
            initialMode="swipe"
            bandCombination={bandCombo}
            onBandCombinationChange={setBandCombo}
          />
        </section>

        {/* Validation Metrics Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              {isReal ? 'Quantitative Validation Metrics' : 'Quantitative Validation Metrics (Demo)'}
            </h2>
            {isDemo && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
                SAMPLE VALUES (no live run)
              </span>
            )}
            {isReal && !referenceAvailable && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
                Full-reference metrics unavailable
              </span>
            )}
          </div>
          {isReal && !referenceAvailable && (
            <p className="text-xs text-slate-400 mt-1">
              No HR ground truth is available for this satellite scene.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isReal ? (
              <>
                <MetricCard
                  label="Peak Signal-to-Noise Ratio"
                  value={fmt(realMetrics?.psnr, 2)}
                  unit="dB"
                  benchmark="> 30 dB"
                  description="Reconstruction fidelity vs HR ground truth."
                  icon={<Sparkles className="w-5 h-5" />}
                />
                <MetricCard
                  label="Structural Similarity (SSIM)"
                  value={fmt(realMetrics?.ssim, 3)}
                  benchmark="> 0.88"
                  description="Edge structures, building shapes, road continuity."
                  icon={<ShieldCheck className="w-5 h-5" />}
                />
                <MetricCard
                  label="Spectral Angle Mapper (SAM)"
                  value={fmt(realMetrics?.sam, 2)}
                  unit="°"
                  benchmark="< 3.0°"
                  description="Multispectral vector angle deviation."
                  icon={<Compass className="w-5 h-5" />}
                />
                <MetricCard
                  label="Global Error (ERGAS)"
                  value={fmt(realMetrics?.ergas, 2)}
                  benchmark="< 2.50"
                  description="Relative dimensionless spectral error."
                  icon={<Layers className="w-5 h-5" />}
                />
              </>
            ) : (
              <>
                <MetricCard
                  label="Peak Signal-to-Noise Ratio"
                  value={fmt(demoMetrics.psnr)}
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
                  value={fmt(demoMetrics.ssim, 3)}
                  delta="+0.182"
                  deltaType="positive"
                  benchmark="> 0.88"
                  description="Evaluates edge structures, building shapes, and road continuities."
                  icon={<ShieldCheck className="w-5 h-5" />}
                  isDemo={true}
                />
                <MetricCard
                  label="Spectral Angle Mapper (SAM)"
                  value={fmt(demoMetrics.sam)}
                  unit="°"
                  delta="-4.80°"
                  deltaType="positive"
                  benchmark="< 3.0°"
                  description="Measures multispectral vector angle deviation."
                  icon={<Compass className="w-5 h-5" />}
                  isDemo={true}
                />
                <MetricCard
                  label="Global Dimensionless Error (ERGAS)"
                  value={fmt(demoMetrics.ergas)}
                  delta="-1.58"
                  deltaType="positive"
                  benchmark="< 2.50"
                  description="Relative dimensionless synthesis error across all spectral channels."
                  icon={<Layers className="w-5 h-5" />}
                  isDemo={true}
                />
              </>
            )}
          </div>
        </section>

        {/* Validation Summary (reference note + uncertainty + spectral) */}
        <ValidationSummary
          report={realMetrics}
          isDemo={isDemo}
          uncertaintyMapUrl={results?.uncertainty_map_url || matchedPreset.uncertaintyMapUrl}
        />

        {/* Spectral Reflectance Profile Table */}
        <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                4-Band Multispectral Preservation Table
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {referenceAvailable
                  ? 'Comparison of input reflectance vs super-resolved reflectance (real SR model).'
                  : 'Input reflectance vs super-resolved reflectance. Reflectance values are model-inferred where no reference exists.'}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {referenceAvailable ? 'Reference-validated' : 'No ground-truth reference'}
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
                {spectralRows.map((point) => (
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
