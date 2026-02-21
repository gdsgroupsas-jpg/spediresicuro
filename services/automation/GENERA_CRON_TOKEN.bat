@echo off
REM Script batch per generare CRON_SECRET_TOKEN
REM Questo evita il problema del Blocco Note che si apre

powershell.exe -ExecutionPolicy Bypass -File "%~dp0GENERA_CRON_TOKEN.ps1"
pause
