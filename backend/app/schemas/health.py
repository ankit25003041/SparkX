from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="Application health status")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC timestamp")
    environment: str = Field(default="development", description="Environment mode")
    system: Dict[str, Any] = Field(default_factory=dict, description="System diagnostics")
