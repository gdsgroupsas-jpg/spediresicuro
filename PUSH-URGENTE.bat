@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set LOGFILE=push-urgente-log.txt
echo ======================================== > %LOGFILE%
echo PUSH URGENTE - %DATE% %TIME% >> %LOGFILE%
echo ======================================== >> %LOGFILE%
echo. >> %LOGFILE%

cd /d "%~dp0"
echo Cartella: %CD% >> %LOGFILE%
echo. >> %LOGFILE%

echo [1] Verifica stato repository... >> %LOGFILE%
git status >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [2] Verifica file modificati... >> %LOGFILE%
git status --porcelain >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [3] Aggiunta TUTTI i file... >> %LOGFILE%
git add -A >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ERRORE: git add fallito >> %LOGFILE%
    type %LOGFILE%
    pause
    exit /b 1
)
echo OK: File aggiunti >> %LOGFILE%
echo. >> %LOGFILE%

echo [4] Stato dopo add... >> %LOGFILE%
git status --short >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [5] Commit... >> %LOGFILE%
git commit -m "Deploy completo: Sezione promozionale Anne + tutti gli aggiornamenti" >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o nessun cambiamento >> %LOGFILE%
) else (
    echo OK: Commit completato >> %LOGFILE%
)
echo. >> %LOGFILE%

echo [6] Verifica ultimo commit... >> %LOGFILE%
git log --oneline -1 >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [7] Push su origin/master... >> %LOGFILE%
git push origin master >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ERRORE: Push fallito >> %LOGFILE%
    echo. >> %LOGFILE%
    echo Tentativo con force-with-lease... >> %LOGFILE%
    git push origin master --force-with-lease >> %LOGFILE% 2>&1
    if errorlevel 1 (
        echo ERRORE: Anche force push fallito >> %LOGFILE%
        type %LOGFILE%
        pause
        exit /b 1
    ) else (
        echo OK: Push completato con force-with-lease >> %LOGFILE%
    )
) else (
    echo OK: Push completato con successo >> %LOGFILE%
)
echo. >> %LOGFILE%

echo [8] Verifica stato finale... >> %LOGFILE%
git status >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [9] Ultimi 3 commit... >> %LOGFILE%
git log --oneline -3 >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo ======================================== >> %LOGFILE%
echo FINE >> %LOGFILE%
echo ======================================== >> %LOGFILE%

type %LOGFILE%
echo.
echo Log salvato in: %LOGFILE%
pause
