@echo off
REM GeoSR application launcher.
REM Starts the FastAPI backend (GeoSRv2 real-SR when the checkpoint is present) and the
REM Next.js frontend in separate console windows. The checkpoint env var is passed EXPLICITLY
REM to the uvicorn child (`set GEOSR_CHECKPOINT=... && python ...`) rather than relying on
REM setlocal inheritance into a detached `start`-ed console, so real-SR (10 m -> 5 m) mode
REM is guaranteed whenever the checkpoint file is present. Server output is tee'd to
REM logs\ for diagnosis if a window appears to fail.
setlocal

set "REPO=%~dp0"
set "BACKEND_DIR=%REPO%backend"
set "FRONTEND_DIR=%REPO%frontend"
set "CKPT=%REPO%model\checkpoints\geosr_v2\GeoSR_v2_epoch34_best.pt"

if not exist "%BACKEND_DIR%\logs" mkdir "%BACKEND_DIR%\logs" 2>nul
if not exist "%FRONTEND_DIR%\logs" mkdir "%FRONTEND_DIR%\logs" 2>nul

if exist "%CKPT%" (
  echo [GeoSR] Checkpoint found: %CKPT%
  echo [GeoSR] Backend starting in REAL-SR mode (GeoSRv2, 10m->5m) on :8000 ...
  start "GeoSR-Backend" /d "%BACKEND_DIR%" cmd /c "set GEOSR_CHECKPOINT=%CKPT% && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> logs\app.log 2>&1"
) else (
  echo [GeoSR] No checkpoint found at %CKPT% - backend starting in baseline (demo) mode on :8000.
  start "GeoSR-Backend" /d "%BACKEND_DIR%" cmd /c "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> logs\app.log 2>&1"
)

start "GeoSR-Frontend" /d "%FRONTEND_DIR%" cmd /c "npm run dev -- -p 3000 >> logs\dev.log 2>&1"

echo.
echo [GeoSR] Servers are starting in separate console windows.
echo   Backend  : http://127.0.0.1:8000   (Swagger UI: http://127.0.0.1:8000/docs)
echo   Frontend : http://localhost:3000
echo   Logs     : backend\logs\app.log , frontend\logs\dev.log
echo.
echo   If ports 3000/8000 are already in use, run stop_app.bat first.
endlocal
