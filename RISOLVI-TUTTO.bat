@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   RISOLUZIONE COMPLETA - GIT PUSH
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] Verifica stato iniziale...
git status
echo.

echo [2] Fetch da remoto...
git fetch origin master
if errorlevel 1 (
    echo ERRORE: Fetch fallito
    pause
    exit /b 1
)
echo OK
echo.

echo [3] Verifica commit non pushati...
git log origin/master..HEAD --oneline
echo.

echo [4] Verifica commit remoti non in locale...
git log HEAD..origin/master --oneline
echo.

echo [5] Pull per sincronizzare (con merge)...
git pull origin master --no-rebase
if errorlevel 1 (
    echo ATTENZIONE: Pull con problemi o conflitti
    echo Verifico conflitti...
    git status
) else (
    echo OK: Pull completato
)
echo.

echo [6] Verifica conflitti...
git diff --check
if errorlevel 1 (
    echo ATTENZIONE: Trovati conflitti!
    echo Risolvi manualmente i conflitti e riprova
    pause
    exit /b 1
)
echo OK: Nessun conflitto
echo.

echo [7] Aggiunta TUTTI i file modificati...
git add -A
if errorlevel 1 (
    echo ERRORE: git add fallito
    pause
    exit /b 1
)
echo OK: File aggiunti
echo.

echo [8] Stato repository dopo add...
git status --short
echo.

echo [9] Commit...
git commit -m "Deploy completo: Sezione promozionale Anne + risoluzione conflitti + tutti gli aggiornamenti"
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o nessun cambiamento
    echo Verifico se ci sono file da committare...
    git status --short
) else (
    echo OK: Commit completato
)
echo.

echo [10] Verifica ultimo commit...
git log --oneline -1
echo.

echo [11] Push su origin/master...
git push origin master
if errorlevel 1 (
    echo.
    echo ERRORE: Push fallito!
    echo.
    echo Tentativo con rebase...
    git pull --rebase origin master
    if errorlevel 1 (
        echo ERRORE: Rebase fallito - ci sono conflitti
        echo Risolvi i conflitti manualmente
        pause
        exit /b 1
    )
    git push origin master
    if errorlevel 1 (
        echo ERRORE: Anche dopo rebase push fallito
        pause
        exit /b 1
    ) else (
        echo OK: Push completato dopo rebase
    )
) else (
    echo OK: Push completato con successo!
)
echo.

echo [12] Verifica stato finale...
git status
echo.

echo ========================================
echo   COMPLETATO!
echo ========================================
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo Verifica su Vercel: https://vercel.com/dashboard
echo.
pause
