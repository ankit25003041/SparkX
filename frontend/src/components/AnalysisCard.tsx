'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, MapPin, Calendar, HardDrive, Layers } from 'lucide-react';
import { AnalysisRecord } from '../types/geosr';
import { StatusBadge } from './StatusBadge';
import { formatBytes } from '../lib/utils';

interface AnalysisCardProps {
  analysis: AnalysisRecord;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis }) => {
  return (
    <div className="flex flex-col rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all overflow-hidden group shadow-sm hover:shadow-cyan-950/20">
      {/* Thumbnail with overlay tags */}
      <div className="relative h-44 w-full bg-slate-950 overflow-hidden">
        <img
          src={analysis.superResImageUrl}
          alt={analysis.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <StatusBadge status={analysis.status} />
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-cyan-300">
            {analysis.scaleFactor}x (10m → 2.5m)
          </span>
        </div>

        {/* Bottom thumbnail tag */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-mono">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" />
            {analysis.location.split(',')[0]}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-400 text-[10px]">
            {analysis.crs}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
            {analysis.title}
          </h4>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              {analysis.model.toUpperCase().replace('_', '-')}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              {analysis.createdAt.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Metrics Pill Grid */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center font-mono">
          <div>
            <div className="text-[10px] text-slate-500">PSNR</div>
            <div className="text-xs font-semibold text-cyan-300">{analysis.metrics.psnr} dB</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">SSIM</div>
            <div className="text-xs font-semibold text-emerald-300">{analysis.metrics.ssim}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">SAM</div>
            <div className="text-xs font-semibold text-amber-300">{analysis.metrics.sam}°</div>
          </div>
        </div>

        {/* Bottom CTA Link */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500">
            {formatBytes(analysis.filesizeBytes)}
          </span>
          <Link
            href={analysis.status === 'processing' ? `/processing/${analysis.id}` : `/results/${analysis.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 group-hover:translate-x-0.5 transition-transform"
          >
            {analysis.status === 'processing' ? 'View Pipeline' : 'View Results'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
