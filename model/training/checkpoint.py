"""Checkpoint save/load utilities for GeoSR training.

A checkpoint bundles: model state, optimizer state, scheduler state, AMP scaler,
current epoch + iteration, best validation metric, the full TrainConfig (so any
result is fully reproducible from checkpoint alone), and the RNG state.

This keeps train.py clean and gives a single place to reason about resume
semantics.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional

import torch


def _sanitize(obj: Any) -> Any:
    """Make the config JSON-serializable (Paths -> str, dataclasses -> dict)."""
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, (list, tuple)):
        return [_sanitize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    return obj


class CheckpointManager:
    """Save/load checkpoints to a per-run directory.

    Files:
      - checkpoint_latest.pt   (overwritten every save; resume point)
      - checkpoint_best.pt     (best validation metric so far)
      - checkpoint_epoch{N}.pt (optional explicit epoch snapshots)
      - config.json            (the TrainConfig used for this run)
      - rng_state.pt           (cpu + cuda + python + numpy rng)
    """

    def __init__(self, run_dir: str | Path) -> None:
        self.run_dir = Path(run_dir)
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.latest_path = self.run_dir / "checkpoint_latest.pt"
        self.best_path = self.run_dir / "checkpoint_best.pt"

    def save(
        self,
        model: torch.nn.Module,
        optimizer: torch.optim.Optimizer,
        scheduler: Optional[Any],
        scaler: Optional[torch.cuda.amp.GradScaler],
        *,
        config: Any,
        epoch: int,
        iteration: int,
        best_metric: float,
        metric_name: str,
        is_best: bool = False,
        model_name: Optional[str] = None,
        extra: Optional[dict] = None,
    ) -> Path:
        ckpt = {
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "epoch": epoch,
            "iteration": iteration,
            "best_metric": best_metric,
            "metric_name": metric_name,
            "model_name": model_name or getattr(model, "model_name", None),
            "config": _sanitize(asdict(config)),
            "rng_state": _rng_state(),
            "extra": extra or {},
        }
        if scheduler is not None:
            ckpt["scheduler_state_dict"] = scheduler.state_dict()
        if scaler is not None:
            ckpt["scaler_state_dict"] = scaler.state_dict()

        # atomic-ish write via temp + rename
        tmp = self.latest_path.with_suffix(".pt.tmp")
        torch.save(ckpt, tmp)
        tmp.replace(self.latest_path)
        if is_best:
            tmp2 = self.best_path.with_suffix(".pt.tmp")
            torch.save(ckpt, tmp2)
            tmp2.replace(self.best_path)
        return self.latest_path

    def load(
        self,
        model: torch.nn.Module,
        optimizer: Optional[torch.optim.Optimizer] = None,
        scheduler: Optional[Any] = None,
        scaler: Optional[torch.cuda.amp.GradScaler] = None,
        path: Optional[Path] = None,
        device: Optional[str] = None,
    ) -> dict:
        path = path or self.latest_path
        map_location = device if device is not None else "cpu"
        ckpt = torch.load(path, map_location=map_location, weights_only=False)

        model.load_state_dict(ckpt["model_state_dict"])
        if optimizer is not None and "optimizer_state_dict" in ckpt:
            optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        if scheduler is not None and ckpt.get("scheduler_state_dict"):
            scheduler.load_state_dict(ckpt["scheduler_state_dict"])
        if scaler is not None and ckpt.get("scaler_state_dict"):
            scaler.load_state_dict(ckpt["scaler_state_dict"])

        # restore RNGs
        _restore_rng(ckpt.get("rng_state"))
        return ckpt

    def save_config(self, config: Any) -> Path:
        p = self.run_dir / "config.json"
        p.write_text(json.dumps(_sanitize(asdict(config)), indent=2))
        return p


def _rng_state() -> dict:
    import random
    import numpy as np
    state = {"python": random.getstate()}
    state["torch"] = torch.get_rng_state()
    if torch.cuda.is_available():
        state["torch_cuda"] = torch.cuda.get_rng_state_all()
    try:
        state["numpy"] = np.random.get_state()
    except Exception:
        pass
    return state


def _restore_rng(state: Optional[dict]) -> None:
    if not state:
        return
    import random
    if "python" in state:
        random.setstate(state["python"])
    if "torch" in state:
        torch.set_rng_state(state["torch"])
    if state.get("torch_cuda") is not None and torch.cuda.is_available():
        torch.cuda.set_rng_state_all(state["torch_cuda"])


if __name__ == "__main__":
    from model.training.config import TrainConfig
    cm = CheckpointManager("model/checkpoints/_smoke")
    m = torch.nn.Conv2d(4, 4, 3, padding=1)
    cm.save_config(TrainConfig())
    print("CheckpointManager writable:", cm.latest_path.parent.exists())
