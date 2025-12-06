@echo off
chcp 65001 >nul
title FORZA PULIZIA COMPLETA
color 0C

echo.
echo ========================================
echo   🔥 FORZA PULIZIA COMPLETA
echo ========================================
echo.
echo ATTENZIONE: Questo script chiudera' TUTTI i processi
echo PowerShell e Git, e rimuovera' TUTTI i lock!
echo.
pause

echo.
echo [1] Chiudendo TUTTI i processi PowerShell...
taskkill /F /IM powershell.exe >nul 2>&1
taskkill /F /IM pwsh.exe >nul 2>&1
echo    ✅ Fatto

echo.
echo [2] Chiudendo TUTTI i processi Git...
taskkill /F /IM git.exe >nul 2>&1
taskkill /F /IM git-credential-manager.exe >nul 2>&1
echo    ✅ Fatto

echo.
echo [3] Pulizia FORZATA repository...
cd /d "d:\spediresicuro-master"

del /F /Q ".git\REBASE_HEAD" >nul 2>&1
del /F /Q ".git\MERGE_HEAD" >nul 2>&1
del /F /Q ".git\index.lock" >nul 2>&1
del /F /Q ".git\.MERGE_MSG.swp" >nul 2>&1
del /F /Q ".git\*.lock" >nul 2>&1
del /F /Q ".git\*.swp" >nul 2>&1

echo    ✅ Lock rimossi

echo.
echo [4] Impostazione Execution Policy...
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo    ✅ Fatto

echo.
echo [5] Test PowerShell...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'OK' -ForegroundColor Green" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✅ PowerShell FUNZIONA!
) else (
    echo    ❌ PowerShell ancora non funziona
    echo.
    echo    Prova manualmente:
    echo    powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser"
)

echo.
echo ========================================
echo   ✅ PULIZIA FORZATA COMPLETATA
echo ========================================
echo.
echo Ora prova a eseguire:
echo   commit-push-fix-completo.ps1
echo.
pause

