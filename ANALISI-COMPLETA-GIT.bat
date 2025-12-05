@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   ANALISI COMPLETA GIT - DIAGNOSTICA
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] STATO REPOSITORY
echo ----------------------------------------
git status
echo.

echo [2] FILE IN CONFLITTO
echo ----------------------------------------
git ls-files --unmerged
echo.

echo [3] COMMIT LOCALI NON PUSHATI
echo ----------------------------------------
git log origin/master..HEAD --oneline
echo.

echo [4] COMMIT REMOTI NON IN LOCALE
echo ----------------------------------------
git log HEAD..origin/master --oneline
echo.

echo [5] DIFFERENZE CON REMOTO
echo ----------------------------------------
git diff HEAD origin/master --stat
echo.

echo [6] REMOTE CONFIGURATO
echo ----------------------------------------
git remote -v
echo.

echo [7] BRANCH CORRENTE
echo ----------------------------------------
git branch -vv
echo.

echo [8] ULTIMI 5 COMMIT LOCALI
echo ----------------------------------------
git log --oneline -5
echo.

echo [9] VERIFICA CONFLITTI NEI FILE
echo ----------------------------------------
git diff --check
if errorlevel 1 (
    echo TROVATI CONFLITTI!
) else (
    echo Nessun conflitto nei file
)
echo.

echo [10] FILE MODIFICATI NON STAGED
echo ----------------------------------------
git status --porcelain | findstr "^ M"
echo.

echo [11] FILE NON TRACCIATI
echo ----------------------------------------
git status --porcelain | findstr "^??"
echo.

echo ========================================
echo   FINE ANALISI
echo ========================================
echo.
pause
