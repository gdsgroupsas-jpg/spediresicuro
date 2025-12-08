# Script interattivo per inserire credenziali Git
# Risolve il problema del push che richiede autenticazione

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSERIMENTO CREDENZIALI GIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "d:\spediresicuro-master"

# Configura credential helper
Write-Host "[1] Configuro credential helper per Windows..." -ForegroundColor Yellow
git config --global credential.helper manager-core
Write-Host "OK: Credential helper configurato" -ForegroundColor Green
Write-Host ""

# Verifica remote
$remoteUrl = git remote get-url origin
Write-Host "Remote attuale: $remoteUrl" -ForegroundColor Gray
Write-Host ""

# Spiega cosa serve
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COSA SERVE PER GITHUB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "GitHub non accetta più password, serve un Personal Access Token (PAT)" -ForegroundColor Yellow
Write-Host ""
Write-Host "OPZIONE 1: Creare un nuovo token (CONSIGLIATO)" -ForegroundColor Green
Write-Host "1. Vai su: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "2. Clicca 'Generate new token' -> 'Generate new token (classic)'" -ForegroundColor White
Write-Host "3. Nome: 'SpedireSicuro-Push'" -ForegroundColor White
Write-Host "4. Scadenza: 90 giorni (o No expiration)" -ForegroundColor White
Write-Host "5. Permessi: Seleziona 'repo' (tutti i permessi)" -ForegroundColor White
Write-Host "6. Clicca 'Generate token'" -ForegroundColor White
Write-Host "7. COPIA IL TOKEN (lo vedrai solo una volta!)" -ForegroundColor Red
Write-Host ""
Write-Host "OPZIONE 2: Hai già un token?" -ForegroundColor Green
Write-Host "Se hai già un token, possiamo usarlo direttamente" -ForegroundColor White
Write-Host ""

# Chiedi se ha già un token
Write-Host "Hai già un Personal Access Token? (s/n)" -ForegroundColor Yellow
$hasToken = Read-Host

if ($hasToken -eq "s" -or $hasToken -eq "S" -or $hasToken -eq "y" -or $hasToken -eq "Y") {
    Write-Host ""
    Write-Host "Incolla il tuo Personal Access Token qui:" -ForegroundColor Yellow
    Write-Host "(Il testo sarà nascosto per sicurezza)" -ForegroundColor Gray
    $token = Read-Host -AsSecureString
    $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
    
    # Configura il token nell'URL
    Write-Host ""
    Write-Host "Configuro il token nel remote..." -ForegroundColor Yellow
    
    # Modifica l'URL per includere il token
    $newUrl = "https://$tokenPlain@github.com/gdsgroupsas-jpg/spediresicuro.git"
    git remote set-url origin $newUrl
    
    Write-Host "OK: Token configurato" -ForegroundColor Green
    Write-Host ""
    Write-Host "ATTENZIONE: Il token è ora salvato nella configurazione Git" -ForegroundColor Yellow
    Write-Host "Per sicurezza, considera di usare SSH invece (più sicuro)" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ISTRUZIONI PER CREARE IL TOKEN" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Apri il browser e vai su:" -ForegroundColor White
    Write-Host "   https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Clicca 'Generate new token' -> 'Generate new token (classic)'" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Compila il form:" -ForegroundColor White
    Write-Host "   - Note: SpedireSicuro-Push" -ForegroundColor Gray
    Write-Host "   - Expiration: 90 days (o No expiration)" -ForegroundColor Gray
    Write-Host "   - Scorri e seleziona: repo (tutti i permessi)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Clicca 'Generate token'" -ForegroundColor White
    Write-Host ""
    Write-Host "5. COPIA IL TOKEN (inizia con 'ghp_...')" -ForegroundColor Red
    Write-Host ""
    Write-Host "6. Torna qui e premi INVIO quando hai copiato il token" -ForegroundColor Yellow
    Read-Host
    
    Write-Host ""
    Write-Host "Incolla il token qui:" -ForegroundColor Yellow
    Write-Host "(Il testo sarà nascosto per sicurezza)" -ForegroundColor Gray
    $token = Read-Host -AsSecureString
    $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
    
    # Configura il token nell'URL
    Write-Host ""
    Write-Host "Configuro il token nel remote..." -ForegroundColor Yellow
    
    $newUrl = "https://$tokenPlain@github.com/gdsgroupsas-jpg/spediresicuro.git"
    git remote set-url origin $newUrl
    
    Write-Host "OK: Token configurato" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2] Test push..." -ForegroundColor Yellow
Write-Host "Provo a fare push per verificare..." -ForegroundColor Gray
Write-Host ""

# Prova push
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
    Write-Host "Riprova con un nuovo token" -ForegroundColor Yellow
}

Write-Host ""


