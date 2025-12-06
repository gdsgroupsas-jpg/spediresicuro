@echo off
chcp 65001 >nul
title Rimuovi Rebase Forzato
color 0E

echo.
echo ========================================
echo   🔥 RIMUOVI REBASE FORZATO
echo ========================================
echo.

cd /d "d:\spediresicuro-master"

echo [1] Chiudendo processi Git...
taskkill /F /IM git.exe >nul 2>&1
timeout /t 1 >nul

echo [2] Rimuovendo REBASE_HEAD...
if exist ".git\REBASE_HEAD" (
    attrib -R ".git\REBASE_HEAD" >nul 2>&1
    del /F /Q ".git\REBASE_HEAD" >nul 2>&1
    if exist ".git\REBASE_HEAD" (
        echo    ❌ Impossibile rimuovere REBASE_HEAD
        echo    Prova a chiudere manualmente tutti i processi Git
    ) else (
        echo    ✅ REBASE_HEAD rimosso!
    )
) else (
    echo    ℹ️  Nessun REBASE_HEAD trovato
)

echo.
echo [3] Rimuovendo altri lock...
del /F /Q ".git\.MERGE_MSG.swp" >nul 2>&1
del /F /Q ".git\index.lock" >nul 2>&1
del /F /Q ".git\MERGE_HEAD" >nul 2>&1
echo    ✅ Altri lock rimossi

echo.
echo [4] Verifica stato...
if exist ".git\REBASE_HEAD" (
    echo    ⚠️  REBASE_HEAD ancora presente!
    echo    Chiudi manualmente tutti i processi e riprova
) else (
    echo    ✅ Repository pulito!
)

echo.
echo ========================================
echo   ✅ COMPLETATO
echo ========================================
echo.
pause

