@echo off
echo ========================================
echo COMMIT E PUSH DIALOG FIX - VERSIONE SEMPLICE
echo ========================================
echo.

cd /d d:\spediresicuro-master

echo [1] Verifica stato...
git status --short
echo.

echo [2] Aggiunta file listini...
git add app/dashboard/listini/page.tsx
echo.

echo [3] Verifica se ci sono modifiche staged...
git diff --cached --name-only > temp_check.txt 2>nul
set /p CHECK_RESULT=<temp_check.txt 2>nul
del temp_check.txt 2>nul

if not "%CHECK_RESULT%"=="" (
    echo Trovate modifiche staged. Eseguo commit...
    git commit -m "Fix: Dialog creazione listino completo"
    if %errorlevel% neq 0 (
        echo ERRORE: Commit fallito
        pause
        exit /b 1
    )
    echo OK: Commit completato
) else (
    echo Nessuna modifica staged. Verifica commit locali...
    git log origin/master..HEAD --oneline
)
echo.

echo [4] Push su GitHub...
git push origin master
if %errorlevel% neq 0 (
    echo ERRORE: Push fallito
    echo.
    echo Verifica:
    echo - Autenticazione GitHub
    echo - Connessione internet
    echo - Conflitti con remoto
    pause
    exit /b 1
)
echo OK: Push completato
echo.

echo ========================================
echo OPERAZIONE COMPLETATA
echo ========================================
echo.
echo Verifica: https://github.com/gdsgroupsas-jpg/spediresicuro
echo.
pause
