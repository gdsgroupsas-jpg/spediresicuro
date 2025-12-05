@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   DEPLOY SEZIONE PROMOZIONALE ANNE
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] Verifica file...
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

echo [2] Aggiunta file a Git...
git add components/homepage/anne-promo-section.tsx
if errorlevel 1 (
    echo   ERRORE: Impossibile aggiungere anne-promo-section.tsx
    pause
    exit /b 1
)
echo   OK: anne-promo-section.tsx aggiunto

git add app/page.tsx
if errorlevel 1 (
    echo   ERRORE: Impossibile aggiungere page.tsx
    pause
    exit /b 1
)
echo   OK: page.tsx aggiunto
echo.

echo [3] Verifica file staged...
git status --short
echo.

echo [4] Commit...
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"
if errorlevel 1 (
    echo   ATTENZIONE: Commit fallito o già fatto
) else (
    echo   OK: Commit completato
)
echo.

echo [5] Verifica commit...
git log --oneline -1
echo.

echo [6] Push su origin/master...
git push origin master
if errorlevel 1 (
    echo.
    echo   ERRORE: Push fallito!
    echo.
    echo   Possibili cause:
    echo   - Problemi di autenticazione
    echo   - Nessun cambiamento da pushare
    echo   - Problemi di connessione
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo   PUSH COMPLETATO CON SUCCESSO!
    echo ========================================
    echo.
    echo Vercel dovrebbe avviare il deploy automaticamente...
    echo Il deploy richiede circa 2-5 minuti
    echo.
    echo Verifica su: https://vercel.com/dashboard
    echo.
)
echo.
pause

