@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set LOGFILE=deploy-output.txt
echo ======================================== > %LOGFILE%
echo DEPLOY SEZIONE ANNE >> %LOGFILE%
echo Data: %DATE% %TIME% >> %LOGFILE%
echo ======================================== >> %LOGFILE%
echo. >> %LOGFILE%

cd /d "%~dp0"
echo Cartella: %CD% >> %LOGFILE%
echo. >> %LOGFILE%

echo [1] Verifica Git... >> %LOGFILE%
git --version >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ERRORE: Git non trovato! >> %LOGFILE%
    type %LOGFILE%
    pause
    exit /b 1
)
echo OK >> %LOGFILE%
echo. >> %LOGFILE%

echo [2] Verifica file... >> %LOGFILE%
if exist "components\homepage\anne-promo-section.tsx" (
    echo File 1: OK >> %LOGFILE%
) else (
    echo File 1: ERRORE - NON TROVATO >> %LOGFILE%
)
if exist "app\page.tsx" (
    echo File 2: OK >> %LOGFILE%
) else (
    echo File 2: ERRORE - NON TROVATO >> %LOGFILE%
)
echo. >> %LOGFILE%

echo [3] Stato repository PRIMA... >> %LOGFILE%
git status --short >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [4] Aggiunta file... >> %LOGFILE%
git add components/homepage/anne-promo-section.tsx >> %LOGFILE% 2>&1
git add app/page.tsx >> %LOGFILE% 2>&1
git add -A >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [5] Stato repository DOPO ADD... >> %LOGFILE%
git status --short >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [6] Commit... >> %LOGFILE%
git commit -m "Aggiunta sezione promozionale Anne sulla homepage" >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o già fatto >> %LOGFILE%
) else (
    echo Commit OK >> %LOGFILE%
)
echo. >> %LOGFILE%

echo [7] Ultimo commit... >> %LOGFILE%
git log --oneline -1 >> %LOGFILE% 2>&1
echo. >> %LOGFILE%

echo [8] Push... >> %LOGFILE%
git push origin master >> %LOGFILE% 2>&1
if errorlevel 1 (
    echo ERRORE: Push fallito >> %LOGFILE%
) else (
    echo PUSH OK >> %LOGFILE%
)
echo. >> %LOGFILE%

echo ======================================== >> %LOGFILE%
echo FINE >> %LOGFILE%
echo ======================================== >> %LOGFILE%

type %LOGFILE%
echo.
echo Il log completo e' stato salvato in: %LOGFILE%
pause

