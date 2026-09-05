import logging
import sys
from app.core.config import settings


class SafeStreamHandler(logging.StreamHandler):
    def emit(self, record):
        try:
            super().emit(record)
        except Exception:
            pass

    def handleError(self, record):
        pass


def setup_logging() -> logging.Logger:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handler = SafeStreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger("geosr")
    logger.setLevel(log_level)
    
    if not logger.handlers:
        logger.addHandler(handler)
        
    logger.propagate = False
    return logger


logger = setup_logging()
