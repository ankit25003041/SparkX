'use client';

import React, { useSyncExternalStore } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Layers, 
  Clock, 
  Compass, 
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { ANALYTICS_DATA } from '../../lib/mockData';
import { MetricCard } from '../../components/MetricCard';

const subscribe = () => () => {};

export default function AnalyticsPage() {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  const customTooltipStyle = {
    backgroundColor: '#020617',
    border: '1px solid #334155',
    borderRadius: '0.75rem',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#f8fafc',
    padding: '8px 12px',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Prominent Demo Watermark Alert */}
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-4 text-xs font-mono text-amber-300">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-900/80 font-bold border border-amber-700">
                SAMPLE BENCHMARKS (illustrative)
            </span>
              <span>
                Sample benchmarks across Sentinel-2 test datasets for SIH 2026 (illustrative).
              </span>
          </div>
          <span className="hidden md:inline text-amber-400/70">
            NVIDIA RTX 4090 Test Environment
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Empirical Performance Analytics
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Model Benchmarking & Geospatial Analytics
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Comprehensive evaluation of PSNR, SSIM, SAM spectral preservation, and pipeline throughput.
            </p>
          </div>

          <button
            onClick={() => alert('Exporting Analytics Dataset (CSV/JSON)...')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Benchmark CSV
          </button>
        </div>

        {/* Top Summary Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Scenes Processed"
            value="1,428"
            unit="scenes"
            delta="+24% this month"
            deltaType="positive"
            description="Cumulative Sentinel-2 L2A scenes processed in prototype evaluations."
            icon={<Layers className="w-5 h-5" />}
            isDemo={true}
          />

          <MetricCard
            label="Mean PSNR Across Testbed"
            value="35.2"
            unit="dB"
            delta="+6.8 dB vs Bicubic"
            deltaType="positive"
            description="Average Peak Signal-to-Noise Ratio for 4x super-resolution."
            icon={<Sparkles className="w-5 h-5" />}
            isDemo={true}
          />

          <MetricCard
            label="Mean Spectral Angle (SAM)"
            value="1.98"
            unit="°"
            delta="-5.0° vs Bicubic"
            deltaType="positive"
            benchmark="< 3.0° ISRO"
            description="Preserves multispectral vector angle and prevents radiometric drift."
            icon={<Compass className="w-5 h-5" />}
            isDemo={true}
          />

          <MetricCard
            label="Average Tile Latency"
            value="385"
            unit="ms"
            delta="16x Pixel Upscaling"
            deltaType="neutral"
            description="Time to super-resolve 256x256 Sentinel-2 patches into 1024x1024."
            icon={<Clock className="w-5 h-5" />}
            isDemo={true}
          />
        </section>

        {/* Charts Grid: 2 Columns */}
        {isMounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart 1: Processing Throughput Over Time (Weekly Scenes & Sq Km) */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Pipeline Throughput (Weekly Scenes Analyzed)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Total multispectral scenes and square kilometers mapped
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Throughput
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ANALYTICS_DATA.weeklyThroughput}>
                    <defs>
                      <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="week" stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="scenesProcessed"
                      name="Scenes Processed"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#throughputGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Model Architecture Benchmark Comparison (PSNR & SSIM) */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Architecture Benchmark (PSNR vs SSIM)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Comparison across Bicubic, RCAN, SwinIR, and GeoSR-ESRGAN
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Accuracy
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ANALYTICS_DATA.modelBenchmark}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="model" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="psnr" name="PSNR (dB)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sam" name="SAM Error (deg - lower is better)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Spectral Angle Mapper (SAM) Distortion Across 10 Bands */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Spectral Angle Mapper (SAM) Error Across Bands
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Degrees of spectral distortion from Blue (490nm) to SWIR2 (2190nm)
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                  Radiometry
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ANALYTICS_DATA.spectralFidelity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="band" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="samErrorDeg"
                      name="SAM Error (deg)"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={{ fill: '#a855f7', r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reflectancePreservation"
                      name="Reflectance Preservation %"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Processing Latency vs Sub-Tile Dimensions */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    GPU Inference Latency Scaling
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Inference execution time (ms) and VRAM consumption by patch size
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                  Performance
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ANALYTICS_DATA.latencyByResolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="tileSize" stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={11} fontFamily="monospace" />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="gpuTimeMs" name="Inference Time (ms)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="memoryMb" name="VRAM Allocated (MB)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
