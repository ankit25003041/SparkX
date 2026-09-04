'use client';

import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  Activity, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Info,
  Layers,
  Leaf
} from 'lucide-react';
import { SpectralPoint, TransectSample } from '../types/geosr';
import { calculateIndices, generateTransectProfile } from '../lib/utils';

interface SpectralInspectorProps {
  spectralPoints: SpectralPoint[];
}

export const SpectralInspector: React.FC<SpectralInspectorProps> = ({ spectralPoints }) => {
  const [activeTab, setActiveTab] = useState<'reflectance' | 'transect' | 'indices'>('reflectance');

  // Compute vegetation indices for Original vs SR
  const b04Orig = spectralPoints.find((p) => p.band === 'B04')?.originalReflectance || 0.1;
  const b08Orig = spectralPoints.find((p) => p.band === 'B08')?.originalReflectance || 0.4;
  const b03Orig = spectralPoints.find((p) => p.band === 'B03')?.originalReflectance || 0.12;

  const b04SR = spectralPoints.find((p) => p.band === 'B04')?.srReflectance || 0.1;
  const b08SR = spectralPoints.find((p) => p.band === 'B08')?.srReflectance || 0.4;
  const b03SR = spectralPoints.find((p) => p.band === 'B03')?.srReflectance || 0.12;

  const origIndices = calculateIndices(b04Orig, b08Orig, b03Orig);
  const srIndices = calculateIndices(b04SR, b08SR, b03SR);

  // Generate transect profile samples for spatial sharpness evaluation
  const transectSamples = generateTransectProfile(24);

  return (
    <div className="w-full lg:w-96 border-l border-slate-800/80 bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar text-slate-200">
      <div className="p-4 space-y-5">
        {/* Header & Tabs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Spectral & Radiometric Fidelity
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Preserved
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('reflectance')}
              className={`py-1 px-2 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'reflectance'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Reflectance
            </button>
            <button
              onClick={() => setActiveTab('transect')}
              className={`py-1 px-2 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'transect'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Transect
            </button>
            <button
              onClick={() => setActiveTab('indices')}
              className={`py-1 px-2 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'indices'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Indices
            </button>
          </div>
        </div>

        {/* Tab 1: Spectral Reflectance Curve */}
        {activeTab === 'reflectance' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">
                  Multispectral Signature Curve (B02–B12)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">BOA Reflectance (0-1)</span>
              </div>
              <div className="h-48 w-full text-[10px] font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spectralPoints} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="band" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis domain={[0, 0.8]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${(Number(val) * 100).toFixed(2)}%`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Line
                      type="monotone"
                      dataKey="originalReflectance"
                      name="Original 10m"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#94a3b8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="srReflectance"
                      name="GeoSR 2.5m"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#06b6d4' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Band Deviation Table */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300">Spectral Angle & Band Deviation</div>
              <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {spectralPoints.map((pt) => (
                  <div key={pt.band} className="flex items-center justify-between text-[11px] font-mono p-1 rounded bg-slate-950/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400 font-semibold">{pt.band}</span>
                      <span className="text-slate-400 text-[10px]">({pt.wavelengthNm}nm)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">{(pt.srReflectance * 100).toFixed(1)}%</span>
                      <span className={`text-[10px] ${Math.abs(pt.diffPercent) < 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {pt.diffPercent > 0 ? `+${pt.diffPercent}%` : `${pt.diffPercent}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Spatial Transect Edge Sharpness */}
        {activeTab === 'transect' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">
                  Edge Boundary Sharpness Transect
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Distance (m)</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                Demonstrates sub-pixel transition sharpness across physical land cover boundaries (e.g. road edge or canal boundary).
              </p>
              <div className="h-48 w-full text-[10px] font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transectSamples} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="distanceMeters" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="m" />
                    <YAxis domain={[0, 1]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Area
                      type="monotone"
                      dataKey="originalValue"
                      name="Original 10m (Gradual)"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                    <Area
                      type="monotone"
                      dataKey="srValue"
                      name="GeoSR 2.5m (Sharp Step)"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Notice the steep gradient in GeoSR 2.5m: optical edge blur is resolved into crisp 2.5m boundaries while avoiding ringing artifacts.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Vegetation & Remote Sensing Indices */}
        {activeTab === 'indices' && (
          <div className="space-y-3">
            {[
              {
                name: 'NDVI (Vegetation Index)',
                formula: '(NIR - Red) / (NIR + Red)',
                orig: origIndices.ndvi,
                sr: srIndices.ndvi,
                desc: 'Plant chlorophyll content & canopy density',
              },
              {
                name: 'NDWI (Water Index)',
                formula: '(Green - NIR) / (Green + NIR)',
                orig: origIndices.ndwi,
                sr: srIndices.ndwi,
                desc: 'Surface water delineation & canopy moisture',
              },
              {
                name: 'EVI (Enhanced Vegetation)',
                formula: '2.5 * (NIR - Red) / (NIR + 6R - 7.5B + 1)',
                orig: origIndices.evi,
                sr: srIndices.evi,
                desc: 'Atmospheric resistant high-biomass canopy index',
              },
            ].map((idx) => {
              const delta = Math.abs(idx.sr - idx.orig);
              return (
                <div key={idx.name} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                      {idx.name}
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">Δ {delta.toFixed(3)}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">{idx.formula}</div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">Original 10m</div>
                      <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">{idx.orig}</div>
                    </div>
                    <div className="p-2 rounded bg-cyan-950/60 border border-cyan-800/60 text-center">
                      <div className="text-[10px] text-cyan-300">GeoSR 2.5m</div>
                      <div className="text-sm font-mono font-bold text-cyan-300 mt-0.5">{idx.sr}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
