'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Satellite, 
  Upload, 
  Map, 
  BarChart3, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Activity, 
  SlidersHorizontal,
  Compass,
  FileCode2
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { AnalysisCard } from '../components/AnalysisCard';
import { StatusBadge } from '../components/StatusBadge';
import { RECENT_ANALYSES, SCENE_PRESETS, SYSTEM_TELEMETRY } from '../lib/mockData';

export default function DashboardPage() {
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const filteredAnalyses = filterCategory === 'All'
    ? RECENT_ANALYSES
    : RECENT_ANALYSES.filter(a => {
        const preset = SCENE_PRESETS.find(p => p.id === a.sceneId);
        return preset?.category === filterCategory;
      });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Hero Section */}
      <section className="relative border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Smart India Hackathon 2026 • Problem Statement #26142
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-900 text-slate-400 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Phase 1 Prototype Active
            </span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Deep Learning Super-Resolution Mapping from Medium Resolution Imagery
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              GeoSR transforms medium-resolution Sentinel-2 multispectral imagery (10m Ground Sampling Distance) into sub-4m high-fidelity geospatial rasters (2.5m GSD), while strictly preserving radiometric reflectance and vegetation indices across all 12 spectral bands.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-950/50 hover:shadow-cyan-900/60 transition-all group"
            >
              <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              Start New Analysis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm border border-slate-700/80 transition-colors"
            >
              <Map className="w-4 h-4 text-cyan-400" />
              Launch GIS Explorer
            </Link>

            <Link
              href="/analytics"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-mono text-xs border border-slate-800 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Model Benchmarks
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 w-full flex-1">
        {/* System Telemetry & Cluster Status Banner */}
        <section className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-300 font-bold flex items-center gap-2">
                GPU Inference Nodes Online
                <StatusBadge status="operational" showIcon={false} />
              </div>
              <div className="text-[11px] text-slate-500">
                {SYSTEM_TELEMETRY.gpuModel} • Cluster Latency: {SYSTEM_TELEMETRY.avgQueueWaitMs}ms
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[11px]">
            <div>
              <span className="text-slate-500">VRAM Allocated: </span>
              <span className="text-slate-200 font-bold">{SYSTEM_TELEMETRY.vramUsedGb} GB</span>
              <span className="text-slate-500"> / {SYSTEM_TELEMETRY.vramTotalGb} GB</span>
            </div>
            <span className="hidden sm:inline text-slate-700">•</span>
            <div>
              <span className="text-slate-500">Tile Cache Hit: </span>
              <span className="text-emerald-400 font-bold">{SYSTEM_TELEMETRY.tileCacheHitPercent}%</span>
            </div>
            <span className="hidden sm:inline text-slate-700">•</span>
            <div>
              <span className="text-slate-500">Uptime: </span>
              <span className="text-slate-200 font-bold">{SYSTEM_TELEMETRY.uptimeHours} hrs</span>
            </div>
          </div>
        </section>

        {/* Core KPIs Row */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              Processing Statistics & Model Validation
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
              DEMO DATA (SIMULATED)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Peak SNR (PSNR)"
              value="34.82"
              unit="dB"
              delta="+6.42 dB"
              deltaType="positive"
              benchmark="> 30 dB"
              description="Peak Signal-to-Noise Ratio measuring spatial reconstruction clarity."
              icon={<Sparkles className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Structural Similarity (SSIM)"
              value="0.924"
              delta="+0.182"
              deltaType="positive"
              benchmark="> 0.88"
              description="Structural correlation with high-resolution ground truth imagery."
              icon={<ShieldCheck className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Spectral Angle Mapper (SAM)"
              value="2.15"
              unit="°"
              delta="-4.80°"
              deltaType="positive"
              benchmark="< 3.0°"
              description="Spectral angle distortion across 12 bands (lower is superior)."
              icon={<Compass className="w-5 h-5" />}
              isDemo={true}
            />

            <MetricCard
              label="Inference Latency"
              value="412"
              unit="ms"
              delta="-32%"
              deltaType="positive"
              benchmark="< 1000 ms"
              description="Average inference time per 256x256 multispectral tile patch."
              icon={<Clock className="w-5 h-5" />}
              isDemo={true}
            />
          </div>
        </section>

        {/* 1-Click Quick Demo Launcher Bar for SIH Evaluators */}
        <section className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                SIH Evaluator Quick-Launch Test Scenes
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Pre-loaded Sentinel-2 L2A Scenes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {SCENE_PRESETS.map((preset) => (
              <Link
                key={preset.id}
                href={`/results/${preset.id}`}
                className="p-3 rounded-xl bg-slate-950/80 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/50 transition-all text-left group flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{preset.category}</span>
                    <span className="text-cyan-400 font-bold">4x SR</span>
                  </div>
                  <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mt-1">
                    {preset.title.split('(')[0]}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>PSNR: {preset.defaultMetrics.psnr}dB</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Analyses Grid */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Recent Super-Resolution Analyses
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Completed and active inference jobs executed on Sentinel-2 datasets.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-xs">
              {['All', 'Urban', 'Agriculture', 'Coastal', 'Forest'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    filterCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAnalyses.map((analysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
