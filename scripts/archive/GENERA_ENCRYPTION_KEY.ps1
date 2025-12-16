# Script per generare ENCRYPTION_KEY
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GENERAZIONE ENCRYPTION_KEY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Genera chiave esadecimale di 64 caratteri (32 bytes)
$encryptionKey = [Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))

Write-Host "ENCRYPTION_KEY generata:" -ForegroundColor Green
Write-Host ""
Write-Host $encryptionKey -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COPIA QUESTA RIGA NEL TUO .env.local:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ENCRYPTION_KEY=$encryptionKey" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "- Aggiungi questa riga al file .env.local nella root del progetto" -ForegroundColor Yellow
Write-Host "- Aggiungi la STESSA chiave anche in automation-service/.env" -ForegroundColor Yellow
Write-Host "- Aggiungi la STESSA chiave anche su Vercel" -ForegroundColor Yellow
Write-Host "- DEVE essere la STESSA in tutti e tre i posti!" -ForegroundColor Yellow
Write-Host ""
