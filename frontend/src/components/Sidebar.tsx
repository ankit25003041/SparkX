'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Satellite, 
  Layers, 
  Cpu, 
  MapPin, 
  Sparkles, 
  Info,
  ChevronRight
} from 'lucide-react';
import { SCENE_PRESETS, AVAILABLE_MODELS } from '../lib/mockData';
import { ScenePreset } from '../types/geosr';

interface SidebarProps {
  selectedPresetId?: string;
  onSelectPreset?: (preset: ScenePreset) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedPresetId,
  onSelectPreset,
  className = '',
}) => {
  return (
    <aside className={`w-72 border-r border-slate-800/80 bg-slate-950 flex flex-col p-4 space-y-6 ${className}`}>
      {/* Benchmark Presets Section */}
      <div>
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          Benchmark Scenes
        </div>
        <div className="space-y-1.5">
          {SCENE_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset?.(preset)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between font-medium text-slate-200">
                  <span className="truncate">{preset.title.split('(')[0]}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {preset.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  {preset.coordinates[0].toFixed(2)}°N, {preset.coordinates[1].toFixed(2)}°E
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Models Section */}
      <div className="border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          Deep Learning Models
        </div>
        <div className="space-y-2">
          {AVAILABLE_MODELS.map((model) => (
            <div
              key={model.id}
              className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/30 text-xs"
            >
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span>{model.name}</span>
                <span className="text-[10px] font-mono text-cyan-400">{model.speedRating}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                {model.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SIH 2026 Info Card */}
      <div className="mt-auto pt-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900 to-cyan-950/40 border border-cyan-900/40 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-cyan-300 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Smart India Hackathon 2026
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            PS #26142: Super-Resolution Mapping from Sentinel-2 10m to sub-4m ground sampling distance.
          </p>
        </div>
      </div>
    </aside>
  );
};
