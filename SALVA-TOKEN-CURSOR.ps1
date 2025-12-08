# Script per salvare il token "cursor" nel Credential Manager di Windows
# Più sicuro: il token non viene salvato in chiaro nel file .git/config

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SALVATAGGIO TOKEN CURSOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "d:\spediresicuro-master"

# Configura credential helper
Write-Host "[1] Configuro credential helper Windows..." -ForegroundColor Yellow
git config --global credential.helper manager-core
Write-Host "OK: Credential helper configurato" -ForegroundColor Green
Write-Host ""

# Verifica remote attuale
$currentUrl = git remote get-url origin
Write-Host "Remote attuale: $currentUrl" -ForegroundColor Gray
Write-Host ""

# Se il remote ha già un token, rimuovilo per usare credential helper
if ($currentUrl -like "*@github.com*") {
    Write-Host "[2] Rimuovo token dal remote (useremo credential helper)..." -ForegroundColor Yellow
    git remote set-url origin https://github.com/gdsgroupsas-jpg/spediresicuro.git
    Write-Host "OK: Remote pulito" -ForegroundColor Green
    Write-Host ""
}

# Chiedi il token
Write-Host "Inserisci il tuo Personal Access Token 'cursor':" -ForegroundColor Yellow
Write-Host "(Il testo sarà nascosto per sicurezza)" -ForegroundColor Gray
$token = Read-Host -AsSecureString
$tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

if ([string]::IsNullOrWhiteSpace($tokenPlain)) {
    Write-Host "ERRORE: Token non inserito" -ForegroundColor Red
    exit 1
}

# Salva il token nel Credential Manager usando git credential
Write-Host ""
Write-Host "[3] Salvo il token nel Credential Manager di Windows..." -ForegroundColor Yellow

# Usa git credential per salvare
$credentialInput = @"
protocol=https
host=github.com
username=gdsgroupsas-jpg
password=$tokenPlain
"@

$credentialInput | git credential approve

Write-Host "OK: Token salvato nel Credential Manager" -ForegroundColor Green
Write-Host ""

# Prova push
Write-Host "[4] Test push..." -ForegroundColor Yellow
Write-Host "Provo a fare push per verificare il token..." -ForegroundColor Gray
Write-Host ""

$pushOutput = git push origin master 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESSO: Push completato!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Il commit è stato pushato su GitHub" -ForegroundColor Green
    Write-Host "Repository: https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Token 'cursor' salvato correttamente nel Credential Manager!" -ForegroundColor Green
    Write-Host "(Il token è salvato in modo sicuro, non in chiaro)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "ERRORE: Push fallito" -ForegroundColor Red
    Write-Host ""
    Write-Host "Output:" -ForegroundColor Yellow
    Write-Host $pushOutput
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "- Token non valido o scaduto" -ForegroundColor White
    Write-Host "- Token senza permessi 'repo'" -ForegroundColor White
    Write-Host "- Problema di connessione" -ForegroundColor White
    Write-Host ""
    Write-Host "Verifica il token su: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "Assicurati che il token 'cursor' abbia permessi 'repo'" -ForegroundColor Yellow
}

Write-Host ""


