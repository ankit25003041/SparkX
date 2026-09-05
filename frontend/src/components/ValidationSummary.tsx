'use client';

import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { ValidationReport, SpectralBandValidation } from '../types/geosr';
import { ConfidenceMap } from './ConfidenceMap';

interface ValidationSummaryProps {
  report: ValidationReport | null;
  isDemo: boolean;
  uncertaintyMapUrl?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ report, isDemo, uncertaintyMapUrl }) => {
  if (isDemo) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Model Confidence & Uncertainty
        </h2>
        <ConfidenceMap uncertaintyMapUrl={uncertaintyMapUrl || '/samples/delhi_uncertainty.svg'} />
        <div className="text-[11px] text-slate-400 flex items-start gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            DEMO: simulated confidence. Real uncertainty is derived from
            self-consistency (LR↔SR round-trip) or an input-perturbation ensemble.
          </span>
        </div>
      </section>
    );
  }

  const refNote = report?.reference_note ?? '';
  const referenceAvailable = !!report?.reference_available;
  const un = report?.uncertainty_summary;

  return (
    <section className="space-y-4">
      {/* Reference availability / integrity notice */}
      <div
        className={`p-3 rounded-xl font-mono text-xs flex items-start gap-2 ${
          referenceAvailable
            ? 'bg-emerald-950/30 border border-emerald-800/60 text-emerald-200'
            : 'bg-amber-950/30 border border-amber-800/60 text-amber-200'
        }`}
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{referenceAvailable ? refNote : refNote}</span>
      </div>

      {!referenceAvailable && (
        <p className="text-[11px] text-slate-400">
          Reference-based quantitative validation unavailable for this scene. PSNR, SSIM, SAM
          and ERGAS are reported as N/A. The confidence map below is estimated from
          self-consistency of the model output with the input evidence (not from ground truth),
          so it measures reliability, not correctness.
        </p>
      )}

      {/* Uncertainty / confidence visualization */}
      {uncertaintyMapUrl && (
        <ConfidenceMap
          uncertaintyMapUrl={uncertaintyMapUrl}
          metrics={
            un
              ? {
                  meanVariance: un.mean_uncertainty,
                  maxUncertainty: un.max_uncertainty,
                  confidenceScore: un.confidence_score,
                  highUncertaintyPixelPercent: un.high_uncertainty_pixel_percent,
                }
              : undefined
          }
        />
      )}

      {/* Uncertainty numeric summary */}
      {un && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] text-slate-500 uppercase">Confidence Score</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{un.confidence_score.toFixed(1)}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] text-slate-500 uppercase">Mean Uncertainty</div>
            <div className="text-base font-bold text-slate-300 mt-0.5">{un.mean_uncertainty.toFixed(3)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] text-slate-500 uppercase">Max Uncertainty</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">{un.max_uncertainty.toFixed(3)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-[10px] text-slate-500 uppercase">Caution Pixels</div>
            <div className="text-base font-bold text-rose-400 mt-0.5">{un.high_uncertainty_pixel_percent.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Spectral validation table (per-band reflectance stats) */}
      {report?.spectral_validation && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Spectral Validation — per-band reflectance
            </h3>
            <span className="text-[10px] text-slate-400">
              {referenceAvailable ? 'vs HR reference' : 'SR output statistics (no reference)'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="pb-1 font-medium">Band</th>
                  <th className="pb-1 font-medium">Mean</th>
                  <th className="pb-1 font-medium">Std</th>
                  <th className="pb-1 font-medium">Min</th>
                  <th className="pb-1 font-medium">Max</th>
                  {referenceAvailable && <th className="pb-1 font-medium">RMSE</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {report.spectral_validation.sr_stats.map((s: SpectralBandValidation, i: number) => (
                  <tr key={s.band + i} className="hover:bg-slate-950/40">
                    <td className="py-1.5 font-bold text-cyan-400">{s.band}</td>
                    <td className="py-1.5">{s.mean.toFixed(4)}</td>
                    <td className="py-1.5">{s.std.toFixed(4)}</td>
                    <td className="py-1.5">{s.min.toFixed(3)}</td>
                    <td className="py-1.5">{s.max.toFixed(3)}</td>
                    {referenceAvailable &&
                      report.spectral_validation.per_band_error && (
                        <td className="py-1.5">
                          {report.spectral_validation.per_band_error[i]?.rmse.toFixed(4)}
                        </td>
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Spatial validation */}
      {report?.spatial_validation && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">
            Spatial sharpness (mean Sobel gradient magnitude):{' '}
            <span className="text-slate-200 font-bold">{report.spatial_validation.mean_gradient_magnitude.toFixed(4)}</span>
          </span>
          {referenceAvailable && report.spatial_validation.sharpness_ratio_vs_reference != null && (
            <span className="text-slate-400">
              Sharpness ratio vs reference: <span className="text-cyan-400 font-bold">{report.spatial_validation.sharpness_ratio_vs_reference.toFixed(3)}</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
};
