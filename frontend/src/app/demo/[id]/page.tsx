'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { SIH_DEMO_SCENES, SihDemoScene } from '@/data/sihDemoScenes';
import { ImageComparison } from '@/components/ImageComparison';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { BandCombination } from '@/types/geosr';
import {
  Zap,
  ArrowLeft,
  BarChart3,
  Compass,
  Clock,
  Sparkles,
  ShieldCheck,
  Download,
  Info,
  Palette,
  Globe,
  Layers,
  FileText,
  ExternalLink,
} from 'lucide-react';

const SCALE_FACTOR = 4;

export default function SihDemoResultsPage() {
  const params = useParams();
  const sceneId = params?.id as string | undefined;
  const scene = sceneId
    ? SIH_DEMO_SCENES.find((s) => s.id === sceneId)
    : undefined;

  if (!scene) {
    notFound();
  }

  const [bandCombo, setBandCombo] = useState<BandCombination>('RGB');
  const [openSection, setOpenSection] = useState<'works' | 'tech' | 'spectral'>('works');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackLink />

        <Header scene={scene} />

        <MetricsRow scene={scene} />

        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Before / After Super-Resolution
          </h2>
          <p className="text-xs text-slate-400 mb-3 max-w-3xl">
            Left: 10 m Sentinel-2-style input (B02/B03/B04/B08 RGB). Right:
            GeoSR-ESRGAN 2.5 m reconstruction. Drag the slider to compare. The
            confidence overlay shows pixel-wise reconstruction certainty (0 =
            extrapolated detail, 1 = grounded).
          </p>
          <ImageComparison
            lowResImageUrl={scene.web_previews.lr_preview}
            superResImageUrl={scene.web_previews.sr_preview}
            uncertaintyMapUrl={scene.web_previews.confidence_preview}
            title={`${scene.title} — 10 m → 2.5 m`}
            coordinates={[28.6139, 77.209]}
            scaleFactor={SCALE_FACTOR}
            initialMode="swipe"
            bandCombination={bandCombo}
            onBandCombinationChange={setBandCombo}
            className="h-[620px]"
          />
        </section>

        <Accordion
          openSection={openSection}
          setOpenSection={setOpenSection}
          scene={scene}
        />

        <Downloads scene={scene} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/demo"
      className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors mb-6"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back to SIH Demo scenes
    </Link>
  );
}

function Header({ scene }: { scene: SihDemoScene }) {
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {scene.title}
        </h1>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
          {scene.category}
        </span>
        <StatusBadge status="completed" showIcon={true} />
      </div>
      <p className="mt-2 text-sm text-slate-300 max-w-3xl">
        {scene.location}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
        <span className="flex items-center gap-1">
          <Globe className="w-3.5 h-3.5" /> CRS: {scene.crs}
        </span>
        <span className="flex items-center gap-1">
          <Palette className="w-3.5 h-3.5" /> {scene.bands.join(' · ')}
        </span>
      </div>
    </section>
  );
}

function MetricsRow({ scene }: { scene: SihDemoScene }) {
  const { psnr, ssim, sam, ergas } = scene.metrics;
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      <MetricCard
        label="Peak SNR"
        value={psnr != null ? psnr.toFixed(2) : '—'}
        unit="dB"
        delta={psnr != null ? `Δ ${ssim != null ? (ssim * 100).toFixed(0) : '—'}% structure` : undefined}
        benchmark="> 30 dB (training target)"
        description={scene.scene_note}
        icon={<Sparkles className="w-5 h-5" />}
        isDemo={true}
      />
      <MetricCard
        label="Structural Similarity"
        value={ssim != null ? ssim.toFixed(3) : '—'}
        unit={ssim != null ? '' : undefined}
        benchmark="> 0.88 (training target)"
        description="Structural correlation vs. the 2.5 m reference (4-band RGB+NIR)."
        icon={<ShieldCheck className="w-5 h-5" />}
        isDemo={true}
      />
      <MetricCard
        label="Spectral Angle"
        value={sam != null ? sam.toFixed(2) : '—'}
        unit={sam != null ? '°' : undefined}
        benchmark="< 3.0° (training target)"
        description="Mean spectral angle across B02/B03/B04/B08 (lower is better)."
        icon={<Compass className="w-5 h-5" />}
        isDemo={true}
      />
      <MetricCard
        label="Inference Time"
        value={scene.inference_time_ms.toFixed(1)}
        unit="ms"
        benchmark="< 500 ms"
        description="Wall-clock for a 256×256 tile (single forward pass, CPU)."
        icon={<Clock className="w-5 h-5" />}
        isDemo={true}
      />
      <MetricCard
        label="ERGAS"
        value={ergas != null ? ergas.toFixed(2) : '—'}
        unit={ergas != null ? '' : undefined}
        benchmark="< 5.0 (training target)"
        description="Relative average spectral error (0 = perfect)."
        icon={<BarChart3 className="w-5 h-5" />}
        isDemo={true}
      />
      <MetricCard
        label="Confidence"
        value={scene.confidence_score != null ? scene.confidence_score.toFixed(1) : '—'}
        unit={scene.confidence_score != null ? '/100' : undefined}
        benchmark="Self-consistency"
        description="Pixel-wise ensemble self-consistency (see uncertainty summary)."
        icon={<Info className="w-5 h-5" />}
        isDemo={true}
      />
    </section>
  );
}

function Accordion({
  openSection,
  setOpenSection,
  scene,
}: {
  openSection: 'works' | 'tech' | 'spectral';
  setOpenSection: (v: 'works' | 'tech' | 'spectral') => void;
  scene: SihDemoScene;
}) {
  const items: { id: 'works' | 'tech' | 'spectral'; label: string; icon: React.ReactNode }[] = [
    { id: 'works', label: 'How it works', icon: <Zap className="w-4 h-4" /> },
    { id: 'tech', label: 'Technical info', icon: <FileText className="w-4 h-4" /> },
    { id: 'spectral', label: 'Spectral bands', icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <section className="mb-12 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800">
        {items.map((it) => {
          const active = openSection === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setOpenSection(it.id)}
              className={
                'flex items-center gap-1.5 px-3 py-2 text-sm font-mono transition-colors ' +
                (active
                  ? 'text-cyan-300 border-b-2 border-cyan-500'
                  : 'text-slate-400 hover:text-slate-200')
              }
            >
              {it.icon}
              {it.label}
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
        {openSection === 'works' && <HowItWorks scene={scene} />}
        {openSection === 'tech' && <TechnicalInfo scene={scene} />}
        {openSection === 'spectral' && <SpectralInfo scene={scene} />}
      </div>
    </section>
  );
}

function HowItWorks({ scene }: { scene: SihDemoScene }) {
  const steps = [
    'A synthetic 2.5 m reflectance scene is generated for the selected land cover class.',
    `The reference is degraded to ${scene.gsd_input_meters} m using model/datasets/degradation.py (bicubic down + noise model).`,
    'The 10 m input is tiled into 256×256 patches and inference is run with the trained GeoSR-ESRGAN checkpoint.',
    'Reconstruction fidelity is scored only against the 2.5 m reference (PSNR/SSIM/SAM/ERGAS).',
    'Pixel-wise reconstruction confidence is computed via ensemble self-consistency (uncertainty.py).',
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
        From 10 m input to 2.5 m reconstruction
      </h3>
      <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="text-xs text-slate-400 pt-2">
        <span className="text-slate-300 font-mono">Note:</span> The 2.5 m
        reference exists only to score reconstruction. The model never sees it,
        and real 10 m Sentinel-2 imagery cannot be upscaled to true 2.5 m
        detail &mdash; this demo demonstrates the trained checkpoint
        behavior on a controlled degradation reference.
      </p>
    </div>
  );
}

function TechnicalInfo({ scene }: { scene: SihDemoScene }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Scene ID', value: scene.id },
    { label: 'Category', value: scene.category },
    { label: 'Model', value: scene.model },
    { label: 'Input GSD', value: `${scene.gsd_input_meters} m` },
    { label: 'Output GSD', value: `${scene.gsd_output_meters} m` },
    { label: 'Scale factor', value: `${scene.scale_factor}×` },
    { label: 'CRS', value: scene.crs },
    { label: 'Reference available', value: scene.reference_available ? 'Yes' : 'No' },
    { label: 'Inference time', value: `${scene.inference_time_ms.toFixed(1)} ms` },
    { label: 'Confidence score', value: `${scene.confidence_score ?? '—'}` },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
        Run specification
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4">
            <span className="text-slate-400">{r.label}</span>
            <span className="text-slate-200 font-mono text-right">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
        {scene.scene_note}
      </div>
    </div>
  );
}

function SpectralInfo({ scene }: { scene: SihDemoScene }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
        Spectral bands (4-band super-resolution)
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {scene.band_descriptions.map((b) => (
          <li
            key={b}
            className="flex items-center gap-2 text-slate-300"
          >
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono">{b}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 pt-2">
        {scene.reference_note}
      </p>
    </div>
  );
}

function Downloads({ scene }: { scene: SihDemoScene }) {
  const artifacts = [
    {
      label: 'Super-resolved preview (PNG)',
      href: scene.web_previews.sr_preview,
    },
    {
      label: '10 m input preview (PNG)',
      href: scene.web_previews.lr_preview,
    },
    {
      label: 'Confidence map (PNG)',
      href: scene.web_previews.confidence_preview,
    },
  ];

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
        <Download className="w-4 h-4 text-cyan-400" />
        Download demonstration artifacts
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Web previews are static PNG files generated during the precompute
        step. The full GeoTIFF artifacts are written to the backend under{' '}
        <span className="text-slate-300">data/demo/{scene.id}/</span>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {artifacts.map((a) => (
          <a
            key={a.label}
            href={a.href}
            download
            className="inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 transition-all text-sm"
          >
            <span className="text-slate-200 truncate">{a.label}</span>
            <Download className="w-4 h-4 text-cyan-400 shrink-0" />
          </a>
        ))}
        <a
          href="https://github.com/Kilo-Org/SparkX"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 transition-all text-sm"
        >
          <span className="text-slate-200 truncate">Validation report (JSON)</span>
          <ExternalLink className="w-4 h-4 text-cyan-400 shrink-0" />
        </a>
      </div>
    </section>
  );
}
