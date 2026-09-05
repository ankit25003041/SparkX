import json
import os
from pathlib import Path
from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "GeoSR Super-Resolution API"
    VERSION: str = "0.2.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]

    # Storage paths
    STORAGE_DIR: str = "storage"
    MAX_UPLOAD_SIZE_MB: int = 500
    DEFAULT_TILE_SIZE: int = 256
    LOG_LEVEL: str = "INFO"

    # Phase 7: optional path to a trained GeoSR torch checkpoint. When set (and
    # torch is importable) the real SR model replaces the bicubic baseline and a
    # real validation report + confidence map are produced. When unset, the
    # system falls back to the deterministic baseline (demo metrics).
    GEOSR_CHECKPOINT: Optional[str] = None

    @property
    def geosr_checkpoint(self) -> Optional[Path]:
        if not self.GEOSR_CHECKPOINT:
            return None
        return Path(self.GEOSR_CHECKPOINT)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def base_dir(self) -> Path:
        # Resolves to the backend directory
        return Path(__file__).resolve().parent.parent.parent

    @property
    def storage_path(self) -> Path:
        path = self.base_dir / self.STORAGE_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def uploads_path(self) -> Path:
        path = self.storage_path / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def outputs_path(self) -> Path:
        path = self.storage_path / "outputs"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def temporary_path(self) -> Path:
        path = self.storage_path / "temporary"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def repo_root(self) -> Path:
        """Repository root (parent of the backend dir), so the `model/` package
        used by the Phase-7 GeoSR inference backend is importable."""
        return self.base_dir.parent


settings = Settings()
