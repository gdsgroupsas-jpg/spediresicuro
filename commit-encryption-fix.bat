@echo off
cd /d C:\spediresicuro-master\spediresicuro
echo ====================================
echo COMMIT CORREZIONE CRIPTAZIONE
echo ====================================
echo.
echo Aggiungo file modificati...
git add lib/security/encryption.ts docs/CONFIGURAZIONE_ENCRYPTION_KEY.md env.example.txt
echo.
echo Creo commit...
git commit -m "fix: Rendere criptazione credenziali opzionale - sistema funziona anche senza ENCRYPTION_KEY"
echo.
echo Eseguo push...
git push
echo.
echo ====================================
echo FATTO!
echo ====================================
pause






