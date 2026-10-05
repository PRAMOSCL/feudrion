@echo off
setlocal
title Senorios - detener
echo Apagando Senorios...
powershell -NoProfile -Command "foreach ($p in 3001,5173) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
taskkill /fi "WINDOWTITLE eq Senorios (servidor)*" /f >nul 2>nul
echo Listo. Tu progreso queda guardado en server\data\senorios.db
timeout /t 3 >nul
