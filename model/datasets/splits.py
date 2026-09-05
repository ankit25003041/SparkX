"""
Spatial train/val/test splitting for GeoSR.

Prevents spatial leakage: tiles assigned to different splits occupy
DISJOINT pixel regions of the source scene, so the model never sees the
same ground area in both training and evaluation.

Strategy
--------
1. Build a non-overlapping tile grid (top-left coords) over the HR image for a
   given ``patch_size`` / ``overlap``.
2. Shuffle the tile list with a seeded RNG and partition it by the requested
   ratios. Because each split owns a distinct subset of tile coordinates,
   there is no spatial overlap between splits.
3. Persist a manifest (JSON) describing the split assignment + scene metadata
   so the exact training set is reproducible.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

SPLIT_NAMES: Tuple[str, ...] = ("train", "validation", "test")

# Sentinel-2 10 m bands order used throughout GeoSR: [B02, B03, B04, B08]
BAND_NAMES_10M: Tuple[str, ...] = ("B02", "B03", "B04", "B08")


@dataclass
class SplitConfig:
    patch_size: int = 64
    overlap: int = 0
    scale_factor: int = 4
    ratios: Tuple[float, float, float] = (0.8, 0.1, 0.1)
    seed: int = 42

    def __post_init__(self) -> None:
        if self.patch_size <= 0:
            raise ValueError("patch_size must be positive")
        if self.overlap < 0 or self.overlap >= self.patch_size:
            raise ValueError("overlap must be in [0, patch_size)")
        if self.scale_factor < 1:
            raise ValueError("scale_factor must be >= 1")
        total = sum(self.ratios)
        if total <= 0:
            raise ValueError("ratios must be positive")
        # normalize
        self.ratios = tuple(r / total for r in self.ratios)


def compute_tile_grid(height: int, width: int, patch_size: int, overlap: int = 0) -> List[Tuple[int, int]]:
    """Top-left (y, x) coords of non-overlapping (or strided) tiles covering the image.

    Uses a stride = patch_size - overlap. The last tile in each row/col is
    flush-anchored to the image edge when it doesn't land exactly, guaranteeing
    full coverage at the cost of a possible tiny overlap at the edge (edge tiles
    are always cropped to `patch_size` and any short tile is skipped).
    """
    stride = patch_size - overlap
    ys: List[int] = []
    y = 0
    while y + patch_size <= height:
        ys.append(y)
        if y + patch_size >= height:
            break
        y += stride
    # ensure the final possible flush tile is included once
    if ys and ys[-1] + patch_size < height and (height - patch_size) not in ys:
        ys.append(height - patch_size)

    xs: List[int] = []
    x = 0
    while x + patch_size <= width:
        xs.append(x)
        if x + patch_size >= width:
            break
        x += stride
    if xs and xs[-1] + patch_size < width and (width - patch_size) not in xs:
        xs.append(width - patch_size)

    coords: List[Tuple[int, int]] = []
    for yv in ys:
        for xv in xs:
            coords.append((yv, xv))
    return coords


def assign_splits(
    tile_coords: List[Tuple[int, int]],
    ratios: Tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
) -> Dict[str, List[Tuple[int, int]]]:
    """Partition tiles into disjoint train/val/test sets using a seeded shuffle."""
    rng = np.random.default_rng(seed)
    perm = np.arange(len(tile_coords))
    rng.shuffle(perm)
    shuffled = [tile_coords[i] for i in perm]

    n = len(shuffled)
    n_train = int(round(n * ratios[0]))
    n_val = int(round(n * ratios[1]))
    train = shuffled[:n_train]
    val = shuffled[n_train:n_train + n_val]
    test = shuffled[n_train + n_val:]

    return {
        "train": train,
        "validation": val,
        "test": test,
    }


@dataclass
class SplitManifest:
    scene_id: str
    source_file: str
    crs: str
    gsd_meters: float
    bands: List[str]
    patch_size: int
    scale_factor: int
    overlap: int
    ratios: Tuple[float, float, float]
    seed: int
    counts: Dict[str, int] = field(default_factory=dict)
    tiles: Dict[str, List[List[int]]] = field(default_factory=dict)  # split -> [[y,x], ...]
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "scene_id": self.scene_id,
            "source_file": self.source_file,
            "crs": self.crs,
            "gsd_meters": self.gsd_meters,
            "bands": self.bands,
            "patch_size": self.patch_size,
            "scale_factor": self.scale_factor,
            "overlap": self.overlap,
            "ratios": list(self.ratios),
            "seed": self.seed,
            "counts": self.counts,
            "tiles": self.tiles,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "SplitManifest":
        return cls(
            scene_id=d["scene_id"],
            source_file=d["source_file"],
            crs=d["crs"],
            gsd_meters=d["gsd_meters"],
            bands=d["bands"],
            patch_size=d["patch_size"],
            scale_factor=d["scale_factor"],
            overlap=d.get("overlap", 0),
            ratios=tuple(d["ratios"]),
            seed=d["seed"],
            counts=d.get("counts", {}),
            tiles=d.get("tiles", {}),
            metadata=d.get("metadata", {}),
        )


class SplitManager:
    """Computes, stores, and loads spatial split manifests for a scene."""

    def __init__(self, config: SplitConfig):
        self.config = config

    def compute(self, height: int, width: int) -> Dict[str, List[Tuple[int, int]]]:
        grid = compute_tile_grid(height, width, self.config.patch_size, self.config.overlap)
        return assign_splits(grid, self.config.ratios, self.config.seed)

    def build_manifest(
        self,
        scene_id: str,
        source_file: str,
        crs: str,
        gsd_meters: float,
        bands: List[str],
        height: int,
        width: int,
    ) -> SplitManifest:
        splits = self.compute(height, width)
        counts = {s: len(tiles) for s, tiles in splits.items()}
        tiles = {s: [[int(y), int(x)] for (y, x) in tiles] for s, tiles in splits.items()}
        return SplitManifest(
            scene_id=scene_id,
            source_file=source_file,
            crs=crs,
            gsd_meters=gsd_meters,
            bands=bands,
            patch_size=self.config.patch_size,
            scale_factor=self.config.scale_factor,
            overlap=self.config.overlap,
            ratios=self.config.ratios,
            seed=self.config.seed,
            counts=counts,
            tiles=tiles,
            metadata={"height": height, "width": width, "total_tiles": sum(counts.values())},
        )

    def save(self, manifest: SplitManifest, out_path: Path) -> Path:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(manifest.to_dict(), f, indent=2)
        return out_path

    def load(self, path: Path) -> SplitManifest:
        with open(path) as f:
            return SplitManifest.from_dict(json.load(f))
