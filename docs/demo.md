# Demo (Phase 9 SIH Demonstration)

> Status: ✅ **Implemented & precomputed.** The `/demo` UI serves real metrics and real preview PNG assets with no runtime model required. 🧪 Scenes are synthetic (not real satellite imagery); the 10 m→2.5 m task is out-of-distribution for the 40 m→10 m-trained model.

## What the demo is

A zero-backend-runtime, **real-metric** demonstration for the SIH evaluator walk-through.
Three synthetic Sentinel-2-like scenes are fully rendered offline by
`model/demo/prepare_sih_demo.py`:

1. Run the trained checkpoint (`model/inference.py` semantics) on a degraded 10 m input.
2. Score reconstruction against a synthetic 2.5 m ground-truth reference (PSNR/SSIM/SAM/ERGAS).
3. Compute pixel-wise self-consistency confidence.
4. Emit **real** artifacts consumed by the frontend:

```
frontend/public/samples/sih/{urban,agriculture,water}/
  lr_preview.png     sr_preview.png      confidence_preview.png
frontend/src/data/sihDemoScenes.ts     # real metric JSON (typed)
data/demo/{urban,agriculture,water}/
  lr_input.tif  hr_reference.tif  sr_output.tif
  confidence_sr_output.tif/.png  validation_report.json  demo_metadata.json
```

## What the demo is NOT

- It does **not** run torch or the model in the browser. All SR is precomputed.
- It does **not** use real Sentinel-2 imagery. Scenes are procedurally generated
  reflectance with realistic spatial structure for urban/agricultural/water classes.
- It does **not** claim to recover "true" 2.5 m detail — 10 m→2.5 m is out-of-training
  distribution. The metrics are an **honest measure of extrapolation**.

## Real metrics shown

| Scene | PSNR | SSIM | SAM | ERGAS | Confidence | Inf. time |
|---|---|---|---|---|---|---|
| Urban | 23.64 dB | 0.430 | 7.53° | 4.76 | 9.1% | 402 ms |
| Agriculture | 25.20 dB | 0.512 | 7.61° | 5.26 | 7.8% | 163 ms |
| Water | 28.15 dB | 0.709 | 15.29° | 7.54 | 6.3% | 196 ms |

> Confidence is low (6–9%) by design: these scenes have **100% high-uncertainty pixels**
> under the self-consistency criterion, reflecting that almost all 2.5 m detail is
> extrapolated beyond the 10 m input signal.

## Frontend

- `/demo` — scene picker with thumbnail cards.
- `/demo/{id}` — results screen:
  - before/after **swipe** (10 m input / 2.5 m SR) and confidence overlay toggle,
  - band-combination selector, zoom/magnifier, fullscreen,
  - metric cards + **How it works** / **Technical info** / **Spectral bands** panels,
  - PNG artifact downloads (SR preview, LR preview, confidence map).

## Regenerating the demo

```bash
export GEOSR_CHECKPOINT=model/checkpoints/advanced_geosr_baseline_run/checkpoint_best.pt
python model/demo/prepare_sih_demo.py
```
Requires the checkpoint and `data/sample_sentinel2_10m.tif` (both gitignored — see
[model.md](model.md)).

## Relationship to the live uploader

| Feature | Live `/upload` flow | `/demo` precompute |
|---|---|---|
| Runs torch | ✅ yes (if checkpoint set) | ✅ once, offline |
| HR reference | ❌ none (real upload) | ✅ synthetic 2.5 m reference |
| Metrics | PSNR/SSIM/SAM = null, confidence = self-consistency | Real PSNR/SSIM/SAM/ERGAS |
| `is_demo` | `false` (real SR) | n/a (precomputed, real) |

## Known gaps (post-Phase 10)

- 🧪 GIS Explorer (`/explorer`) still renders demo `SCENE_PRESETS`, not real uploaded
  rasters — ⌛ planned wiring.
- ⌛ Validation-report download currently links to GitHub; a backend route to serve
  `data/demo/<scene>/validation_report.json` is planned.
