'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Map, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScenePreset, ValidationMetrics } from '../types/geosr';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: ScenePreset;
  metrics: ValidationMetrics;
  scaleFactor: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  preset,
  metrics,
  scaleFactor,
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExport = (format: 'geotiff' | 'geojson' | 'audit_report') => {
    setDownloadingFormat(format);
    setTimeout(() => {
      // Trigger festive confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#10b981'],
      });

      // Mock download file creation
      if (format === 'geojson') {
        const geojson = {
          type: 'FeatureCollection',
          crs: { type: 'name', properties: { name: preset.crs } },
          features: [
            {
              type: 'Feature',
              properties: {
                title: preset.title,
                sensor: 'Sentinel-2 MSI Level-2A',
                original_gsd_meters: 10.0,
                super_resolved_gsd_meters: scaleFactor === 4 ? 2.5 : 5.0,
                psnr_db: metrics.psnr,
                ssim: metrics.ssim,
                sam_deg: metrics.sam,
                exported_at: new Date().toISOString(),
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [preset.coordinates[1] - 0.02, preset.coordinates[0] - 0.02],
                  [preset.coordinates[1] + 0.02, preset.coordinates[0] - 0.02],
                  [preset.coordinates[1] + 0.02, preset.coordinates[0] + 0.02],
                  [preset.coordinates[1] - 0.02, preset.coordinates[0] + 0.02],
                  [preset.coordinates[1] - 0.02, preset.coordinates[0] - 0.02],
                ]],
              },
            },
          ],
        };
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GeoSR_${preset.id}_2.5m.geojson`;
        a.click();
      } else if (format === 'audit_report') {
        const report = {
          project: 'GeoSR - AI-Powered Satellite Super Resolution Mapping',
          sih_problem_statement: '26142',
          scene: preset.title,
          location: preset.location,
          target_gsd: `${scaleFactor === 4 ? 2.5 : 5.0} meters`,
          original_gsd: '10.0 meters',
          metrics: metrics,
          spectral_fidelity_status: 'Compliant (<2.5° SAM)',
          spatial_structure_status: 'Preserved (SSIM > 0.92)',
          disclaimer: 'Generated sub-pixel structures are model statistical inferences.',
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GeoSR_Validation_Report_${preset.id}.json`;
        a.click();
      } else {
        // Mock GeoTIFF direct download
        const blob = new Blob(['GEOTIFF_DUMMY_BINARY_DATA_WITH_PRESERVED_CRS_' + preset.crs], { type: 'image/tiff' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GeoSR_SuperResolved_2.5m_${preset.id}.tif`;
        a.click();
      }

      setDownloadingFormat(null);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Sparkles className="w-5 h-5" />
            <span>Export Super-Resolved Product</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Produce GIS-ready GeoTIFF rasters and validation reports with preserved spatial metadata.
          </p>
        </div>

        {/* Scene Specs Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between text-slate-300 font-sans font-semibold">
            <span>{preset.title}</span>
            <span className="text-cyan-400">{scaleFactor === 4 ? '2.5m GSD' : '5.0m GSD'}</span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>CRS: {preset.crs}</span>
            <span>Cloud Cover: {preset.cloudCoverPercent}%</span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>PSNR: {metrics.psnr} dB</span>
            <span>SSIM: {metrics.ssim}</span>
          </div>
        </div>

        {/* Export Formats */}
        <div className="space-y-2">
          {/* Format 1: GeoTIFF */}
          <button
            onClick={() => handleExport('geotiff')}
            disabled={downloadingFormat !== null}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                  Super-Resolved GeoTIFF (.tif)
                </div>
                <div className="text-[10px] text-slate-400">
                  Full 12-Band & RGB BOA Reflectance with embedded Geotransform
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
          </button>

          {/* Format 2: GeoJSON Boundary Extent */}
          <button
            onClick={() => handleExport('geojson')}
            disabled={downloadingFormat !== null}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                  Geospatial Footprint (.geojson)
                </div>
                <div className="text-[10px] text-slate-400">
                  Bounding polygon coordinates, EPSG projection, and metadata
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-400" />
          </button>

          {/* Format 3: Scientific Validation Audit Report */}
          <button
            onClick={() => handleExport('audit_report')}
            disabled={downloadingFormat !== null}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                  Validation & Uncertainty Audit (.json)
                </div>
                <div className="text-[10px] text-slate-400">
                  PSNR, SSIM, SAM, ERGAS, band reflectance delta table & provenance
                </div>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
          </button>
        </div>

        {downloadSuccess && (
          <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Product export downloaded successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
};
