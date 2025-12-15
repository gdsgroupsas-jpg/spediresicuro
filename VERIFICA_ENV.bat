@echo off
REM ============================================
REM Script Batch - Verifica Configurazione .env
REM ============================================

echo.
echo ========================================
echo VERIFICA CONFIGURAZIONE .env.local
echo ========================================
echo.

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -Command "npm run verify:config"

pause




