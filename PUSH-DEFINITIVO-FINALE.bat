@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set LOGFILE=push-definitivo-log.txt
echo ======================================== > %LOGFILE%
echo PUSH DEFINITIVO - %DATE% %TIME% >> %LOGFILE%
echo ======================================== >> %LOGFILE%
echo. >> %LOGFILE%

cd /d "%~dp0"
echo Cartella: %CD% >> %LOGFILE%
echo. >> %LOGFILE%

echo [1] Verifica file Anne... >> %LOGFILE%
if exist "components\homepage\anne-promo-section.tsx" (
    echo   OK: anne-promo-section.tsx esiste >> %LOGFILE%
) else (
    echo   ERRORE: anne-promo-section.tsx NON TROVATO >> %LOGFILE%
    type %LOGFILE%
    pause
    exit /b 1
)
echo.

echo [2] Fetch da remoto... >> %LOGFILE%
git fetch origin master >> %LOGFILE% 2>&1
echo.

echo [3] Reset a remoto per allineare... >> %LOGFILE%
git reset --hard origin/master >> %LOGFILE% 2>&1
echo.

echo [4] Aggiunta file Anne... >> %LOGFILE%
git add components/homepage/anne-promo-section.tsx >> %LOGFILE% 2>&1
git add app/page.tsx >> %LOGFILE% 2>&1
echo.

echo [5] Aggiunta TUTTI gli altri file modificati... >> %LOGFILE%
git add -A >> %LOGFILE% 2>&1
echo.

echo [6] Stato dopo add... >> %LOGFILE%
git status --short >> %LOGFILE% 2>&1
echo.

echo [7] Commit... >> %LOGFILE%
git commit -m "Deploy: Sezione promozionale Anne sulla homepage" >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o nessun cambiamento >> %LOGFILE%
) else (
    echo OK: Commit completato >> %LOGFILE%
)
echo.

echo [8] Verifica ultimo commit... >> %LOGFILE%
git log --oneline -1 >> %LOGFILE% 2>&1
echo.

echo [9] Push su origin/master... >> %LOGFILE%
git push origin master >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ERRORE: Push fallito >> %LOGFILE%
    echo. >> %LOGFILE%
    echo Tentativo con rebase... >> %LOGFILE%
    git pull --rebase origin master >> %LOGFILE% 2>&1
    git push origin master >> %LOGFILE% 2>&1
    if errorlevel 1 (
        echo ERRORE: Anche dopo rebase fallito >> %LOGFILE%
        type %LOGFILE%
        pause
        exit /b 1
    ) else (
        echo OK: Push completato dopo rebase >> %LOGFILE%
    )
) else (
    echo OK: Push completato con successo! >> %LOGFILE%
)
echo.

echo [10] Verifica stato finale... >> %LOGFILE%
git status >> %LOGFILE% 2>&1
echo.

echo ======================================== >> %LOGFILE%
echo FINE >> %LOGFILE%
echo ======================================== >> %LOGFILE%

type %LOGFILE%
echo.
echo Log salvato in: %LOGFILE%
pause
