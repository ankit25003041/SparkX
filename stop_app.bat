@echo off
REM GeoSR application stopper.
REM Kills the processes LISTENING on ports 3000 (frontend) and 8000 (backend) by PID,
REM and closes any leftover detached GeoSR console windows by title (matching the titles
REM launched by start_app.bat). Targeted by port/title - does NOT kill unrelated
REM node/python processes.
setlocal enabledelayedexpansion

echo [GeoSR] Stopping frontend (:3000) and backend (:8000) processes ...
for %%P in (3000 8000) do (
  for /f "tokens=5" %%I in ('netstat -aon ^| findstr /R "^  *TCP.*:%%P .*LISTENING"') do (
    if not "%%I"=="" (
      echo   Killing PID %%I on port %%P
      taskkill /f /pid %%I 2>nul
    )
  )
)

REM Fallback: also close any detached GeoSR launcher windows by title.
for %%T in ("GeoSR-Backend" "GeoSR-Frontend") do (
  taskkill /f /fi "WINDOWTITLE eq %%~T" 2>nul
)

echo [GeoSR] Done.
endlocal
