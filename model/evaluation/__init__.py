"""GeoSR model evaluation package (Phase 6/7)."""

from .metrics import compute_metrics, psnr, ssim, sam, sam_radians, ergas, l1_metric
from .evaluate import evaluate_model, evaluate_and_save, save_report
from .uncertainty import (
    self_consistency,
    input_noise_ensemble,
    degrade_back_to_lr,
    confidence_to_uint8,
)
from .validation import build_validation_report, save_report as save_validation_report

__all__ = [
    "compute_metrics",
    "psnr",
    "ssim",
    "sam",
    "sam_radians",
    "ergas",
    "l1_metric",
    "evaluate_model",
    "evaluate_and_save",
    "save_report",
    "self_consistency",
    "input_noise_ensemble",
    "degrade_back_to_lr",
    "confidence_to_uint8",
    "build_validation_report",
    "save_validation_report",
]
