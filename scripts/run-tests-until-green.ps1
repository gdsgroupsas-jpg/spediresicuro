# Script PowerShell per eseguire test fino a quando sono tutti verdi
# Uso: powershell -ExecutionPolicy Bypass -File scripts/run-tests-until-green.ps1

Write-Host "🚀 Eseguo test Playwright fino al successo..." -ForegroundColor Green
Write-Host ""

$MAX_ATTEMPTS = 20
$ATTEMPT = 1

while ($ATTEMPT -le $MAX_ATTEMPTS) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Tentativo $ATTEMPT/$MAX_ATTEMPTS" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    npm run test:e2e
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅✅✅ TUTTI I TEST SONO VERDI! 🎉" -ForegroundColor Green
        exit 0
    }
    
    Write-Host ""
    Write-Host "⚠️ Test falliti, riprovo tra 5 secondi..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $ATTEMPT++
}

Write-Host ""
Write-Host "❌ Raggiunto limite di tentativi" -ForegroundColor Red
exit 1
