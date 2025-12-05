@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   DEPLOY FINALE COMPLETO - ANNE
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] Verifica conflitti...
git diff --check
if errorlevel 1 (
    echo   ERRORE: Trovati conflitti non risolti!
    pause
    exit /b 1
)
echo   OK: Nessun conflitto
echo.

echo [2] Sincronizzazione con remoto...
git fetch origin master
if errorlevel 1 (
    echo   ERRORE: Impossibile fare fetch
    pause
    exit /b 1
)
echo   OK: Fetch completato
echo.

echo [3] Pull per allineare...
git pull origin master --no-edit
if errorlevel 1 (
    echo   ATTENZIONE: Pull fallito o già aggiornato
) else (
    echo   OK: Pull completato
)
echo.

echo [4] Verifica file Anne...
if exist "components\homepage\anne-promo-section.tsx" (
    echo   OK: anne-promo-section.tsx
) else (
    echo   ERRORE: anne-promo-section.tsx NON TROVATO
    pause
    exit /b 1
)

if exist "app\page.tsx" (
    echo   OK: page.tsx
) else (
    echo   ERRORE: page.tsx NON TROVATO
    pause
    exit /b 1
)
echo.

echo [5] Aggiunta tutti i file modificati...
git add -A
if errorlevel 1 (
    echo   ERRORE: Impossibile aggiungere file
    pause
    exit /b 1
)
echo   OK: File aggiunti
echo.

echo [6] Stato repository...
git status --short
echo.

echo [7] Commit finale...
git commit -m "Deploy completo: Sezione promozionale Anne + risoluzione conflitti"
if errorlevel 1 (
    echo   ATTENZIONE: Nessun cambiamento da committare
) else (
    echo   OK: Commit completato
)
echo.

echo [8] Verifica ultimo commit...
git log --oneline -1
echo.

echo [9] Push su origin/master...
git push origin master
if errorlevel 1 (
    echo.
    echo   ERRORE: Push fallito!
    echo.
    echo   Tentativo con force (sicuro)...
    git push origin master --force-with-lease
    if errorlevel 1 (
        echo   ERRORE: Anche force push fallito
        pause
        exit /b 1
    ) else (
        echo   OK: Push completato con force-with-lease
    )
) else (
    echo   OK: Push completato con successo
)
echo.

echo ========================================
echo   DEPLOY COMPLETATO!
echo ========================================
echo.
echo Vercel dovrebbe avviare il deploy automaticamente...
echo Il deploy richiede circa 2-5 minuti
echo.
echo Verifica su:
echo - GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo - Vercel: https://vercel.com/dashboard
echo.
pause

