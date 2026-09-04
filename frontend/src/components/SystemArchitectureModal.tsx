'use client';

import React from 'react';
import { 
  X, 
  Satellite, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  Database,
  Code2,
  Users
} from 'lucide-react';

interface SystemArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemArchitectureModal: React.FC<SystemArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 relative text-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
            <Satellite className="w-5 h-5" />
            <span>GeoSR: System Architecture & SIH 26142 Roadmap</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deep Learning Based Super Resolution Mapping (SRM) from Medium Resolution Satellite Imageries (Sentinel-2 10m → 2.5m)
          </p>
        </div>

        {/* End-to-End Pipeline Workflow */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            End-to-End Processing Pipeline
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-cyan-400 font-bold flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                1. Ingestion
              </div>
              <p className="text-[11px] text-slate-400">
                Sentinel-2 L2A GeoTIFF with 12 BOA bands, geotransforms, & EPSG projections.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-indigo-400 font-bold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                2. Tiling & Preprocess
              </div>
              <p className="text-[11px] text-slate-400">
                Overlap windowing (e.g. 256x256 with 20% margin), reflectance normalization & CRS preservation.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-emerald-400 font-bold flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                3. Deep SRM Model
              </div>
              <p className="text-[11px] text-slate-400">
                PyTorch ESRGAN-Sat / RCAN-Sat with Spectral Angle Loss & Channel Attention.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-amber-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                4. Validation & GIS
              </div>
              <p className="text-[11px] text-slate-400">
                SAM, PSNR, SSIM evaluation, uncertainty variance heatmap, & GeoTIFF export.
              </p>
            </div>
          </div>
        </div>

        {/* SIH Roadmap Status */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            9-Phase Incremental Strategy
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { phase: 'Phase 1', title: 'Frontend GIS Dashboard', status: 'Active (Now)', color: 'border-cyan-500 bg-cyan-950/40 text-cyan-300' },
              { phase: 'Phase 2', title: 'FastAPI Backend REST API', status: 'Next', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 3', title: 'Geospatial Processing Engine', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 4', title: 'Dataset & Training Pipeline', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 5', title: 'Baseline Super-Resolution', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 6', title: 'Advanced Deep Learning SRM', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 7', title: 'Validation & Uncertainty Engine', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 8', title: 'Full System Integration', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
              { phase: 'Phase 9', title: 'Demo Optimization & Benchmarks', status: 'Scheduled', color: 'border-slate-800 bg-slate-950 text-slate-300' },
            ].map((p) => (
              <div key={p.phase} className={`p-2.5 rounded-xl border ${p.color}`}>
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span>{p.phase}</span>
                  <span className="opacity-80">{p.status}</span>
                </div>
                <div className="text-xs font-semibold mt-1">{p.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team SparkX */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Team SparkX
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
            <div><strong className="text-slate-200">Ankit</strong>: Backend & GIS</div>
            <div><strong className="text-slate-200">Tanishk</strong>: Frontend Lead</div>
            <div><strong className="text-slate-200">Anvay</strong>: Documentation & PPT</div>
            <div><strong className="text-slate-200">Ashika, Ashta, Bhavana</strong>: ML SRM</div>
          </div>
        </div>
      </div>
    </div>
  );
};
