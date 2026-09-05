# Evaluation

> Status: ✅ **Validation/uncertainty implemented & exercised.** 🧪 Quantitative metrics require an HR reference (only available for the synthetic demo, not live uploads); uncertainty is self-consistency-based in the backend.

## Metrics

All reference-based metrics are computed in `model/evaluation/metrics.py` on
`[B,C,H,W]` reflectance tensors, averaged across the batch. `data_range = 1.5`.

| Metric | Definition | Lower / Upper |
|---|---|---|
| **PSNR** | `10·log10(data_range² / MSE)` over mean MSE across bands (dB) | ↑ |
| **SSIM** | `1 − SsimLoss` (Structural Similarity, 0–1) | ↑ |
| **SAM** | Mean spectral angle across bands, **degrees** | ↓ |
| **ERGAS** | Wald (2002): `(100/d)·√(mean_b(RMSE_b/µ_b)²)`, `d` = resolution ratio | ↓ |

For live uploads (no HR reference), the report returns these fields as `null` and states:
`Reference-based quantitative validation unavailable for this scene.`

## Uncertainty / confidence

`model/evaluation/uncertainty.py` produces a per-pixel confidence map in `[0, 1]` (1 =
confident) and a numeric summary. Two methods:

1. **Self-consistency (round-trip)** — the LR input is the only evidence the model has.
   The SR output is degraded back to LR with the *same* `degradation.degrade` operator
   used in training; where the round-trip fails to reproduce the input, the model
   invented unsupported structure → low confidence. Used by the **backend**
   (`geosr_backend.run_validation`).
2. **Input-perturbation ensemble** — run the model `n` times with small Gaussian noise on
   the LR tensor, measure per-pixel prediction spread. Used by the **CLI**
   (`run_inference --ensemble`).

### Honest framing

Confidence is a **reliability** indicator, **not** a per-pixel correctness label. It can
be optimistic on smooth regions, and a model can be confidently wrong. Without an HR
ground truth, "correctness" is never measured — only *self-consistency* and *sensitivity*.

## Measured results

### Live backend e2e (real model, no HR reference)

A full `POST /api/upload → /process → poll → /download` run on
`data/sample_sentinel2_10m.tif` (256×256 @ 10 m, EPSG:32643):

- Status: `COMPLETED`, `is_demo=false`, elapsed ~1.8–7.4 s (model cached after first load).
- Output GeoTIFF: **1024×1024, 4 bands, EPSG:32643, 2.5 m, uint16** — CRS preserved.
- Validation report: `reference_available=false`, PSNR/SSIM/SAM/ERGAS = `null`,
  self-consistency confidence ≈ **6.63 / 100**.

### Phase 9 SIH demo (real model vs. synthetic 2.5 m references)

Precomputed offline by `model/demo/prepare_sih_demo.py`. Numbers are **real**, measured
from the trained checkpoint; the 10 m input is the only feed the model sees.

| Scene | PSNR (dB) | SSIM | SAM (°) | ERGAS | Confidence | Inf. time |
|---|---|---|---|---|---|---|
| Urban | 23.64 | 0.430 | 7.53 | 4.76 | 9.1% | 402 ms |
| Agriculture | 25.20 | 0.512 | 7.61 | 5.26 | 7.8% | 163 ms |
| Water | 28.15 | 0.709 | 15.29 | 7.54 | 6.3% | 196 ms |

### Training-distribution baseline (40 m→10 m, for context only)

`best_val_psnr = 27.92 dB / SSIM 0.690 / SAM 10.60°` (epoch 1, val split). The demo
numbers sit **below** this because they are the out-of-distribution 10 m→2.5 m
extrapolation regime — see [dataset.md](dataset.md).

## Verification

```bash
python -m pytest -q                       # 34 passed (covers metrics, reconstruction, alignment)
python model/inference.py --input data/sample_sentinel2_10m.tif \
  --checkpoint model/checkpoints/advanced_geosr_baseline_run/checkpoint_best.pt \
  --output /tmp/sr.tif --report /tmp/report.json   # produces confidence + report
```
