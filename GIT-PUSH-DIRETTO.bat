@echo off
chcp 65001 >nul

echo.
echo ========================================
echo   GIT PUSH DIRETTO - NESSUN POWERSHELL
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella: %CD%
echo.

echo [1] Fetch da remoto...
git fetch origin master
if errorlevel 1 (
    echo ERRORE: Fetch fallito
    pause
    exit /b 1
)
echo OK
echo.

echo [2] Pull per sincronizzare...
git pull origin master --no-rebase
if errorlevel 1 (
    echo ATTENZIONE: Pull con conflitti o problemi
) else (
    echo OK: Pull completato
)
echo.

echo [3] Aggiunta TUTTI i file...
git add -A
if errorlevel 1 (
    echo ERRORE: git add fallito
    pause
    exit /b 1
)
echo OK: File aggiunti
echo.

echo [4] Stato repository...
git status --short
echo.

echo [5] Commit...
git commit -m "Deploy completo: Sezione promozionale Anne + tutti gli aggiornamenti"
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o nessun cambiamento
) else (
    echo OK: Commit completato
)
echo.

echo [6] Push su origin/master...
git push origin master
if errorlevel 1 (
    echo.
    echo ERRORE: Push fallito!
    echo.
    echo Tentativo con rebase...
    git pull --rebase origin master
    git push origin master
    if errorlevel 1 (
        echo ERRORE: Anche dopo rebase fallito
        pause
        exit /b 1
    ) else (
        echo OK: Push completato dopo rebase
    )
) else (
    echo OK: Push completato con successo!
)
echo.

echo ========================================
echo   COMPLETATO!
echo ========================================
echo.
pause
