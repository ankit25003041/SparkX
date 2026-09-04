'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RotateCcw,
  Activity
} from 'lucide-react';
import { ProcessingPipeline } from '../../../components/ProcessingPipeline';
import { PIPELINE_STEPS, SCENE_PRESETS, generatePipelineLogs, AVAILABLE_MODELS } from '../../../lib/mockData';
import { PipelineLogEntry, PipelineStageId } from '../../../types/geosr';
import { LoadingState } from '../../../components/LoadingState';

function ProcessingContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = typeof params?.id === 'string' ? params.id : 'geosr_delhi_01';
  const modelId = searchParams.get('model') || 'geosr_esrgan';
  const scale = searchParams.get('scale') || '4';

  const matchedPreset = SCENE_PRESETS.find((p) => p.id === id || id.includes(p.id.replace('s2_', ''))) || SCENE_PRESETS[0];
  const matchedModel = AVAILABLE_MODELS.find((m) => m.id === modelId) || AVAILABLE_MODELS[0];

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(5);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [logs, setLogs] = useState<PipelineLogEntry[]>(() => 
    generatePipelineLogs('ingestion', matchedPreset.title, matchedModel.name)
  );
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);

  // Simulation timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed seconds timer
  useEffect(() => {
    if (isComplete || isCancelled) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete, isCancelled]);

  // Multi-step pipeline progression
  useEffect(() => {
    if (isCancelled) return;

    const stageOrder: PipelineStageId[] = [
      'ingestion',
      'preprocessing',
      'tiling',
      'feature_extraction',
      'super_resolution',
      'reconstruction',
      'validation',
      'complete',
    ];

    const runStage = (index: number) => {
      if (index >= stageOrder.length) {
        setIsComplete(true);
        setProgressPercent(100);
        return;
      }

      setCurrentStepIndex(index);

      const targetPercent = Math.min(100, Math.round(((index + 1) / stageOrder.length) * 100));
      setProgressPercent(targetPercent);

      // Append stage logs
      const newLogs = generatePipelineLogs(stageOrder[index], matchedPreset.title, matchedModel.name);
      setLogs((prev) => [...prev, ...newLogs]);

      const stageDuration = PIPELINE_STEPS[index]?.durationMs || 1000;

      timerRef.current = setTimeout(() => {
        if (!isCancelled) {
          runStage(index + 1);
        }
      }, stageDuration);
    };

    // Kick off stage progression starting from stage 1 (stage 0 initialized in state)
    timerRef.current = setTimeout(() => {
      runStage(1);
    }, PIPELINE_STEPS[0].durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, isCancelled, matchedPreset.title, matchedModel.name]);

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsCancelled(true);
    setLogs((prev) => [
      ...prev,
      {
        id: 'cancel_log',
        timestamp: new Date().toISOString().substring(11, 19),
        level: 'WARN',
        message: 'Pipeline execution aborted by user signal SIGINT. Worker resources released.',
        stageId: 'ingestion',
      },
    ]);
  };

  const handleRestart = () => {
    setIsCancelled(false);
    setIsComplete(false);
    setCurrentStepIndex(0);
    setProgressPercent(5);
    setElapsedSeconds(0);
    setLogs(generatePipelineLogs('ingestion', matchedPreset.title, matchedModel.name));
  };

  const resultUrl = `/results/${id}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header with Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Activity className="w-3.5 h-3.5" />
              Real-Time Inference Engine • Job ID: {id}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Executing Super-Resolution Pipeline
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Scene: {matchedPreset.title} • Model: {matchedModel.name} ({scale}x GSD Boost)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Upload
            </Link>
            {isCancelled && (
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Pipeline
              </button>
            )}
          </div>
        </div>

        {/* Main Pipeline Component */}
        <ProcessingPipeline
          steps={PIPELINE_STEPS}
          currentStepIndex={currentStepIndex}
          progressPercent={progressPercent}
          elapsedSeconds={elapsedSeconds}
          logs={logs}
          isComplete={isComplete}
          isCancelled={isCancelled}
          onCancel={handleCancel}
          resultUrl={resultUrl}
        />
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <LoadingState message="Connecting to GeoSR inference cluster..." />
        </div>
      }
    >
      <ProcessingContent />
    </Suspense>
  );
}
