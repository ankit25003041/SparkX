# Model

> Status: ✅ **Trained checkpoint + inference implemented** (CPU). 🧪 Synthetic training data; extrapolation at inference. ⌛ GPU serving, 12-band, real-data finetuning planned.

## Architecture — GeoSR-ESRGAN

A residual-in-residual dense generator with an ESRGAN-style upscaling head, trained with
a compound loss. Implemented in `model/architectures/advanced_sr.py`
(`build_advanced` / `build_baseline`).

### Design choices

- **Global residual.** `use_global_residual=true`: the network learns a residual around
  the bicubically-upsampled input, which stabilizes reflectance preservation.
- **4 input/output channels** (B02/B03/B04/B08), multispectral end-to-end.
- **4× upscaling** realized with sub-pixel/shuffle-style upsampling; the operator is
  scale-agnostic per training, so the same weights apply to any 4× task.

## Training (Phase 6)

`model/training/train.py` with the config frozen into the checkpoint
(`checkpoint_best.pt` → `config.json`).

| Field | Value |
|---|---|
| Patch size | 64 |
| Scale | 4× |
| Epochs | 2 (seed 42) |
| Batch size | 8 |
| Optimizer | AdamW · lr 1e-4 · weight_decay 1e-5 · cosine schedule |
| Loss | GeoSR compound = L1(1.0) + Spectral(0.2) + SSIM(0.1) + Edge(0.05) + TV(0.0) |
| Gradient clip | 0.0 (disabled) |
| Mixed precision | disabled (`use_amp=false`) |

### Train log (`model/checkpoints/advanced_geosr_baseline_run/train.log`)

```
[epoch 000] train_loss=0.2654 (0.097/0.358/0.097) val_psnr=27.766 ssim=0.682 sam=10.784 ergas=7.044 BEST
[epoch 001] train_loss=0.2470 (0.089/0.333/0.092) val_psnr=27.923 ssim=0.690 sam=10.604 ergas=6.912 BEST
[done] best_val_psnr=27.9231
```

`best_val_psnr=27.92 dB` is the **40 m→10 m** training-distribution metric. The 10 m→2.5 m
numbers in [ Evaluation ](evaluation.md) and the demo are the held-out extrapolation regime.

## Inference (Phase 7)

- **Batch CLI** — `model/inference.py`: whole-image for small inputs, or a 512 px tiled
  sliding window (`DEFAULT_TILE = 512`) with Hann-window blending for large scenes.
  Writes a CRS/geotransform-preserving uint16 GeoTIFF, a confidence map, and a
  validation report JSON.
- **Backend service** — `backend/app/processing/geosr_backend.py` wraps the checkpoint as
  a numpy→numpy `model_fn` (the contract expected by `process_satellite_image`). Input is
  reflectance `[0, 1.5]`; output is clipped and returned for denormalization.

### Reproducibility

- Seed 42 is fixed for dataset generation and weight init.
- Inference is deterministic (`torch.no_grad`, `model.eval()`, CPU; no dropout at test
  time). Two consecutive runs produce byte-identical SR GeoTIFFs.
- CPU-only in this environment; results are reproducible on any machine with the same
  checkpoint.

## Memory & runtime (CPU)

Measured on the 256×256 sample (single forward pass, no tiling):

| Scene | Inference time | Output size |
|---|---|---|
| Sample (256×256) | ~1.0–1.5 s | 1024×1024 |

The demo precompute times (163–402 ms) are per-tile figures from the batched path.

## Checkpoint availability

`model/checkpoints/advanced_geosr_baseline_run/checkpoint_best.pt` is present on disk but
**gitignored** (see `.gitignore` → `*.pt`, `model/checkpoints/*`). It must be provided
locally to run real-SR inference.
