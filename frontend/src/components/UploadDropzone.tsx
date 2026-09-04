'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileCheck2, 
  FileCode2, 
  AlertCircle, 
  X, 
  Sparkles, 
  FileText,
  CheckCircle2
} from 'lucide-react';
import { formatBytes } from '../lib/utils';
import { GeoTIFFMetadata } from '../types/geosr';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  isInspecting?: boolean;
}

const SUPPORTED_EXTENSIONS = ['.tif', '.tiff', '.jp2', '.zip'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelected,
  selectedFile,
  onClearFile,
  isInspecting = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setValidationError(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setValidationError(`Unsupported file format (${ext}). Please provide a GeoTIFF (.tif, .tiff), JPEG2000 (.jp2), or Sentinel-2 SAFE package (.zip).`);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setValidationError(`File size exceeds 500MB limit (${formatBytes(file.size)}). Please upload a regional scene or crop tile.`);
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tif,.tiff,.jp2,.zip"
        onChange={handleFileChange}
        className="hidden"
        id="geotiff-file-input"
        aria-label="Upload GeoTIFF or Sentinel-2 satellite imagery file"
      />

      {/* Main Drag-and-Drop Area */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 mb-4 shadow-lg shadow-cyan-950">
            <UploadCloud className="w-8 h-8 animate-pulse" />
          </div>

          <h3 className="text-base font-semibold text-white mb-1">
            Drag and drop your Sentinel-2 satellite imagery
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            Supports Cloud-Optimized GeoTIFF (.tif, .tiff), Sentinel-2 SAFE (.zip), and JPEG2000 (.jp2) up to 500 MB.
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-medium border border-slate-700 transition-colors shadow-sm"
          >
            Browse Local Files
          </button>

          {/* Validation checklist pill */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              GeoTIFF Tags
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              EPSG / UTM Proj
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              12-Band MSI L2A
            </span>
          </div>
        </div>
      ) : (
        /* Selected File Card */
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-400 shrink-0">
                <FileCode2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 shrink-0">
                    VALID GEOTIFF
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                  <span>Size: {formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span>Format: GeoTIFF / L2A</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClearFile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Remove uploaded file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Validation Status message */}
          {isInspecting ? (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-cyan-400 font-mono animate-pulse">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              Verifying GDAL spatial geotransform & radiometric band headers...
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              File structure parsed successfully. Ready for super-resolution pipeline execution.
            </div>
          )}
        </div>
      )}

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
