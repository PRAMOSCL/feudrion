@echo off
setlocal
cd /d "%~dp0"
title Senorios - iniciar

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node 20 o superior desde https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo Fallo npm install.
    pause
    exit /b 1
  )
)

rem Si ya esta encendido, solo abre el navegador.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo Senorios ya esta en marcha.
  start "" http://127.0.0.1:5173
  exit /b 0
)

echo Encendiendo Senorios (backend + frontend)...
start "Senorios (servidor)" /min cmd /c npm run dev

echo Esperando a que arranque...
powershell -NoProfile -Command "$t=0; while ($t -lt 60) { if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { break }; Start-Sleep 1; $t++ }"
start "" http://127.0.0.1:5173
echo Listo: http://127.0.0.1:5173  (usa detener.bat para apagarlo)
timeout /t 3 >nul
