# Script PowerShell per commit e push
$ErrorActionPreference = "Stop"

cd C:\spediresicuro-master\spediresicuro

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "COMMIT E PUSH MODIFICHE" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager git
$env:GIT_PAGER = "cat"

Write-Host "[1/4] Aggiungo tutti i file modificati..." -ForegroundColor Yellow
git add -A 2>&1 | Out-String
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Verifico file modificati..." -ForegroundColor Yellow
$status = git status --short 2>&1 | Out-String
Write-Host $status
Write-Host ""

Write-Host "[3/4] Creo commit..." -ForegroundColor Yellow
git -c core.pager=cat commit -m "fix: Sistema chiamata API Spedisci.Online + criptazione opzionale + fix vari

- Fix: Broker Spedisci.Online registrato sempre se configurato
- Fix: Gestione utente non trovato (cerca in multiple tabelle)
- Fix: Supporto configurazione default se utente non ha config
- Fix: Decriptazione credenziali quando recuperate dal DB
- Fix: Criptazione opzionale - sistema funziona anche senza ENCRYPTION_KEY
- Fix: Errore sintassi else duplicato in configurations.ts
- Docs: Guide complete per configurazione ENCRYPTION_KEY e fix chiamata API" 2>&1 | Out-String
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[4/4] Eseguo push..." -ForegroundColor Yellow
git -c core.pager=cat push 2>&1 | Out-String
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "COMPLETATO!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vai su Vercel per vedere il deploy automatico." -ForegroundColor Yellow

