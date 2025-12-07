@echo off
echo ========================================
echo SINCRONIZZAZIONE DEFINITIVA REPOSITORY
echo ========================================
echo.

cd /d d:\spediresicuro-master

echo [STEP 1] Fetch aggiornamenti da remoto...
git fetch origin --all --prune
echo OK
echo.

echo [STEP 2] Verifica stato attuale...
git status --short
echo.

echo [STEP 3] Verifica commit locali vs remoti...
git rev-parse HEAD > temp_local_hash.txt
git rev-parse origin/master > temp_remote_hash.txt
set /p LOCAL_HASH=<temp_local_hash.txt
set /p REMOTE_HASH=<temp_remote_hash.txt

if "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo Repository locale e remoto sono SINCRONIZZATI
    echo Hash: %LOCAL_HASH%
) else (
    echo Repository NON sincronizzati:
    echo Locale:  %LOCAL_HASH%
    echo Remoto:  %REMOTE_HASH%
)
del temp_local_hash.txt temp_remote_hash.txt
echo.

echo [STEP 4] Verifica modifiche non committate...
git diff --name-only > temp_uncommitted.txt 2>nul
set /p UNCOMMITTED=<temp_uncommitted.txt 2>nul
if not "%UNCOMMITTED%"=="" (
    echo Trovate modifiche non committate:
    type temp_uncommitted.txt
    echo.
    echo Aggiungo tutte le modifiche...
    git add -A
    echo.
    echo Commit modifiche...
    git commit -m "Fix: Sincronizzazione modifiche locali"
    if %errorlevel% neq 0 (
        echo ERRORE: Commit fallito
        del temp_uncommitted.txt 2>nul
        pause
        exit /b 1
    )
    echo OK: Commit completato
) else (
    echo Nessuna modifica non committata
)
del temp_uncommitted.txt 2>nul
echo.

echo [STEP 5] Pull aggiornamenti da remoto...
git log HEAD..origin/master --oneline > temp_need_pull.txt 2>nul
set /p NEED_PULL=<temp_need_pull.txt 2>nul
if not "%NEED_PULL%"=="" (
    echo Trovati commit remoti da scaricare:
    type temp_need_pull.txt
    echo.
    echo Eseguo pull...
    git pull origin master --no-rebase
    if %errorlevel% neq 0 (
        echo ERRORE: Pull fallito - possibili conflitti
        del temp_need_pull.txt 2>nul
        git status
        pause
        exit /b 1
    )
    echo OK: Pull completato
) else (
    echo Nessun commit remoto da scaricare
)
del temp_need_pull.txt 2>nul
echo.

echo [STEP 6] Push commit locali...
git log origin/master..HEAD --oneline > temp_need_push.txt 2>nul
set /p NEED_PUSH=<temp_need_push.txt 2>nul
if not "%NEED_PUSH%"=="" (
    echo Trovati commit locali da pushare:
    type temp_need_push.txt
    echo.
    echo Eseguo push...
    git push origin master
    if %errorlevel% neq 0 (
        echo ERRORE: Push fallito
        del temp_need_push.txt 2>nul
        pause
        exit /b 1
    )
    echo OK: Push completato
) else (
    echo Nessun commit locale da pushare
)
del temp_need_push.txt 2>nul
echo.

echo [VERIFICA FINALE] Stato sincronizzazione...
git rev-parse HEAD > temp_final_local.txt
git rev-parse origin/master > temp_final_remote.txt
set /p FINAL_LOCAL=<temp_final_local.txt
set /p FINAL_REMOTE=<temp_final_remote.txt

if "%FINAL_LOCAL%"=="%FINAL_REMOTE%" (
    echo.
    echo ========================================
    echo SINCRONIZZAZIONE COMPLETATA CON SUCCESSO
    echo ========================================
    echo.
    echo Repository locale e remoto sono SINCRONIZZATI
    echo Hash comune: %FINAL_LOCAL%
) else (
    echo.
    echo ========================================
    echo ATTENZIONE: Repository ancora non sincronizzati
    echo ========================================
    echo.
    echo Locale:  %FINAL_LOCAL%
    echo Remoto:  %FINAL_REMOTE%
    echo.
    echo Verifica manualmente i conflitti
)
del temp_final_local.txt temp_final_remote.txt 2>nul
echo.

git status
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo.
pause
