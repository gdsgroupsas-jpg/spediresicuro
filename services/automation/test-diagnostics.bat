@echo off
REM Script batch per eseguire il test diagnostics
REM Questo evita il problema del Blocco Note che si apre

powershell.exe -ExecutionPolicy Bypass -File "%~dp0test-diagnostics.ps1"
pause
