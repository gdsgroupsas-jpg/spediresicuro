@echo off
chcp 65001 >nul
title Verifica Commit e Push
color 0B

echo.
echo ========================================
echo   VERIFICA COMMIT E PUSH
echo ========================================
echo.

cd /d "d:\spediresicuro-master"

echo [1] Verifica modifiche locali...
git status --short
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE: git status fallito
    pause
    exit /b 1
)
echo.

echo [2] Verifica ultimo commit locale...
git log --oneline -1
echo.

echo [3] Verifica hash local vs remote...
for /f "tokens=*" %%a in ('git rev-parse HEAD') do set LOCAL_HASH=%%a
for /f "tokens=*" %%a in ('git rev-parse origin/master 2^>nul') do set REMOTE_HASH=%%a

echo Local:  %LOCAL_HASH%
echo Remote: %REMOTE_HASH%
echo.

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo [OK] Repository gia sincronizzato!
    echo.
    echo Le modifiche sono gia state pushate su GitHub.
) else (
    echo [ATTENZIONE] Repository non sincronizzato!
    echo.
    echo [4] Aggiungendo file modificati...
    git add -A
    echo.
    
    echo [5] Commit modifiche...
    git commit -m "Fix: Aggiunto controllo accountType per accesso Admin"
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Commit completato!
    ) else (
        echo [ERRORE] Commit fallito
    )
    echo.
    
    echo [6] Push su GitHub...
    git push origin master
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Push completato!
        echo.
        echo Verifica su GitHub:
        echo https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
    ) else (
        echo [ERRORE] Push fallito
        echo.
        echo Possibili cause:
        echo - Problema di autenticazione (usa Personal Access Token)
        echo - Problema di connessione
        echo - Conflitti con il repository remoto
    )
)

echo.
echo ========================================
echo   COMPLETATO
echo ========================================
echo.
pause
