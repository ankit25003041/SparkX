'use client';

import React from 'react';
import { 
  Satellite, 
  Activity, 
  Layers, 
  Compass, 
  Sparkles, 
  Info, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { formatCoords } from '../lib/utils';

interface HeaderProps {
  currentCoords: [number, number];
  crs: string;
  isProcessing: boolean;
  onOpenArchitectureModal: () => void;
  onOpenExportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCoords,
  crs,
  isProcessing,
  onOpenArchitectureModal,
  onOpenExportModal,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Branding & SIH Problem Statement ID */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Satellite className="w-5 h-5 text-white animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
              GeoSR
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 font-semibold tracking-wider">
              SIH 2026 #26142
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Deep Learning Super-Resolution Mapping (Sentinel-2 10m → &lt;4m)
          </p>
        </div>
      </div>

      {/* Center: Live Geodetic Telemetry */}
      <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">CURSOR:</span>
          <span className="text-cyan-300 font-semibold">{formatCoords(currentCoords[0], currentCoords[1])}</span>
        </div>
        <div className="h-3.5 w-px bg-slate-800" />
        <div className="flex items-center gap-2 text-slate-300">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">CRS:</span>
          <span className="text-indigo-300 font-semibold truncate max-w-[140px]">{crs}</span>
        </div>
        <div className="h-3.5 w-px bg-slate-800" />
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isProcessing ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            )}
          </span>
          <span className={isProcessing ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
            {isProcessing ? 'INFERENCE ACTIVE' : 'SYSTEM READY'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenArchitectureModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer"
          title="View SIH 26142 Architecture & Roadmap"
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Architecture</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/20 border border-cyan-400/30 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Export Product</span>
        </button>
      </div>
    </header>
  );
};
