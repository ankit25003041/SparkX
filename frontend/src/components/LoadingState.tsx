'use client';

import React from 'react';
import { Satellite } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading geospatial raster dataset...',
  submessage = 'Decoding Sentinel-2 Multispectral arrays & projection metadata',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      {/* Radar Pulse Animation */}
      <div className="relative flex items-center justify-center w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border border-cyan-500/40 animate-pulse" />
        <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-lg shadow-cyan-950">
          <Satellite className="w-6 h-6 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
      </div>
      <p className="text-sm font-mono font-medium text-slate-200">{message}</p>
      {submessage && (
        <p className="text-xs text-slate-500 mt-1 font-mono">{submessage}</p>
      )}
    </div>
  );
};
