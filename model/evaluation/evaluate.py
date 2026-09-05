"""Full-dataset evaluation runner for GeoSR models (Phase 6).

Runs a model over a (validation/test) DataLoader, aggregates the metrics from
``model.evaluation.metrics`` across all samples, and optionally persists a JSON
report. Evaluation is done in eval mode with no gradient / no AMP autocast unless
``use_amp`` is set (kept deterministic + reproducible).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Optional

import torch
from torch.utils.data import DataLoader

from .metrics import compute_metrics


@torch.no_grad()
def evaluate_model(
    model: torch.nn.Module,
    loader: DataLoader,
    device: str = "cpu",
    data_range: float = 1.5,
    scale_factor: float = 4.0,
    use_amp: bool = False,
) -> Dict[str, float]:
    """Evaluate ``model`` over ``loader`` and return mean metrics."""
    model.eval()
    model.to(device)

    keys = ["psnr", "ssim", "sam", "ergas", "l1"]
    sums: Dict[str, float] = {k: 0.0 for k in keys}
    n = 0
    for batch in loader:
        lr = batch["lr"].to(device)
        hr = batch["hr"].to(device)
        if use_amp and device.startswith("cuda"):
            with torch.autocast("cuda"):
                pred = model(lr)
        else:
            pred = model(lr)
        m = compute_metrics(pred, hr, data_range=data_range, scale_factor=scale_factor)
        nb = lr.shape[0]
        for k in keys:
            sums[k] += m[k] * nb
        n += nb

    if n == 0:
        raise RuntimeError("evaluate_model received an empty loader.")
    return {k: sums[k] / n for k in keys}


def save_report(metrics: Dict[str, float], path: str | Path, *, extra: Optional[dict] = None) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"metrics": metrics}
    if extra:
        payload["extra"] = extra
    path.write_text(json.dumps(payload, indent=2))
    return path


def evaluate_and_save(
    model: torch.nn.Module,
    loader: DataLoader,
    device: str,
    report_path: str | Path,
    *,
    data_range: float = 1.5,
    scale_factor: float = 4.0,
    use_amp: bool = False,
    extra: Optional[dict] = None,
) -> Dict[str, float]:
    metrics = evaluate_model(model, loader, device, data_range, scale_factor, use_amp)
    save_report(metrics, report_path, extra={"n_samples": len(loader.dataset), **(extra or {})})
    return metrics
