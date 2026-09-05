from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import logger
from app.api.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure storage folders exist
    logger.info("Initializing GeoSR Backend...")
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    settings.uploads_path.mkdir(parents=True, exist_ok=True)
    settings.outputs_path.mkdir(parents=True, exist_ok=True)
    settings.temporary_path.mkdir(parents=True, exist_ok=True)
    logger.info(f"Storage directory initialized at: {settings.storage_path.resolve()}")
    yield
    logger.info("Shutting down GeoSR Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FastAPI Backend for GeoSR: Deep Learning Super-Resolution for Sentinel-2 Multispectral Imagery",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
)

# Configure CORS
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error handling {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred while processing the request."
        }
    )


# Mount API routes
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "api": f"{settings.API_PREFIX}/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
