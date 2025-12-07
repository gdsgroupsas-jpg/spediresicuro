@echo off
echo ========================================
echo SINCRONIZZAZIONE COMPLETA REPOSITORY
echo ========================================
echo.

cd /d d:\spediresicuro-master

echo [1/6] Fetch aggiornamenti da remoto...
git fetch origin --all --prune
if %errorlevel% neq 0 (
    echo ERRORE: Fetch fallito
    pause
    exit /b 1
)
echo OK: Fetch completato
echo.

echo [2/6] Verifica stato repository...
git status
echo.

echo [3/6] Verifica commit locali non pushati...
git log origin/master..HEAD --oneline > temp_local_commits.txt 2>nul
set /p LOCAL_COMMITS=<temp_local_commits.txt 2>nul
if not "%LOCAL_COMMITS%"=="" (
    echo Trovati commit locali da pushare:
    type temp_local_commits.txt
    echo.
) else (
    echo Nessun commit locale da pushare
    echo.
)
del temp_local_commits.txt 2>nul

echo [4/6] Verifica commit remoti non presenti in locale...
git log HEAD..origin/master --oneline > temp_remote_commits.txt 2>nul
set /p REMOTE_COMMITS=<temp_remote_commits.txt 2>nul
if not "%REMOTE_COMMITS%"=="" (
    echo Trovati commit remoti da scaricare:
    type temp_remote_commits.txt
    echo.
) else (
    echo Nessun commit remoto da scaricare
    echo.
)
del temp_remote_commits.txt 2>nul

echo [5/6] Pull aggiornamenti da remoto...
git log HEAD..origin/master --oneline > temp_need_pull.txt 2>nul
set /p NEED_PULL=<temp_need_pull.txt 2>nul
if not "%NEED_PULL%"=="" (
    echo Trovati commit remoti da scaricare. Eseguo pull...
    git pull origin master --no-rebase
    if %errorlevel% neq 0 (
        echo ATTENZIONE: Pull con conflitti o errori
        echo Verifica manualmente i conflitti
        echo.
        git status
        del temp_need_pull.txt 2>nul
        pause
        exit /b 1
    )
    echo OK: Pull completato
) else (
    echo Nessun commit remoto da scaricare
)
del temp_need_pull.txt 2>nul
echo.

echo [6/6] Push commit locali (se presenti)...
git log origin/master..HEAD --oneline > temp_check_push.txt 2>nul
set /p CHECK_PUSH=<temp_check_push.txt 2>nul
if not "%CHECK_PUSH%"=="" (
    echo Push commit locali...
    git push origin master
    if %errorlevel% neq 0 (
        echo ERRORE: Push fallito
        pause
        exit /b 1
    )
    echo OK: Push completato
) else (
    echo Nessun commit locale da pushare
)
del temp_check_push.txt 2>nul
echo.

echo [VERIFICA FINALE] Stato sincronizzazione...
git status
echo.
git log --oneline --graph --all --decorate -5
echo.

echo ========================================
echo SINCRONIZZAZIONE COMPLETATA
echo ========================================
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo.
pause
