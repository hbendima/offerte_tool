@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Offerte Tool starten (1 venster)
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

echo [start] Backend + frontend worden samen gestart in dit venster.
echo         Frontend opent normaal op http://localhost:5173
echo         Sluit dit venster of druk Ctrl+C om beide te stoppen.
echo.

call npm start

pause