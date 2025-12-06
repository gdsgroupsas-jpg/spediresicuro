@echo off
chcp 65001 >nul
title Fix Processi Bloccati
color 0A

echo.
echo ========================================
echo   🔧 FIX PROCESSI BLOCCATI - RAPIDO
echo ========================================
echo.

echo [1/5] Chiudendo processi PowerShell bloccati...
taskkill /F /IM powershell.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✅ Processi PowerShell chiusi
) else (
    echo    ℹ️  Nessun processo PowerShell trovato
)
timeout /t 1 >nul

echo.
echo [2/5] Chiudendo processi Git bloccati...
taskkill /F /IM git.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✅ Processi Git chiusi
) else (
    echo    ℹ️  Nessun processo Git trovato
)
timeout /t 1 >nul

echo.
echo [3/5] Pulizia repository Git...
cd /d "d:\spediresicuro-master"

if exist ".git\REBASE_HEAD" (
    echo    ⚠️  Abortendo rebase...
    git rebase --abort >nul 2>&1
    echo    ✅ Rebase abortito
)

if exist ".git\MERGE_HEAD" (
    echo    ⚠️  Abortendo merge...
    git merge --abort >nul 2>&1
    echo    ✅ Merge abortito
)

if exist ".git\index.lock" (
    del /F /Q ".git\index.lock" >nul 2>&1
    echo    ✅ Lock rimosso
)

if exist ".git\.MERGE_MSG.swp" (
    del /F /Q ".git\.MERGE_MSG.swp" >nul 2>&1
    echo    ✅ File swap rimosso
)

timeout /t 1 >nul

echo.
echo [4/5] Impostazione Execution Policy PowerShell...
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo    ✅ Execution Policy configurato

timeout /t 1 >nul

echo.
echo [5/5] Test PowerShell...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'PowerShell OK!' -ForegroundColor Green" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✅ PowerShell funziona!
) else (
    echo    ⚠️  PowerShell potrebbe avere problemi
)

echo.
echo ========================================
echo   ✅ PULIZIA COMPLETATA!
echo ========================================
echo.
echo Ora puoi eseguire:
echo   commit-push-fix-completo.ps1
echo   OPPURE
echo   FIX-GIT-PUSH-DEFINITIVO.bat
echo.
pause

