'use client';

import React, { useState } from 'react';
import { ShieldCheck, Info, Sliders, AlertTriangle } from 'lucide-react';
import { UncertaintyMetrics } from '../types/geosr';

interface ConfidenceMapProps {
  uncertaintyMapUrl: string;
  metrics?: UncertaintyMetrics;
  className?: string;
}

export const ConfidenceMap: React.FC<ConfidenceMapProps> = ({
  uncertaintyMapUrl,
  metrics = {
    meanVariance: 0.034,
    maxUncertainty: 0.21,
    confidenceScore: 96.4,
    highUncertaintyPixelPercent: 3.6,
  },
  className = '',
}) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);

  return (
    <div className={`rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
            Model Confidence & Uncertainty Map
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
          {metrics.confidenceScore}% High Confidence
        </span>
      </div>

      {/* Uncertainty Heatmap Visual Viewport */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-56 flex items-center justify-center group">
        <img
          src={uncertaintyMapUrl}
          alt="Uncertainty Heatmap"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          style={{
            filter: 'contrast(1.4) saturate(2.2) hue-rotate(140deg)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        {/* Heatmap Legend Bar */}
        <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-emerald-400">High Confidence (&gt;90%)</span>
            <span className="text-amber-400">Moderate (70-90%)</span>
            <span className="text-rose-400">Uncertain (&lt;70%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="text-[10px] text-slate-500 uppercase">Confidence Score</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">{metrics.confidenceScore}%</div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="text-[10px] text-slate-500 uppercase">Mean Variance</div>
          <div className="text-base font-bold text-slate-200 mt-0.5">{metrics.meanVariance}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="text-[10px] text-slate-500 uppercase">Max Uncertainty</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">{metrics.maxUncertainty}</div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <div className="text-[10px] text-slate-500 uppercase">Edge Caution Area</div>
          <div className="text-base font-bold text-slate-300 mt-0.5">{metrics.highUncertaintyPixelPercent}%</div>
        </div>
      </div>

      {/* Explanatory Note */}
      <div className="text-[11px] text-slate-400 flex items-start gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          Uncertainty variance measures model epistemic confidence across multi-scale convolutional passes. Higher variance typically localizes at specular water reflections and deep cloud-edge shadows.
        </span>
      </div>
    </div>
  );
};
