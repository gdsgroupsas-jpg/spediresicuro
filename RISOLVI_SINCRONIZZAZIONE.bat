@echo off
echo ========================================
echo RISOLUZIONE SINCRONIZZAZIONE GIT
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Rimozione file problematico...
if exist "pediresicuro-masterspediresicuro" (
    del /f /q "pediresicuro-masterspediresicuro"
    echo ✅ File rimosso
) else (
    echo ✅ File non trovato (già rimosso)
)

echo.
echo [2/4] Reset Git locale...
git reset --hard HEAD

echo.
echo [3/4] Stash modifiche locali...
git stash push -m "Stash automatico prima di sync"

echo.
echo [4/4] Pull da origin/master...
git pull origin master

echo.
echo ========================================
echo ✅ SINCRONIZZAZIONE COMPLETATA!
echo ========================================
echo.
echo Verifica stato:
git status --short
echo.
pause



