@echo off
echo ========================================
echo INSERIMENTO TOKEN GITHUB
echo ========================================
echo.
echo Per GitHub serve un Personal Access Token (PAT)
echo.
echo ISTRUZIONI:
echo 1. Vai su: https://github.com/settings/tokens
echo 2. Clicca "Generate new token" -^> "Generate new token (classic)"
echo 3. Nome: SpedireSicuro-Push
echo 4. Scadenza: 90 giorni
echo 5. Permessi: Seleziona "repo" (tutti i permessi)
echo 6. Clicca "Generate token"
echo 7. COPIA IL TOKEN (inizia con ghp_...)
echo.
echo ========================================
echo.
pause
echo.
echo Ora inserisco il token nella configurazione Git...
echo.
echo Inserisci il tuo Personal Access Token:
set /p GITHUB_TOKEN="Token: "

if "%GITHUB_TOKEN%"=="" (
    echo ERRORE: Token non inserito
    pause
    exit /b 1
)

echo.
echo Configuro il remote con il token...
cd /d d:\spediresicuro-master
git remote set-url origin https://%GITHUB_TOKEN%@github.com/gdsgroupsas-jpg/spediresicuro.git

echo.
echo OK: Token configurato
echo.
echo Provo a fare push...
git push origin master

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESSO: Push completato!
    echo ========================================
    echo.
    echo Il commit e' stato pushato su GitHub
    echo Repository: https://github.com/gdsgroupsas-jpg/spediresicuro
) else (
    echo.
    echo ERRORE: Push fallito
    echo.
    echo Possibili cause:
    echo - Token non valido o scaduto
    echo - Token senza permessi 'repo'
    echo - Problema di connessione
    echo.
    echo Riprova con un nuovo token
)

echo.
pause


