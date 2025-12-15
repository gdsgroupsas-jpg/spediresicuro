@echo off
REM ============================================
REM Script Batch - Recupera Variabili da Vercel
REM ============================================
REM 
REM Questo script bypassa la policy PowerShell
REM e esegue lo script automatico
REM ============================================

echo.
echo ========================================
echo RECUPERO AUTOMATICO VARIABILI DA VERCEL
echo ========================================
echo.

REM Esegue lo script PowerShell bypassando la policy
powershell.exe -ExecutionPolicy Bypass -File "%~dp0RECUPERA_VARIABILI_VERCEL_AUTO.ps1"

pause




