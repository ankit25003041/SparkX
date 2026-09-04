'use client';

import React from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  benchmark?: string;
  description?: string;
  icon?: React.ReactNode;
  isDemo?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  delta,
  deltaType = 'positive',
  benchmark,
  description,
  icon,
  isDemo = false,
}) => {
  return (
    <div className="relative p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm group">
      {/* Top row: Label & Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
          {label}
        </span>
        {icon && <div className="text-cyan-400 group-hover:scale-110 transition-transform">{icon}</div>}
      </div>

      {/* Center: Main value & unit */}
      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono font-medium text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom row: Delta & benchmark */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
        {delta && (
          <div className="flex items-center gap-1">
            {deltaType === 'positive' && (
              <span className="inline-flex items-center text-emerald-400 font-medium">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                {delta}
              </span>
            )}
            {deltaType === 'negative' && (
              <span className="inline-flex items-center text-rose-400 font-medium">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                {delta}
              </span>
            )}
            {deltaType === 'neutral' && (
              <span className="inline-flex items-center text-slate-400">
                <Minus className="w-3 h-3 mr-0.5" />
                {delta}
              </span>
            )}
            <span className="text-[10px] text-slate-500">vs baseline</span>
          </div>
        )}

        {benchmark && (
          <span className="text-[10px] text-slate-500">
            Target: <span className="text-slate-400">{benchmark}</span>
          </span>
        )}
      </div>

      {/* Tooltip / description on hover */}
      {description && (
        <div className="text-[11px] text-slate-400 mt-2 line-clamp-2">
          {description}
        </div>
      )}

      {/* Demo watermark tag if applicable */}
      {isDemo && (
        <div className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400/80 border border-amber-800/40">
          DEMO
        </div>
      )}
    </div>
  );
};
