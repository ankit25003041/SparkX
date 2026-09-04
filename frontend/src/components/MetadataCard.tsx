'use client';

import React from 'react';
import { 
  Layers, 
  Compass, 
  Maximize2, 
  Eye, 
  Cloud, 
  Calendar, 
  Satellite, 
  Radio, 
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { GeoTIFFMetadata } from '../types/geosr';

interface MetadataCardProps {
  metadata: GeoTIFFMetadata;
  targetScale?: number;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({
  metadata,
  targetScale = 4,
}) => {
  const targetGsd = (metadata.gsdOriginalMeters / targetScale).toFixed(1);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
            Sentinel-2 Dataset Metadata
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
          Level-2A (BOA)
        </span>
      </div>

      {/* Primary Key Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Input GSD</div>
          <div className="text-base font-bold font-mono text-white mt-0.5">
            {metadata.gsdOriginalMeters.toFixed(1)} m
          </div>
          <div className="text-[10px] text-slate-400">Native Sentinel-2</div>
        </div>

        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50">
          <div className="text-[10px] font-mono text-cyan-400 uppercase">Target GSD</div>
          <div className="text-base font-bold font-mono text-cyan-300 mt-0.5">
            {targetGsd} m
          </div>
          <div className="text-[10px] text-cyan-400/80">{targetScale}x Super-Resolution</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Raster Grid</div>
          <div className="text-base font-bold font-mono text-white mt-0.5">
            {metadata.width.toLocaleString()} x {metadata.height.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400">Pixel Dimensions</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Spectral Bands</div>
          <div className="text-base font-bold font-mono text-white mt-0.5">
            {metadata.channels} Channels
          </div>
          <div className="text-[10px] text-slate-400">VNIR + SWIR Bands</div>
        </div>
      </div>

      {/* Geospatial Geodetic Table */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            CRS / Projection:
          </span>
          <span className="text-cyan-300 font-semibold truncate max-w-xs">
            {metadata.crs}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            Sensor Instrument:
          </span>
          <span className="text-slate-200">{metadata.sensor}</span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Acquisition Date:
          </span>
          <span className="text-slate-200">{metadata.acquisitionDate}</span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            Cloud Cover:
          </span>
          <span className="text-slate-200">{metadata.cloudCoverPercent}% (Clear Sky)</span>
        </div>
      </div>

      {/* Available Bands Pill Row */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">
          Available Multispectral Bands:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {metadata.bandsAvailable.map((band) => (
            <span
              key={band}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
            >
              {band}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
