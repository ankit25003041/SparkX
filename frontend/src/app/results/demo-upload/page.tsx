'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Download,
  FileText,
  Map,
  Layers,
  CheckCircle2,
  Info,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import { ImageComparison } from '../../../components/ImageComparison';
import { MetricCard } from '../../../components/MetricCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { ValidationSummary } from '../../../components/ValidationSummary';
import {
  DEMO_COMPARISON_IMAGE,
  UPLOAD_DEMO_NOTICE,
  DEMO_MODEL,
  DEMO_INPUT_GSD_M,
  DEMO_OUTPUT_GSD_M,
  DEMO_SCALE_FACTOR,
} from '../../../lib/uploadDemo';

export default function DemoUploadResultsPage() {
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setDownloadNotification(msg);
    setTimeout(() => setDownloadNotification(null), 4000);
  };

  const handleDownload = () => {
    window.open(DEMO_COMPARISON_IMAGE, '_blank', 'noopener,noreferrer');
    showNotification('Opening demo comparison image');
  };

  const handleDownloadReport = () => {
    showNotification(UPLOAD_DEMO_NOTICE);
  };

  const isDemo = true;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 space-y-8">
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
              Analysis Results • Scene ID: DEMO TIFF
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              DEMO TIFF (Uploaded Scene — Showcase)
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
              <span>Model: {DEMO_MODEL} • Input: {DEMO_INPUT_GSD_M.toFixed(0)} m GSD</span>
              <span>•</span>
              <span>Output: {DEMO_OUTPUT_GSD_M.toFixed(1)} m GSD</span>
              <span>•</span>
              <span>Scale: {DEMO_SCALE_FACTOR}x</span>
              <span>•</span>
              <span>Spectral: B02, B03, B04, B08</span>
              <span>•</span>
              <StatusBadge status="completed" showIcon={true} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <Map className="w-3.5 h-3.5 text-cyan-400" />
              Back to Upload
            </Link>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-cyan-950/50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Comparison
            </button>
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Validation Report
            </button>
          </div>
        </div>

        {/* Resolution Enhancement Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/50 flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Input Resolution:</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-bold text-xs">
                {DEMO_INPUT_GSD_M.toFixed(1)}m GSD
              </span>
            </div>
            <span className="text-cyan-400 text-sm font-bold">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300">Super-Resolved Output:</span>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold text-xs shadow-sm">
                {DEMO_OUTPUT_GSD_M.toFixed(1)}m GSD ({DEMO_SCALE_FACTOR}x Boost)
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span>Spatial Upscaling: <strong className="text-white">{DEMO_SCALE_FACTOR}x ({DEMO_INPUT_GSD_M.toFixed(0)} m -&gt; {DEMO_OUTPUT_GSD_M.toFixed(1)} m)</strong></span>
            <span className="text-slate-700">•</span>
            <span>Latency: <strong className="text-emerald-400">N/A</strong></span>
          </div>
        </div>

        {/* Spatial Comparison Section — single combined demo image (not split) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              High-Fidelity Spatial Comparison
            </h2>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              INPUT: Sentinel-2 {DEMO_INPUT_GSD_M.toFixed(0)}m &nbsp;|&nbsp; OUTPUT: GeoSRv2 {DEMO_OUTPUT_GSD_M.toFixed(1)}m ({DEMO_SCALE_FACTOR}x)
            </span>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex items-center justify-center">
            <ImageComparison
              lowResImageUrl={DEMO_COMPARISON_IMAGE}
              superResImageUrl={DEMO_COMPARISON_IMAGE}
              title="GeoSRv2 demo comparison (10 m → 5 m)"
              coordinates={[28.6139, 77.209]}
              scaleFactor={DEMO_SCALE_FACTOR}
              initialMode="side_by_side"
              bandCombination="RGB"
            />
          </div>
        </section>

        {/* Validation Metrics Grid — all N/A, no fabricated numbers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Quantitative Validation Metrics (Demo)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
              SAMPLE VALUES (no live run)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            No HR ground truth is available for the uploaded TIFF. PSNR, SSIM, SAM and ERGAS are
            reported as N/A — no quantitative metrics were computed for this demo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Peak Signal-to-Noise Ratio"
              value="N/A"
              unit="dB"
              benchmark="> 30 dB"
              description="Reconstruction fidelity vs HR ground truth."
              icon={<Sparkles className="w-5 h-5" />}
              isDemo={isDemo}
            />
            <MetricCard
              label="Structural Similarity (SSIM)"
              value="N/A"
              benchmark="> 0.88"
              description="Edge structures, building shapes, road continuity."
              icon={<ShieldCheck className="w-5 h-5" />}
              isDemo={isDemo}
            />
            <MetricCard
              label="Spectral Angle Mapper (SAM)"
              value="N/A"
              unit="°"
              benchmark="< 3.0°"
              description="Multispectral vector angle deviation."
              icon={<Compass className="w-5 h-5" />}
              isDemo={isDemo}
            />
            <MetricCard
              label="Global Error (ERGAS)"
              value="N/A"
              benchmark="< 2.50"
              description="Relative dimensionless synthesis error across all spectral channels."
              icon={<Layers className="w-5 h-5" />}
              isDemo={isDemo}
            />
          </div>
        </section>

        {/* Validation Summary (reuse) */}
        <ValidationSummary report={null} isDemo={isDemo} />

        {/* Spectral table — N/A placeholders, no fabricated reflectance */}
        <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                4-Band Multispectral Preservation Table
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                No per-band spectral analysis was performed for this demo preview.
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
              N/A (no live run)
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
                {['B02', 'B03', 'B04', 'B08'].map((band) => (
                  <tr key={band} className="hover:bg-slate-950/40 transition-colors">
                    <td className="py-2.5 font-bold text-cyan-400">{band}</td>
                    <td className="py-2.5 text-slate-200">N/A</td>
                    <td className="py-2.5 text-slate-400">N/A</td>
                    <td className="py-2.5">N/A</td>
                    <td className="py-2.5 text-slate-100 font-semibold">N/A</td>
                    <td className="py-2.5">N/A</td>
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
