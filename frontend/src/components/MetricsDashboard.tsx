'use client';

import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  Layers, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { ValidationMetrics } from '../types/geosr';

interface MetricsDashboardProps {
  metrics: ValidationMetrics;
  scaleFactor: number;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics, scaleFactor }) => {
  return (
    <div className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl p-4 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5">
          {/* GSD Improvement */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-cyan-800/50 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-cyan-400 flex items-center justify-between">
              <span>GSD Target</span>
              <span className="font-mono text-cyan-300">4x</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-white">
                10m → <span className="text-cyan-400">2.5m</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">16x Pixel Density</div>
            </div>
          </div>

          {/* PSNR */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>PSNR</span>
              <span className="text-emerald-400 font-mono">dB</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-emerald-400">{metrics.psnr}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Peak Signal/Noise</div>
            </div>
          </div>

          {/* SSIM */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>SSIM</span>
              <span className="text-emerald-400 font-mono">0-1</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-emerald-400">{metrics.ssim}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Structural Similarity</div>
            </div>
          </div>

          {/* SAM (Spectral Angle Mapper) */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>SAM</span>
              <span className="text-cyan-400 font-mono">deg (°)</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-cyan-300">{metrics.sam}°</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Spectral Angle (↓)</div>
            </div>
          </div>

          {/* ERGAS */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>ERGAS</span>
              <span className="text-indigo-400 font-mono">Error</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-indigo-300">{metrics.ergas}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Global Synthesis Error</div>
            </div>
          </div>

          {/* UIQI */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>UIQI</span>
              <span className="text-indigo-400 font-mono">0-1</span>
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-indigo-300">{metrics.uiqi}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Universal Image Quality</div>
            </div>
          </div>

          {/* Latency */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>SR Latency</span>
              <Clock className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="mt-1">
              <div className="text-base font-mono font-bold text-cyan-300">
                {metrics.inferenceTimeMs}
                <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">PyTorch Pipeline</div>
            </div>
          </div>
        </div>

        {/* Scientific Integrity & Hallucination Disclaimer */}
        <div className="p-2 px-3 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong className="text-slate-300">Scientific Integrity Note:</strong> Deep-learning super-resolution estimates sub-pixel spatial patterns from learned radiometric priors. Reconstructed details are statistical inferences, not direct optical sensor measurements.
            </span>
          </div>
          <span className="font-mono text-[10px] text-cyan-400/80 hidden md:inline">
            SIH 2026 SRM Compliance
          </span>
        </div>
      </div>
    </div>
  );
};
