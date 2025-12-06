@echo off
REM ============================================
REM SCRIPT AUTOMATICO - UN SOLO CLICK!
REM ============================================
REM Questo file bat chiama lo script PowerShell
REM per fare pull e push automaticamente
REM ============================================

echo.
echo ========================================
echo   SINCRONIZZAZIONE AUTOMATICA GIT
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

powershell -ExecutionPolicy Bypass -File "sync-automatico-completo.ps1"

echo.
echo ========================================
echo   OPERAZIONE COMPLETATA!
echo ========================================
echo.
pause

