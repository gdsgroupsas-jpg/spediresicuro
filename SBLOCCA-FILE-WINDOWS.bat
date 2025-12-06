@echo off
chcp 65001 >nul
title Sblocca File Windows
color 0E

echo.
echo ========================================
echo   SBLOCCA FILE WINDOWS
echo ========================================
echo.
echo Questo script rimuove il blocco "scaricato da Internet"
echo da tutti i file .bat e .ps1 nella directory
echo.

cd /d "d:\spediresicuro-master"

echo Sbloccando file batch...
for %%f in (*.bat) do (
    echo   Sbloccando: %%f
    powershell -Command "Unblock-File -Path '%%f'" >nul 2>&1
)

echo.
echo Sbloccando file PowerShell...
for %%f in (*.ps1) do (
    echo   Sbloccando: %%f
    powershell -Command "Unblock-File -Path '%%f'" >nul 2>&1
)

echo.
echo ========================================
echo   COMPLETATO
echo ========================================
echo.
echo Ora puoi eseguire gli script senza problemi!
echo.
pause
