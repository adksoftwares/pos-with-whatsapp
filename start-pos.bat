@echo off
title ADK Retail POS - Server Launcher
echo ===================================================
echo   ADK Retail POS - Automated System Launcher
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Backend API & Embedded PostgreSQL (Port 5000)...
start "ADK POS - Backend Server" /min cmd /c "cd backend && npm run dev"

echo [2/3] Starting Frontend Web Server (Port 5173)...
start "ADK POS - Frontend Server" /min cmd /c "cd frontend && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo.
echo ===================================================
echo   POS System is Running!
echo   Local Web App : http://localhost:5173
echo   Local Backend : http://localhost:5000
echo   Cloud Web App : https://pos-with-whatsapp.vercel.app
echo ===================================================
echo.

start http://localhost:5173
exit
