# Script per rimuovere file problematico e sincronizzare con Git

Write-Host "🔍 Analisi file problematico..." -ForegroundColor Yellow

# Rimuovi file problematico
if (Test-Path "pediresicuro-masterspediresicuro") {
    Write-Host "❌ File trovato: pediresicuro-masterspediresicuro" -ForegroundColor Red
    Remove-Item "pediresicuro-masterspediresicuro" -Force -ErrorAction SilentlyContinue
    Write-Host "✅ File rimosso" -ForegroundColor Green
} else {
    Write-Host "✅ File non trovato (già rimosso)" -ForegroundColor Green
}

# Reset Git
Write-Host "`n🔄 Reset Git..." -ForegroundColor Yellow
git reset --hard HEAD 2>&1 | Out-Null

# Stash modifiche locali
Write-Host "📦 Stash modifiche locali..." -ForegroundColor Yellow
git stash push -m "Stash automatico prima di sync" 2>&1 | Out-Null

# Pull da remoto
Write-Host "⬇️  Pull da origin/master..." -ForegroundColor Yellow
git pull origin master 2>&1

# Verifica stato
Write-Host "`n📊 Stato finale:" -ForegroundColor Cyan
git status --short

Write-Host "`n✅ Sincronizzazione completata!" -ForegroundColor Green



