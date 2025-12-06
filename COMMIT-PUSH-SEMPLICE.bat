@echo off
chcp 65001 >nul
title Commit e Push Semplice
color 0B

echo.
echo ========================================
echo   COMMIT E PUSH SEMPLICE
echo ========================================
echo.

cd /d "d:\spediresicuro-master"

echo [1] Configurazione Git...
git config user.name "gdsgroupsas-jpg"
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
git config core.pager ""
echo FATTO

echo.
echo [2] Aggiunta TUTTI i file...
git add -A
echo FATTO

echo.
echo [3] Commit...
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo"
if %ERRORLEVEL% EQU 0 (
    echo COMMIT COMPLETATO
) else (
    echo Commit fallito o non necessario
)

echo.
echo [4] Push su GitHub...
git push origin master
if %ERRORLEVEL% EQU 0 (
    echo PUSH COMPLETATO!
) else (
    echo Push fallito - controlla autenticazione
)

echo.
echo ========================================
echo   COMPLETATO
echo ========================================
echo.
pause
