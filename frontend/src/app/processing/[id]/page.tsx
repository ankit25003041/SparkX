'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RotateCcw,
  Activity,
  Trash2,
} from 'lucide-react';
import { ProcessingPipeline } from '../../../components/ProcessingPipeline';
import { PIPELINE_STEPS, SCENE_PRESETS, AVAILABLE_MODELS, generatePipelineLogs } from '../../../lib/mockData';
import { fetchJobStatus, fetchJobDetail } from '../../../lib/api';
import { JobStatusResponse, PipelineLogEntry, PipelineStageId } from '../../../types/geosr';
import { LoadingState } from '../../../components/LoadingState';

type Mode = 'loading' | 'real' | 'demo';

const REAL_STAGE_ORDER: PipelineStageId[] = [
  'ingestion',
  'preprocessing',
  'tiling',
  'feature_extraction',
  'super_resolution',
  'reconstruction',
  'validation',
  'complete',
];

function stageIndexFromStage(stage: string): number {
  const s = (stage || '').toLowerCase();
  if (s.includes('ingest')) return 0;
  if (s.includes('preprocess')) return 1;
  if (s.includes('tile')) return 2;
  if (s.includes('inference')) return 3;
  if (s.includes('reconstruct')) return 4;
  if (s.includes('align') || s.includes('validat')) return 5;
  if (s.includes('uncertain') || s.includes('confidence')) return 6;
  if (s.includes('export') || s.includes('preview') || s.includes('finaliz')) return 7;
  return 0;
}

function ProcessingContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = typeof params?.id === 'string' ? params.id : 'geosr_delhi_01';
  const modelId = searchParams.get('model') || 'geosr_esrgan';
  const scale = searchParams.get('scale') || '4';

  const matchedPreset = SCENE_PRESETS.find((p) => p.id === id || id.includes(p.id.replace('s2_', ''))) || SCENE_PRESETS[0];
  const matchedModel = AVAILABLE_MODELS.find((m) => m.id === modelId) || AVAILABLE_MODELS[0];

  const [mode, setMode] = useState<Mode>('loading');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(5);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [logs, setLogs] = useState<PipelineLogEntry[]>(
    () => generatePipelineLogs('ingestion', matchedPreset.title, matchedModel.name)
  );
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneTitle, setSceneTitle] = useState<string>(matchedPreset.title);
  const [sceneCrs, setSceneCrs] = useState<string>(matchedPreset.crs);

  const demoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStageRef = useRef<string | null>(null);

  const appendRealLog = (stage: string) => {
    const stageId: PipelineStageId =
      (stage.toLowerCase().includes('ingest') && 'ingestion') ||
      (stage.toLowerCase().includes('preprocess') && 'preprocessing') ||
      (stage.toLowerCase().includes('tile') && 'tiling') ||
      (stage.toLowerCase().includes('inference') && 'super_resolution') ||
      (stage.toLowerCase().includes('reconstruct') && 'reconstruction') ||
      ((stage.toLowerCase().includes('align') || stage.toLowerCase().includes('validat')) && 'validation') ||
      ((stage.toLowerCase().includes('uncertain') || stage.toLowerCase().includes('confidence')) && 'complete') ||
      'complete';
    setLogs((prev) => [
      ...prev,
      {
        id: `${stage}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString().substring(11, 19),
        level: 'INFO',
        message: `Backend: ${stage}`,
        stageId,
      },
    ]);
  };

  // --- Real backend mode: poll /status + /{id} ---
  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        const detail = await fetchJobDetail(id);
        const status = await fetchJobStatus(id);
        if (cancelled) return;

        if (detail && status) {
          setMode('real');
          setSceneTitle(detail.metadata?.filename || id);
          setSceneCrs(detail.metadata?.crs || matchedPreset.crs);
          setProgressPercent(status.progress);
          setCurrentStepIndex(stageIndexFromStage(status.stage));
          setElapsedSeconds(status.elapsed_seconds);
          appendRealLog(status.stage);
          lastStageRef.current = status.stage;

           const normStatus = (s: string) => s.toLowerCase();
           if (normStatus(status.status) === 'completed') {
             setIsComplete(true);
             setProgressPercent(100);
           } else if (normStatus(status.status) === 'failed') {
             setError(status.error_message || 'Job failed');
           } else {
             pollId = setInterval(async () => {
               const st: JobStatusResponse | null = await fetchJobStatus(id);
               if (!st || cancelled) return;
               setProgressPercent(st.progress);
               setCurrentStepIndex(stageIndexFromStage(st.stage));
               setElapsedSeconds(st.elapsed_seconds);
               if (st.stage !== lastStageRef.current) {
                 appendRealLog(st.stage);
                 lastStageRef.current = st.stage;
               }
               if (normStatus(st.status) === 'completed') {
                 setIsComplete(true);
                 setProgressPercent(100);
                 if (pollId) clearInterval(pollId);
               } else if (normStatus(st.status) === 'failed') {
                 setError(st.error_message || 'Job failed');
                 if (pollId) clearInterval(pollId);
               }
             }, 1500);
           }
        } else {
          setMode('demo');
        }
      } catch {
        if (!cancelled) setMode('demo');
      }
    }

    init();
    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: effect
    // is keyed on job id; matchedPreset is read once on mount to seed fallback CRS.
  }, [id]);

  // --- Demo simulation (fallback when backend unreachable) ---
  useEffect(() => {
    if (mode !== 'demo') return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const stageOrder = REAL_STAGE_ORDER;
    const runStage = (index: number) => {
      if (index >= stageOrder.length) {
        setIsComplete(true);
        setProgressPercent(100);
        return;
      }
      setCurrentStepIndex(index);
      const targetPercent = Math.min(100, Math.round(((index + 1) / stageOrder.length) * 100));
      setProgressPercent(targetPercent);
      const newLogs = generatePipelineLogs(stageOrder[index], matchedPreset.title, matchedModel.name);
      setLogs((prev) => [...prev, ...newLogs]);
      demoTimerRef.current = setTimeout(() => {
        if (!isCancelled) runStage(index + 1);
      }, PIPELINE_STEPS[index]?.durationMs || 1000);
    };

    demoTimerRef.current = setTimeout(() => {
      runStage(1);
    }, PIPELINE_STEPS[0].durationMs);

    return () => {
      clearInterval(interval);
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
  }, [mode, isCancelled, matchedPreset.title, matchedModel.name]);

  const handleCancel = async () => {
    if (mode === 'real') {
      try {
        await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      } catch {
        /* non-fatal */
      }
    }
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
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
    setError(null);
    setCurrentStepIndex(0);
    setProgressPercent(5);
    setElapsedSeconds(0);
    setLogs(generatePipelineLogs('ingestion', matchedPreset.title, matchedModel.name));
    if (mode === 'real') {
      fetchJobStatus(id).then((st) => {
        if (st) {
          setProgressPercent(st.progress);
          setCurrentStepIndex(stageIndexFromStage(st.stage));
        }
      });
    }
  };

  const resultUrl = `/results/${id}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Activity className="w-3.5 h-3.5" />
              {mode === 'real' ? 'Real-Time Inference Engine' : 'Demo Inference Engine'} • Job ID: {id}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Executing Super-Resolution Pipeline
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Scene: {sceneTitle} • Model: {matchedModel.name} ({scale}x GSD Boost) • CRS: {sceneCrs}
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
            {!isCancelled && mode === 'real' && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 text-xs font-mono transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Cancel Job
              </button>
            )}
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

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300">
            {error}
          </div>
        )}

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
