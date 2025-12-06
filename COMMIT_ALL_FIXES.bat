@echo off
echo ============================================
echo COMMIT E PUSH DI TUTTE LE MODIFICHE
echo ============================================
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo [1/4] Aggiungo tutti i file modificati...
git add -A

echo.
echo [2/4] Verifico lo stato...
git status --short

echo.
echo [3/4] Creo commit con tutte le modifiche...
git commit -m "fix: Sistema chiamata API Spedisci.Online + criptazione opzionale + fix vari

- Fix: Broker Spedisci.Online registrato sempre se configurato (indipendentemente dal corriere)
- Fix: Gestione utente non trovato (cerca in multiple tabelle)
- Fix: Supporto configurazione default se utente non ha config
- Fix: Decriptazione credenziali quando recuperate dal DB
- Fix: Criptazione opzionale - sistema funziona anche senza ENCRYPTION_KEY
- Fix: Errore sintassi else duplicato in configurations.ts
- Docs: Guide complete per configurazione ENCRYPTION_KEY e fix chiamata API
- Docs: Spiegazione sicurezza API Key"

echo.
echo [4/4] Eseguo push...
git push

echo.
echo ============================================
echo COMPLETATO!
echo ============================================
echo.
echo Vai su Vercel per vedere il deploy automatico.
pause









