'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { JobStatus } from '../types/geosr';

interface StatusBadgeProps {
  status: JobStatus | 'operational' | 'degraded' | 'maintenance' | 'idle';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  className = '',
}) => {
  switch (status) {
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 ${className}`}>
          {showIcon && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          COMPLETED
        </span>
      );
    case 'processing':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 animate-pulse ${className}`}>
          {showIcon && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
          PROCESSING
        </span>
      );
    case 'queued':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60 ${className}`}>
          {showIcon && <Clock className="w-3 h-3 text-amber-400" />}
          QUEUED
        </span>
      );
    case 'failed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60 ${className}`}>
          {showIcon && <XCircle className="w-3 h-3 text-rose-400" />}
          FAILED
        </span>
      );
    case 'cancelled':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-900 text-slate-400 border border-slate-700 ${className}`}>
          {showIcon && <AlertTriangle className="w-3 h-3 text-slate-400" />}
          CANCELLED
        </span>
      );
    case 'operational':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          ONLINE
        </span>
      );
    case 'degraded':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          DEGRADED
        </span>
      );
    case 'maintenance':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-950/80 text-purple-400 border border-purple-800/60 ${className}`}>
          <Activity className="w-3 h-3 text-purple-400" />
          MAINTENANCE
        </span>
      );
    case 'idle':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-900 text-slate-400 border border-slate-800 ${className}`}>
          IDLE
        </span>
      );
  }
};
