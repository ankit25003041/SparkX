'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Terminal, 
  AlertTriangle, 
  ChevronRight, 
  ArrowRight,
  StopCircle,
  Pause,
  Play
} from 'lucide-react';
import { PipelineStep, PipelineLogEntry, PipelineStageId } from '../types/geosr';

interface ProcessingPipelineProps {
  steps: PipelineStep[];
  currentStepIndex: number;
  progressPercent: number;
  elapsedSeconds: number;
  logs: PipelineLogEntry[];
  isComplete: boolean;
  isCancelled: boolean;
  onCancel: () => void;
  resultUrl: string;
}

export const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({
  steps,
  currentStepIndex,
  progressPercent,
  elapsedSeconds,
  logs,
  isComplete,
  isCancelled,
  onCancel,
  resultUrl,
}) => {
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom as logs stream in
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const estimatedTotalSeconds = 12;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

  return (
    <div className="space-y-6">
      {/* Top Progress & Timing Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-slate-400">
                Pipeline Status:
              </span>
              {isCancelled ? (
                <span className="text-xs font-mono font-semibold text-rose-400 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800">
                  CANCELLED
                </span>
              ) : isComplete ? (
                <span className="text-xs font-mono font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800">
                  INFERENCE COMPLETE (100%)
                </span>
              ) : (
                <span className="text-xs font-mono font-semibold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 animate-pulse">
                  STAGE {currentStepIndex + 1} OF {steps.length}: {steps[currentStepIndex]?.label.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {steps[currentStepIndex]?.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div>
              <span className="text-slate-500">Elapsed: </span>
              <span className="text-white font-bold">{elapsedSeconds}s</span>
            </div>
            {!isComplete && !isCancelled && (
              <div>
                <span className="text-slate-500">Est. Remaining: </span>
                <span className="text-cyan-400 font-bold">{remainingSeconds}s</span>
              </div>
            )}
            {!isComplete && !isCancelled && (
              <button
                onClick={onCancel}
                className="px-3 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 flex items-center gap-1.5 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                Cancel
              </button>
            )}
            {isComplete && (
              <Link
                href={resultUrl}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all animate-bounce"
                style={{ animationDuration: '2s' }}
              >
                View Results Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total Pipeline Progress</span>
            <span className="text-cyan-400 font-bold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300 shadow-sm shadow-cyan-500/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 8-Stage Visual Timeline */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Execution Stages
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((step, index) => {
            const isFinished = index < currentStepIndex || isComplete;
            const isCurrent = index === currentStepIndex && !isComplete;

            return (
              <div
                key={step.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-cyan-950/50 border-cyan-500/60 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : isFinished
                    ? 'bg-slate-950/80 border-emerald-900/40 text-slate-300'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-mono text-slate-500">
                    0{index + 1}
                  </span>
                  {isFinished ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>

                <div className="text-xs font-semibold text-white">
                  {step.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                  {step.sublabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Processing Terminal Logs */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>geosr-worker-daemon — stdout / stderr</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE TELEMETRY
          </div>
        </div>

        {/* Terminal Console Stream */}
        <div className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar bg-black/40">
          {logs.map((log) => {
            const getLevelClass = (lvl: string) => {
              switch (lvl) {
                case 'INFO':
                  return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
                case 'GEO':
                  return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
                case 'CUDA':
                  return 'text-purple-400 bg-purple-950/60 border-purple-800';
                case 'DEBUG':
                  return 'text-slate-400 bg-slate-900 border-slate-800';
                case 'WARN':
                  return 'text-amber-400 bg-amber-950/60 border-amber-800';
                default:
                  return 'text-slate-400';
              }
            };

            return (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-slate-600 shrink-0 select-none">
                  [{log.timestamp}]
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold shrink-0 ${getLevelClass(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>
                <span className="text-slate-300 break-words">{log.message}</span>
              </div>
            );
          })}
          <div ref={terminalBottomRef} />
        </div>
      </div>
    </div>
  );
};
