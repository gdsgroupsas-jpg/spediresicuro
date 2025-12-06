@echo off
chcp 65001 >nul
title Fix Semplice
color 0A

echo.
echo ========================================
echo   FIX SEMPLICE - NO EMOJI
echo ========================================
echo.

echo [1] Chiudendo processi PowerShell...
taskkill /F /IM powershell.exe >nul 2>&1
taskkill /F /IM pwsh.exe >nul 2>&1
timeout /t 1 >nul
echo    FATTO

echo.
echo [2] Chiudendo processi Git...
taskkill /F /IM git.exe >nul 2>&1
timeout /t 1 >nul
echo    FATTO

echo.
echo [3] Pulizia repository...
cd /d "d:\spediresicuro-master"

if exist ".git\REBASE_HEAD" (
    echo    Rimuovendo REBASE_HEAD...
    attrib -R ".git\REBASE_HEAD" >nul 2>&1
    del /F /Q ".git\REBASE_HEAD" >nul 2>&1
    echo    FATTO
)

del /F /Q ".git\.MERGE_MSG.swp" >nul 2>&1
del /F /Q ".git\index.lock" >nul 2>&1
del /F /Q ".git\MERGE_HEAD" >nul 2>&1
echo    Lock rimossi

echo.
echo [4] Impostazione Execution Policy...
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo    FATTO

echo.
echo [5] Test PowerShell...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'OK' -ForegroundColor Green" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    POWERSHELL FUNZIONA!
) else (
    echo    PowerShell ancora non funziona
)

echo.
echo ========================================
echo   COMPLETATO
echo ========================================
echo.
pause
