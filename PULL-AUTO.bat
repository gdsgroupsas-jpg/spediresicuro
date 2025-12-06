@echo off
REM ============================================
REM SCRIPT AUTOMATICO - SOLO PULL
REM ============================================
REM Scarica solo le modifiche da GitHub
REM senza fare push
REM ============================================

echo.
echo ========================================
echo   SCARICAMENTO AUTOMATICO DA GITHUB
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo Aggiornamento informazioni remote...
git fetch origin

echo.
echo Verifica modifiche disponibili...
git log HEAD..origin/master --oneline

echo.
echo Scaricamento modifiche...
git pull origin master

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   PULL COMPLETATO CON SUCCESSO!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ATTENZIONE: Problema durante pull
    echo ========================================
)

echo.
pause

