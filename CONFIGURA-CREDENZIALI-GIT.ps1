# Script per configurare credenziali Git per GitHub
# Risolve il problema del push che richiede autenticazione

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAZIONE CREDENZIALI GIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "d:\spediresicuro-master"

# Verifica configurazione attuale
Write-Host "[1] Verifica configurazione attuale..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin
Write-Host "Remote URL: $remoteUrl" -ForegroundColor Gray

$credentialHelper = git config --global credential.helper
if ($credentialHelper) {
    Write-Host "Credential Helper: $credentialHelper" -ForegroundColor Gray
} else {
    Write-Host "Credential Helper: NON CONFIGURATO" -ForegroundColor Red
}

Write-Host ""
Write-Host "[2] Configurazione automatica..." -ForegroundColor Yellow

# Configura credential helper per Windows
Write-Host "Configuro credential helper per Windows..." -ForegroundColor Gray
git config --global credential.helper manager-core

# Verifica se è HTTPS o SSH
if ($remoteUrl -like "https://*") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "CONFIGURAZIONE HTTPS (ATTUALE)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Per GitHub con HTTPS serve un Personal Access Token (PAT)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPZIONE 1: Usa Personal Access Token (CONSIGLIATO)" -ForegroundColor Green
    Write-Host "1. Vai su: https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "2. Clicca 'Generate new token' -> 'Generate new token (classic)'" -ForegroundColor White
    Write-Host "3. Dai un nome (es: 'SpedireSicuro')" -ForegroundColor White
    Write-Host "4. Seleziona scadenza (consiglio: 90 giorni o No expiration)" -ForegroundColor White
    Write-Host "5. Seleziona permessi: repo (tutti i permessi)" -ForegroundColor White
    Write-Host "6. Clicca 'Generate token'" -ForegroundColor White
    Write-Host "7. COPIA IL TOKEN (lo vedrai solo una volta!)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Quando fai push, usa:" -ForegroundColor Yellow
    Write-Host "  Username: gdsgroupsas-jpg" -ForegroundColor White
    Write-Host "  Password: [INCOLLA IL TOKEN QUI]" -ForegroundColor White
    Write-Host ""
    
    Write-Host "OPZIONE 2: Cambia a SSH (più semplice)" -ForegroundColor Green
    Write-Host "Vuoi che cambi il remote a SSH? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Cambio remote a SSH..." -ForegroundColor Yellow
        git remote set-url origin git@github.com:gdsgroupsas-jpg/spediresicuro.git
        Write-Host "OK: Remote cambiato a SSH" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANTE: Assicurati di avere una chiave SSH configurata su GitHub" -ForegroundColor Yellow
        Write-Host "Guida: https://docs.github.com/en/authentication/connecting-to-github-with-ssh" -ForegroundColor Cyan
    }
} else {
    Write-Host "Remote è già configurato con SSH" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3] Test push..." -ForegroundColor Yellow
Write-Host "Provo a fare push per verificare le credenziali..." -ForegroundColor Gray
Write-Host ""

# Prova push
$pushResult = git push origin master 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -eq 0) {
    Write-Host "SUCCESSO: Push completato!" -ForegroundColor Green
} else {
    Write-Host "Push richiede autenticazione" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Output:" -ForegroundColor Gray
    Write-Host $pushResult
    Write-Host ""
    Write-Host "Se vedi 'Authentication failed' o 'Permission denied':" -ForegroundColor Red
    Write-Host "1. Configura un Personal Access Token (vedi sopra)" -ForegroundColor White
    Write-Host "2. Oppure configura SSH (vedi sopra)" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAZIONE COMPLETATA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""


