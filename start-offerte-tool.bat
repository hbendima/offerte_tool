@echo off
setlocal

if /I not "%~1"=="__host__" (
  start "Offerte Tool Runner" /min cmd /c ""%~f0" __host__"
  exit /b 0
)

cd /d "%~dp0"

echo ============================================
echo   Offerte Tool starten (backend + frontend)
echo ============================================

REM Eerste keer: dependencies installeren (root + backend + frontend)
if not exist "node_modules\concurrently" (
  echo [setup] Dependencies installeren, dit kan enkele minuten duren...
  call npm install
  if errorlevel 1 (
    echo [fout] npm install is mislukt. Controleer of Node.js is geinstalleerd.
    pause
    exit /b 1
  )
)

echo [start] Backend en frontend starten op de achtergrond (verborgen vensters).
echo         Logs worden bewaard in logs\backend-dev.log en logs\frontend-dev.log
echo         Frontend opent normaal op http://localhost:5173
echo         Sluit dit venster om backend en frontend te stoppen.
echo.

if not exist "logs" mkdir "logs"

start "backend" /b cmd /c "cd /d "%~dp0backend" && set PORT=3000 && npm start >> "..\logs\backend-dev.log" 2>&1"
start "frontend" /b cmd /c "cd /d "%~dp0frontend-vite" && npm run dev >> "..\logs\frontend-dev.log" 2>&1"
start "browser" /b cmd /c "ping 127.0.0.1 -n 8 >nul && start "" http://localhost:5173"

echo [ok] Startcommando's verzonden.
echo      Gebruik de Dev Logs in de app voor live opvolging.

title Offerte Tool Runner
timeout /t -1 >nul