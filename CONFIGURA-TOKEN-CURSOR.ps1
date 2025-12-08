# Script per configurare il token GitHub "cursor" esistente

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAZIONE TOKEN CURSOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "d:\spediresicuro-master"

# Configura credential helper
Write-Host "[1] Configuro credential helper..." -ForegroundColor Yellow
git config --global credential.helper manager-core
Write-Host "OK: Credential helper configurato" -ForegroundColor Green
Write-Host ""

# Chiedi il token
Write-Host "Inserisci il tuo Personal Access Token 'cursor':" -ForegroundColor Yellow
Write-Host "(Il testo sarà nascosto per sicurezza)" -ForegroundColor Gray
$token = Read-Host -AsSecureString
$tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

if ([string]::IsNullOrWhiteSpace($tokenPlain)) {
    Write-Host "ERRORE: Token non inserito" -ForegroundColor Red
    exit 1
}

# Verifica formato token
if (-not $tokenPlain.StartsWith("ghp_") -and -not $tokenPlain.StartsWith("github_pat_")) {
    Write-Host ""
    Write-Host "ATTENZIONE: Il token dovrebbe iniziare con 'ghp_' o 'github_pat_'" -ForegroundColor Yellow
    Write-Host "Continuo comunque..." -ForegroundColor Gray
    Write-Host ""
}

# Configura il remote con il token
Write-Host "[2] Configuro il remote con il token..." -ForegroundColor Yellow
$newUrl = "https://$tokenPlain@github.com/gdsgroupsas-jpg/spediresicuro.git"
git remote set-url origin $newUrl

Write-Host "OK: Token configurato nel remote" -ForegroundColor Green
Write-Host ""

# Verifica configurazione
Write-Host "[3] Verifica configurazione..." -ForegroundColor Yellow
$currentUrl = git remote get-url origin
if ($currentUrl -like "*@github.com*") {
    Write-Host "OK: Remote configurato correttamente" -ForegroundColor Green
    # Nascondi il token nell'output
    $maskedUrl = $currentUrl -replace 'https://[^@]+@', 'https://***@'
    Write-Host "Remote URL: $maskedUrl" -ForegroundColor Gray
} else {
    Write-Host "ATTENZIONE: Remote potrebbe non essere configurato correttamente" -ForegroundColor Yellow
}
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
    Write-Host "Token 'cursor' configurato correttamente!" -ForegroundColor Green
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


