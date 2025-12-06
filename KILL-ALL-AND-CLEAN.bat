@echo off
chcp 65001 >nul
title KILL ALL AND CLEAN
color 0C

echo.
echo ========================================
echo   🔥 KILL ALL AND CLEAN
echo ========================================
echo.
echo Questo script chiudera' TUTTI i processi e pulira' TUTTO
echo.
pause

echo.
echo [1] Chiudendo TUTTI i processi PowerShell...
taskkill /F /IM powershell.exe >nul 2>&1
taskkill /F /IM pwsh.exe >nul 2>&1
timeout /t 2 >nul
echo    ✅ Fatto

echo.
echo [2] Chiudendo TUTTI i processi Git...
taskkill /F /IM git.exe >nul 2>&1
taskkill /F /IM git-credential-manager.exe >nul 2>&1
taskkill /F /IM git-credential-manager-core.exe >nul 2>&1
timeout /t 2 >nul
echo    ✅ Fatto

echo.
echo [3] Chiudendo processi Cursor/VS Code che potrebbero bloccare...
taskkill /F /IM Code.exe >nul 2>&1
taskkill /F /IM Cursor.exe >nul 2>&1
timeout /t 2 >nul
echo    ✅ Fatto

echo.
echo [4] Vado nella directory...
cd /d "d:\spediresicuro-master"

echo.
echo [5] Rimuovendo REBASE_HEAD con attributi...
if exist ".git\REBASE_HEAD" (
    attrib -R -S -H ".git\REBASE_HEAD" >nul 2>&1
    timeout /t 1 >nul
    del /F /Q ".git\REBASE_HEAD" >nul 2>&1
    timeout /t 1 >nul
    
    if exist ".git\REBASE_HEAD" (
        echo    ❌ REBASE_HEAD ancora presente dopo tentativo
        echo    Prova a chiudere Cursor/VS Code e riprova
    ) else (
        echo    ✅ REBASE_HEAD RIMOSSO!
    )
) else (
    echo    ✅ Nessun REBASE_HEAD trovato
)

echo.
echo [6] Rimuovendo altri lock...
del /F /Q ".git\.MERGE_MSG.swp" >nul 2>&1
del /F /Q ".git\index.lock" >nul 2>&1
del /F /Q ".git\MERGE_HEAD" >nul 2>&1
echo    ✅ Altri lock rimossi

echo.
echo [7] Impostazione Execution Policy...
powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo    ✅ Fatto

echo.
echo [8] Test PowerShell...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'PowerShell OK!' -ForegroundColor Green" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    ✅✅✅ POWERSHELL FUNZIONA! ✅✅✅
) else (
    echo    ❌ PowerShell ancora non funziona
)

echo.
echo ========================================
echo   ✅ PULIZIA COMPLETATA
echo ========================================
echo.
echo Se PowerShell funziona, ora puoi eseguire:
echo   commit-push-fix-completo.ps1
echo.
pause

