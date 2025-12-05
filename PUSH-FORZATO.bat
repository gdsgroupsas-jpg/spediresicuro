@echo off
chcp 65001 >nul

echo.
echo ========================================
echo   PUSH FORZATO - RISOLUZIONE DEFINITIVA
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] Verifica file Anne...
if exist "components\homepage\anne-promo-section.tsx" (
    echo   OK: anne-promo-section.tsx esiste
) else (
    echo   ERRORE: anne-promo-section.tsx NON TROVATO
    pause
    exit /b 1
)
echo.

echo [2] Fetch da remoto...
git fetch origin master
echo.

echo [3] Aggiunta file Anne...
git add components/homepage/anne-promo-section.tsx app/page.tsx
echo.

echo [4] Aggiunta TUTTI gli altri file...
git add -A
echo.

echo [5] Commit...
git commit -m "Deploy: Sezione promozionale Anne sulla homepage"
echo.

echo [6] Push FORZATO (con force-with-lease)...
git push origin master --force-with-lease
if errorlevel 1 (
    echo.
    echo ERRORE: Push fallito anche con force-with-lease
    echo.
    echo Tentativo con rebase...
    git pull --rebase origin master
    git push origin master
    if errorlevel 1 (
        echo ERRORE: Anche dopo rebase fallito
        pause
        exit /b 1
    )
)
echo.

echo ========================================
echo   PUSH COMPLETATO!
echo ========================================
echo.
pause
