@echo off
echo ========================================
echo   DEPLOY SEZIONE PROMOZIONALE ANNE
echo ========================================
echo.

cd /d "%~dp0"
echo Cartella corrente: %CD%
echo.

echo [1/4] Aggiunta file...
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
if %ERRORLEVEL% EQU 0 (
    echo OK - File aggiunti
) else (
    echo ERRORE - Impossibile aggiungere file
    pause
    exit /b 1
)
echo.

echo [2/4] Commit...
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"
if %ERRORLEVEL% EQU 0 (
    echo OK - Commit completato
) else (
    echo ATTENZIONE - Nessun cambiamento da committare o commit fallito
)
echo.

echo [3/4] Verifica remote...
git remote -v
if %ERRORLEVEL% NEQ 0 (
    echo ERRORE - Nessun remote configurato!
    echo Configura un remote con: git remote add origin ^<url^>
    pause
    exit /b 1
)
echo.

echo [4/4] Push su remote...
git push
if %ERRORLEVEL% EQU 0 (
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
) else (
    echo ERRORE - Push fallito!
    echo Verifica i permessi e la connessione
)
echo.
pause

