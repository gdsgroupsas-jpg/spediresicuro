@echo off
REM ============================================
REM SCRIPT AUTOMATICO - SOLO PUSH
REM ============================================
REM Carica solo le modifiche su GitHub
REM ============================================

echo.
echo ========================================
echo   CARICAMENTO AUTOMATICO SU GITHUB
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo Verifica file modificati...
git status --short

echo.
echo Aggiunta file modificati...
git add -A

echo.
echo Creazione commit...
git commit -m "chore: aggiornamento automatico - %date% %time%"

if %ERRORLEVEL% NEQ 0 (
    echo Nessuna modifica da committare.
)

echo.
echo Caricamento su GitHub...
git push origin master

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   PUSH COMPLETATO CON SUCCESSO!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ATTENZIONE: Problema durante push
    echo ========================================
)

echo.
pause

