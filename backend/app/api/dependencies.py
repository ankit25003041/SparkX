from app.core.config import Settings, settings
from app.services.job_manager import JobManager, get_job_manager


def get_app_settings() -> Settings:
    return settings


def get_job_mgr() -> JobManager:
    return get_job_manager()
