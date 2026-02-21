# Script per generare token sicuri per il progetto
# Esegui questo script per generare tutti i token necessari

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GENERATORE TOKEN SICURI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Funzione per generare token casuale
function Generate-Token {
    param([int]$Length = 32)
    $chars = (65..90) + (97..122) + (48..57) + (45, 95)  # A-Z, a-z, 0-9, -, _
    return -join ($chars | Get-Random -Count $Length | ForEach-Object {[char]$_})
}

# Funzione per generare encryption key (hex)
function Generate-EncryptionKey {
    $bytes = 1..32 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}
    return [Convert]::ToHexString($bytes)
}

Write-Host "1. AUTOMATION_SERVICE_TOKEN" -ForegroundColor Yellow
$automationToken = Generate-Token -Length 40
Write-Host "   $automationToken" -ForegroundColor Green
Write-Host ""

Write-Host "2. CRON_SECRET_TOKEN" -ForegroundColor Yellow
$cronToken = Generate-Token -Length 40
Write-Host "   $cronToken" -ForegroundColor Green
Write-Host ""

Write-Host "3. DIAGNOSTICS_TOKEN" -ForegroundColor Yellow
Write-Host "   d4t1_d14gn0st1c1_s3gr3t1_2025_x9z" -ForegroundColor Green
Write-Host "   (già configurato, oppure genera uno nuovo)" -ForegroundColor Gray
Write-Host ""

Write-Host "4. NEXTAUTH_SECRET" -ForegroundColor Yellow
$nextAuthSecret = Generate-Token -Length 64
Write-Host "   $nextAuthSecret" -ForegroundColor Green
Write-Host ""

Write-Host "5. ENCRYPTION_KEY (64 caratteri hex)" -ForegroundColor Yellow
$encryptionKey = Generate-EncryptionKey
Write-Host "   $encryptionKey" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COPIA QUESTI VALORI NEI TUOI FILE .env" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Per .env.local (Next.js):" -ForegroundColor Yellow
Write-Host "AUTOMATION_SERVICE_TOKEN=$automationToken" -ForegroundColor White
Write-Host "NEXTAUTH_SECRET=$nextAuthSecret" -ForegroundColor White
Write-Host "DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z" -ForegroundColor White
Write-Host "ENCRYPTION_KEY=$encryptionKey" -ForegroundColor White
Write-Host ""

Write-Host "Per automation-service/.env:" -ForegroundColor Yellow
Write-Host "AUTOMATION_SERVICE_TOKEN=$automationToken" -ForegroundColor White
Write-Host "CRON_SECRET_TOKEN=$cronToken" -ForegroundColor White
Write-Host "DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z" -ForegroundColor White
Write-Host "ENCRYPTION_KEY=$encryptionKey" -ForegroundColor White
Write-Host ""

Write-Host "Per Vercel:" -ForegroundColor Yellow
Write-Host "Aggiungi le stesse variabili con gli stessi valori" -ForegroundColor White
Write-Host ""

Write-Host "⚠️ IMPORTANTE:" -ForegroundColor Red
Write-Host "- ENCRYPTION_KEY deve essere LO STESSO in Next.js e automation-service" -ForegroundColor Yellow
Write-Host "- AUTOMATION_SERVICE_TOKEN deve essere LO STESSO in Next.js e automation-service" -ForegroundColor Yellow
Write-Host "- Salva questi valori in un posto sicuro!" -ForegroundColor Yellow
Write-Host ""
