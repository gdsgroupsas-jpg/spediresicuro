@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   FIX DEFINITIVO COMPLETO
echo   Analisi e Risoluzione Tutti i Problemi
echo ========================================
echo.

cd /d "%~dp0"

echo [1] Verifica stato repository...
git status
echo.

echo [2] Fetch da remoto...
git fetch origin master
echo.

echo [3] Verifica commit locali vs remoti...
echo Commit locali non remoti:
git log origin/master..HEAD --oneline
echo.
echo Commit remoti non locali:
git log HEAD..origin/master --oneline
echo.

echo [4] Allineamento con remoto...
git pull origin master --no-rebase
if errorlevel 1 (
    echo ATTENZIONE: Conflitti rilevati durante pull
    echo Risolvi manualmente i conflitti prima di continuare
    pause
    exit /b 1
)
echo.

echo [5] Verifica file agent.ts...
if exist "automation-service\src\agent.ts" (
    findstr /C:"Array.from(cellsNodeList)" "automation-service\src\agent.ts" >nul
    if errorlevel 1 (
        echo ERRORE: agent.ts non ha la correzione Array.from!
        pause
        exit /b 1
    ) else (
        echo OK: agent.ts ha la correzione Array.from
    )
) else (
    echo ERRORE: agent.ts non trovato!
    pause
    exit /b 1
)
echo.

echo [6] Verifica Dockerfile...
if exist "automation-service\Dockerfile" (
    findstr /C:"COPY automation-service/src" "automation-service\Dockerfile" >nul
    if errorlevel 1 (
        echo ATTENZIONE: Dockerfile potrebbe non avere percorsi corretti
    ) else (
        echo OK: Dockerfile ha percorsi corretti
    )
) else (
    echo ERRORE: Dockerfile non trovato!
    pause
    exit /b 1
)
echo.

echo [7] Build test locale...
cd automation-service
call npm run build
if errorlevel 1 (
    echo ERRORE: Build locale fallito!
    cd ..
    pause
    exit /b 1
) else (
    echo OK: Build locale completato con successo
)
cd ..
echo.

echo [8] Aggiunta tutti i file modificati...
git add -A
echo.

echo [9] Verifica cosa verrà committato...
git status --short
echo.

echo [10] Commit finale...
git commit -m "fix: Fix definitivo completo - Sincronizzazione e correzioni finali"
if errorlevel 1 (
    echo ATTENZIONE: Commit fallito o nessun cambiamento
) else (
    echo OK: Commit creato
)
echo.

echo [11] Push su GitHub...
git push origin master
if errorlevel 1 (
    echo ERRORE: Push fallito
    pause
    exit /b 1
) else (
    echo OK: Push completato con successo!
)
echo.

echo ========================================
echo   FIX COMPLETATO!
echo ========================================
echo.
echo PROSSIMI PASSI:
echo 1. Vai su Railway Dashboard
echo 2. Rimuovi deploy vecchi
echo 3. Forza nuovo deploy
echo 4. Verifica che il build completi senza errori
echo.
pause
