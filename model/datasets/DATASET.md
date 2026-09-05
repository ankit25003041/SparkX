# GeoSR Training Dataset (Phase 4)

Synthetic paired **Low-Resolution ↔ High-Resolution** Sentinel-2 multispectral
data for super-resolution model training. Built on the controlled-degradation
paradigm (HR → blur → downsample → noise → LR).

> **Scientific honesty (read this first):** synthetic degradation does **NOT**
> perfectly reproduce Sentinel-2 acquisition physics. Real acquisition involves
> wavelength-dependent point-spread functions, on-board attitude jitter, spectral
> band co-registration offsets, detector striping, and quantization noise — none
> of which are fully modelled here. This dataset is a **training approximation**
> whose purpose is to teach the network the *structural* LR→HR mapping so that
> the learned priors generalise to real Sentinel-2 imagery. It is not a physical
> satellite simulator. See [Limitations](#limitations).

---

## 1. Source

| Field | Value |
|---|---|
| Sensor | Sentinel-2 L2A (MSI), 10 m bands |
| Source file | `data/sample_sentinel2_10m.tif` (prototype scene) |
| Producer | ESA Copernicus (real data) / `scripts/generate_sample_sentinel2.py` (prototype synthetic) |
| Bands | B02 (Blue 490 nm), B03 (Green 560 nm), B04 (Red 665 nm), B08 (NIR 842 nm) |
| Layout | Channel-first `[C, H, W]` = `[4, H, W]` |
| Data type | Stored as `uint16` DN; normalized to `float32` BOA reflectance |

## 2. Geographic coverage

| Field | Value |
|---|---|
| CRS | `EPSG:32643` (WGS 84 / UTM Zone 43N) |
| GSD (HR) | 10.0 m |
| GSD (LR, 4×) | 40.0 m |
| Footprint | 256 × 256 px @ 10 m (prototype scene; northern India near Delhi) |

> The prototype uses a single synthetic scene so the pipeline can be exercised
> end-to-end. In production this generalises to any Sentinel-2 L2A tile.

## 3. Bands & channel correspondence

Band order is fixed everywhere in the pipeline as
`[B02, B03, B04, B08]` (blue, green, red, NIR). All degradation and
augmentation operations are **applied identically per-band**, so the
LR↔HR channel correspondence is exact — band *i* in the LR always
corresponds to band *i* in the HR.

## 4. Spatial resolution

| Tier | Resolution | Role |
|---|---|---|
| HR (reference) | 10 m | Real Sentinel-2 10 m bands (ground truth) |
| LR (synthetic) | `10 m × scale_factor` (default 4 → 40 m) | Model input |

The 10 m bands are the **HR reference** because sub-4 m ground truth does not
exist for Sentinel-2. Real 2.5 m reference imagery would be required for a
physical 10 m→2.5 m trainer; until then the synthetic pipeline trains the
*structure* of an r× super-resolver on the best available Sentinel-2 resolution.

## 5. Preprocessing

1. **Band selection** — `[B02, B03, B04, B08]` resolved via band descriptions
   (or standard 12-band S2 layout indices `[2,3,4,8]`). Mirrors the backend
   `RasterReader.identify_10m_band_indices`.
2. **Radiometric normalization** — `DN / 10000` → BOA reflectance, clipped to
   `[0.0, 1.5]` (Sentinel-2 L2A BOA convention, matching
   `backend/app/processing/normalization.py` `Normalizer`).
3. **NoData handling** — pixels equal to `nodata` (or non-finite) are flagged;
   during training they are retained but their presence is recorded per-patch in
   the dataset metadata so they can be masked in loss computation.

## 6. Degradation model (HR → LR)

Implemented in `model/datasets/degradation.py`, `DegradationConfig`:

```
HR reflectance [C,H,W]
  ──► Gaussian PSF blur        (scipy gaussian_filter, sigma configurable)
  ──► Area-averaging downsample (strided mean-pool, integer scale_factor)
  ──► Additive Gaussian noise  (sensor read/photon noise approx.)
  ──► Clip to [0, 1.5]
  ──► LR reflectance  [C, H//s, W//s]
```

| Step | Physical analogue (approx.) | Parameter | Default |
|---|---|---|---|
| Gaussian blur | Optics + atmospheric MTF | `gaussian_sigma` | 1.0 HR px |
| Area-average downsample | Sensor integration + spatial decimation | `scale_factor` | 4 |
| Additive noise | Read + photon noise | `noise_std` | 0.01 reflectance |
| Anti-alias | Pre-filter before decimation | `anti_alias` | True |

**Reproducibility:** noise is drawn from `numpy.random.default_rng(seed)`
where `seed = base_seed * 100003 + patch_index * 97 + scale_factor`, so each
patch's LR is **deterministic** regardless of access order or epoch.

## 7. Augmentation

Implemented in `model/datasets/transforms.py`, `PairedTransform`:
only **axis-aligned, grid-preserving** operations are used so LR and HR stay
perfectly registered:

- horizontal / vertical flip
- 90° rotation (k ∈ {0,1,2,3})
- optional transpose (H↔W)

Every augmentation decision is sampled **once** and applied to **both** LR and HR
with identical parameters. Augmentation is off for validation/test
(`default_eval_transform` = identity).

## 8. Split strategy (no spatial leakage)

Implemented in `model/datasets/splits.py`, `SplitManager`:

1. A non-overlapping tile grid of `patch_size` is laid over the HR image with a
   configurable `overlap`/`stride`.
2. The tile list is **seeded-shuffled** and partitioned by `ratios` into
   `train` / `validation` / `test`.
3. Because each split owns a **disjoint subset of tile coordinates**, no pixel
   region appears in more than one split — preventing the spatial leakage that
   naïve random splitting would introduce on geospatial data.

The split is persisted as `manifest.json` (`SplitManager.save`/`load`) so any
experiment can reload the **exact same** train/val/test assignment.

Verified on the prototype scene (256×256, patch 64):
`train=13, val=2, test=1` — reproducible (`reproducible: True`),
disjoint (`no leakage: True`), full-coverage.

## 9. Dataset object

`model/datasets/dataset.py` → `SatelliteSRDataset(torch.utils.data.Dataset)`.

```python
{"lr": Tensor[C, H//s, W//s], "hr": Tensor[C, H, W], "metadata": {...}}
```

Per-item `metadata` includes: `scene_id, split, patch_index, y, x,
hr_shape, lr_shape, crs, gsd_hr, gsd_lr, bands, scale_factor,
nodata_present, value_range_hr, value_range_lr`.

## 10. Quality checks

`python model/datasets/quality_checks.py` renders 4-panel composites
(HR true-colour, LR, LR bicubic-upsampled, |HR−LR↑| residual) and verifies,
per sampled pair:

* **dimensions** — `lr == hr / scale_factor`
* **channels** — LR and HR share the same 4-band order
* **value ranges** — within `[0.0, 1.5]` reflectance
* **missing data** — nodata pixel coverage reported
* **alignment** — bicubic LR upsample aligns exactly to the HR grid

Run the end-to-end pipeline:

```bash
# 1. (optional) regenerate the manifest / metadata
python model/datasets/prepare_dataset.py \
    --tiff data/sample_sentinel2_10m.tif --patch-size 64 --scale 4 --seed 42

# 2. run quality checks
python model/datasets/quality_checks.py \
    --tiff data/sample_sentinel2_10m.tif --split train --n-samples 6
```

Outputs:
`model/datasets/_quality_checks/<split>_s4_ps64/*.png` + `report.json`.

## 11. Reproducibility checklist

- [x] Deterministic degradation (per-patch seeded RNG).
- [x] Seeded split assignment; identical on recompute.
- [x] Split assignment persisted to `manifest.json`.
- [x] Augmentation seed mixes `seed + epoch + patch_index` (`dataset.set_epoch`).
- [x] Normalization is a fixed `DN/10000 → [0,1.5]` mapping.

## 12. Limitations

1. **Synthetic ≈ real.** Degradation is a *parameterized approximation* of the
   Sentinel-2 imaging chain, not a physics-based simulator. Band-dependent PSFs,
   on-orbit jitter, and inter-band co-registration are not modelled.
2. **No true sub-4 m ground truth.** The 10 m bands are reused as the HR
   reference; the eventual 10 m→2.5 m target therefore trains on a synthetic
   LR↔HR proxy relationship.
3. **Single-scene prototype.** The bundled TIFF is one 256×256 tile; real
   training will stack many scenes. Split disjointness is guaranteed *within* a
   scene (spatial) and should also be enforced *across* scenes/geographic
   tiles in production to avoid geographic overlap between splits.
4. **Single noise model.** Additive Gaussian noise is a simplification; real
   SAR/optical noise is signal-dependent and spatially correlated.
5. **No atmospheric variability.** All bands share the same blur/noise profile;
   real acquisitions have scene-varying aerosol and water-vapour conditions.
