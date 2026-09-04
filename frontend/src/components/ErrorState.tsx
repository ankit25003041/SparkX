'use client';

import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  homeHref?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Geospatial Pipeline Error',
  message,
  onRetry,
  homeHref = '/',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-rose-900/40 bg-rose-950/20 max-w-lg mx-auto my-8">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-900/40 border border-rose-800/60 mb-4 text-rose-400">
        <AlertTriangle className="w-7 h-7 text-rose-400" />
      </div>
      <h3 className="text-base font-semibold text-rose-200 mb-1">{title}</h3>
      <p className="text-xs font-mono text-rose-300/80 mb-6 bg-rose-950/60 p-3 rounded-lg border border-rose-900/50 w-full text-left overflow-x-auto">
        {message}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium tracking-wide transition-all shadow-lg shadow-rose-950/50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Operation
          </button>
        )}
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium tracking-wide transition-all border border-slate-700"
        >
          <Home className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
