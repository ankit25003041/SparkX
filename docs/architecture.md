# Architecture

> Status: ✅ **Implemented** (backend geospatial pipeline + 8-stage orchestration, frontend dashboard).

## Layers

```
┌──────────────────────────────┐  HTTP          ┌────────────────────────────┐
│  Frontend (Next.js 16)       │  REST/WS       │  Backend (FastAPI 0.109+)  │
│  React 19 · TS · Tailwind     │◄──────────────►│  Uvicorn · Pydantic v2     │
│  /app/{index,upload,processing│                │                            │
│    ,results,explorer,demo}    │                │  app/api/routes/*          │
└──────────────┬───────────────┘                │  app/services/job_manager  │
               │  numpy [B,C,H,W]               │  app/processing/* (8-stage)│
               ▼                                │  app/processing/            │
┌──────────────────────────────┐  torch          │    geosr_backend.py       │
│  Model (PyTorch 2.13)        │◄───────────────│  app/utils/geo_utils      │
│  model/architectures/        │   model_fn     │  rasterio · pyproj ·      │
│  model/datasets/             │  numpy batches  │   affine                   │
│  model/losses/ training/     │                │  app/schemas/ (pydantic)  │
│  model/evaluation/ inference/ │                └────────────────────────────┘
└──────────────────────────────┘
```

## Backend processing pipeline (the 8 stages)

`backend/app/processing/orchestrator.py` → `GeoSRPipeline` exposes an explicit, ordered
`PipelineStage` enum that the frontend renders as a status trail. Each stage emits a
status update through a caller-supplied callback so `JobManager` can publish progress in
real time.

| # | Stage | Responsibility | Implemented in |
|---|---|---|---|
| 1 | INGEST | Open + validate GeoTIFF header (no full-array load). | `raster_reader.py` |
| 2 | PREPROCESS | Band selection (B02/B03/B04/B08), NoData imputation, clip. | `preprocessing.py` |
| 3 | TILE | Overlapping 256×256 patches (configurable overlap), `[B,C,H,W]` batches. | `tiler.py` |
| 4 | INFERENCE | Torch SR model forward, or bicubic baseline. | `geosr_backend.py` / `pipeline.py` |
| 5 | RECONSTRUCT | 2D Hann-window feathering blend → seamless raster. | `reconstruction.py` |
| 6 | VALIDATE | Denormalize, restore NoData, write GeoTIFF, verify alignment. | `normalization.py`, `geotiff_writer.py` |
| 7 | UNCERTAINTY | Self-consistency confidence GeoTIFF + uint8 preview + JSON report. | `geosr_backend.py` → `model/evaluation/` |
| 8 | EXPORT | Finalize previews (low_res / super_res / uncertainty). | `geo_utils.py` |

`process_satellite_image` (the original `pipeline.py` driver) covers **INGEST→VALIDATE**;
the orchestrator wraps it and adds **UNCERTAINTY** + **EXPORT**.

## Key architectural guarantees

- **Model loaded once per job.** `GeoSRPipeline.__init__` calls `build_model_fn(...)` a
  single time; the returned `model_fn` is reused for every tile batch. The model is **not**
  reloaded per-tile and **not** reloaded per-job re-import. ⌛ *Future:* load once per
  process and share across jobs.
- **No hard torch dependency.** `geosr_backend._try_import()` imports torch lazily; if it
  is absent the orchestrator transparently falls back to the deterministic bicubic
  baseline and the UI is marked `is_demo=true`.
- **CRS & geotransform preservation.** `MetadataExtractor.compute_scaled_metadata` and
  `GeoTIFFWriter.verify_geospatial_alignment` check CRS match, scaled resolution, and
  bounds coincidence after write.
- **Memory-bounded I/O.** Rasters are read with `rasterio` decimation (`out_shape`) for
  previews; the full array is the only place the whole raster is materialized (one tile
  batch at a time during tiling).
- **Async, thread-safe jobs.** `JobManager` runs each job in a `ThreadPoolExecutor`
  (max 4 workers) and persists `JobRecord` in memory; `cancel_job` is best-effort.

## Status

- ✅ Geospatial pipeline (1–6) — tested by `tests/test_pipeline.py`, `test_tiling.py`,
  `test_reconstruction.py`, `test_geotiff_writer.py`.
- ✅ Uncertainty/Export (7–8) — exercised by the real-model e2e and `tests/test_orchestrator.py`.
- 🧪 8-stage enum + progress remapping — ⌛ *Future:* persist job state to a DB instead
  of in-memory so it survives restarts.
