@echo off
REM Start backend
start cmd /k "cd backend && npm install && npm run start"
REM Start frontend
start cmd /k "cd frontend-vite && npm install && npm run dev"

echo Offerte tool wordt gestart...
pause