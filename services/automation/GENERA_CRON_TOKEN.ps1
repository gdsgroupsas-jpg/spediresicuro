# ============================================
# GENERATORE TOKEN CRON_SECRET_TOKEN
# ============================================
# Genera un token sicuro casuale per CRON_SECRET_TOKEN
# Usa questo token nel file .env di automation-service

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GENERATORE CRON_SECRET_TOKEN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Genera un token casuale sicuro (40 caratteri)
# Usa lettere maiuscole, minuscole, numeri e caratteri speciali
$cronToken = -join (
    (65..90) +      # A-Z
    (97..122) +     # a-z
    (48..57) +      # 0-9
    (45, 95)        # - e _
    | Get-Random -Count 40 | ForEach-Object {[char]$_}
)

Write-Host "✅ Token generato con successo!" -ForegroundColor Green
Write-Host ""
Write-Host "CRON_SECRET_TOKEN:" -ForegroundColor Yellow
Write-Host $cronToken -ForegroundColor White -BackgroundColor DarkGray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ISTRUZIONI:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copia il token qui sopra" -ForegroundColor Yellow
Write-Host "2. Apri il file .env nella cartella automation-service" -ForegroundColor Yellow
Write-Host "3. Cerca la riga: CRON_SECRET_TOKEN=..." -ForegroundColor Yellow
Write-Host "4. Sostituisci con: CRON_SECRET_TOKEN=$cronToken" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Red
Write-Host "   - Questo token DEVE essere diverso da AUTOMATION_SERVICE_TOKEN" -ForegroundColor Yellow
Write-Host "   - NON condividere questo token pubblicamente" -ForegroundColor Yellow
Write-Host "   - Salvalo in un posto sicuro" -ForegroundColor Yellow
Write-Host ""
Write-Host "Premi un tasto per copiare il token negli appunti..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Copia negli appunti (se disponibile)
try {
    Set-Clipboard -Value $cronToken
    Write-Host "✅ Token copiato negli appunti!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Impossibile copiare negli appunti automaticamente" -ForegroundColor Yellow
    Write-Host "   Copia manualmente il token qui sopra" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Premi un tasto per uscire..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
