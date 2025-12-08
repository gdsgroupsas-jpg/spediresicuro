@echo off
REM Script batch per configurare il file .env
REM Questo evita il problema del Blocco Note che si apre

echo.
echo ========================================
echo CONFIGURAZIONE .env AUTOMATION-SERVICE
echo ========================================
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0CONFIGURA_ENV.ps1"

echo.
pause
