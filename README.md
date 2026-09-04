# GeoSR — AI-Powered Satellite Super Resolution Mapping

<<<<<<< HEAD
**SIH 2026 Problem Statement 26142:**  
*"Deep Learning Based Super Resolution Mapping (SRM) from Medium Resolution Satellite Imageries"*

---

## 🛰️ Project Overview

**GeoSR** is an end-to-end AI and geospatial processing platform engineered to convert medium-resolution Sentinel-2 satellite imagery (~10 m GSD) into high-resolution spatial products (<4 m GSD, targeting 2.5 m) while strictly preserving:
1. **Spatial Structure & Sharpness:** Resolving sub-pixel urban infrastructure, field boundaries, and hydrological features.
2. **Spectral Fidelity & Radiometry:** Preserving multispectral reflectance ratios across bands (B02–B12) and vegetation indices (NDVI, NDWI, EVI).
3. **Geospatial Integrity:** Preserving projection coordinates (CRS/EPSG), geotransforms, and sub-pixel geographic alignment.
4. **Uncertainty Quantification:** Estimating pixel-level confidence and model variance maps to prevent hallucination misinterpretations in critical remote sensing workflows.

---

## 👥 Team SparkX & Responsibilities

- **Ankit Singh Tomar** — Backend & Geospatial Engine Architect
- **Tanishk** — Frontend & Interactive GIS Dashboard Lead
- **Anvay** — Research, Documentation & Project Presentation
- **Ashika, Ashta, Bhavana** — Deep Learning Architecture, SRM Training & Validation Pipelines

---

## 🏗️ Architecture & Project Structure

```
GeoSR/
├── frontend/             # Next.js 15+, React 19, TypeScript, Tailwind CSS, Lucide, Recharts, Leaflet
├── backend/              # FastAPI, Pydantic, Uvicorn (Phase 2)
├── model/                # PyTorch Super-Resolution Architectures (Phases 5-6)
├── data/                 # Sentinel-2 L2A datasets, raw tiles, processed samples
│   ├── raw/              # Original Sentinel-2 GeoTIFFs
│   ├── processed/        # Chunks, preprocessed arrays
│   └── cache/            # Inference cache
├── scripts/              # Data downloading, preparation, and benchmarking scripts
├── notebooks/            # Jupyter exploration and model ablation notebooks
├── tests/                # Unit and integration tests
├── docs/                 # System architecture and SIH documentation
├── docker/               # Containerized deployment files
├── README.md             # Project documentation
├── .gitignore            # Git exclusion rules
└── docker-compose.yml    # Multi-service container orchestration
```

---

## 🗺️ Incremental Development Roadmap

| Phase | Milestone | Status |
|---|---|---|
| **Phase 1** | **Frontend GIS Dashboard & UI Architecture** | 🚀 **In Progress** |
| **Phase 2** | **Backend REST API (FastAPI & Pydantic)** | ⏳ Scheduled |
| **Phase 3** | **Geospatial Processing Engine (Rasterio & GDAL)** | ⏳ Scheduled |
| **Phase 4** | **Dataset Pipeline & Paired Training Preparation** | ⏳ Scheduled |
| **Phase 5** | **Baseline Super-Resolution Pipelines** | ⏳ Scheduled |
| **Phase 6** | **Advanced Deep-Learning SRM Models** | ⏳ Scheduled |
| **Phase 7** | **Validation, Radiometric Fidelity & Uncertainty Engine** | ⏳ Scheduled |
| **Phase 8** | **Full System Integration & End-to-End Testing** | ⏳ Scheduled |
| **Phase 9** | **Production Optimization & SIH Grand Finale Demo** | ⏳ Scheduled |

---

## 🚀 Getting Started with Phase 1 (Frontend)

### Prerequisites
- Node.js >= 18.x (v24.x recommended)
- npm >= 9.x

### Run Development Server
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
=======
Ankit -- Backend  
Tanishk -- frontend 
Anvay -- ppt 

Ashika , Ashta , Bhavana -- ML model
>>>>>>> 6699d98664aecdf47d5a4327141e784cb564c76b
