# Script per configurare Git correttamente per il progetto SpedireSicuro
# Esegui questo script una volta per configurare Git definitivamente

Write-Host "🔧 Configurazione Git per SpedireSicuro..." -ForegroundColor Cyan

# Verifica se siamo nella directory corretta
if (-not (Test-Path ".git")) {
    Write-Host "❌ Errore: Non sei in una directory Git!" -ForegroundColor Red
    exit 1
}

# Configura user.name
git config user.name "gdsgroupsas-jpg"
Write-Host "✅ user.name configurato: gdsgroupsas-jpg" -ForegroundColor Green

# Configura user.email
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
Write-Host "✅ user.email configurato: gdsgroupsas-jpg@users.noreply.github.com" -ForegroundColor Green

# Verifica configurazione
Write-Host "`n📋 Configurazione attuale:" -ForegroundColor Yellow
Write-Host "   user.name:  $(git config user.name)" -ForegroundColor White
Write-Host "   user.email: $(git config user.email)" -ForegroundColor White

# Verifica che sia corretto
$userName = git config user.name
if ($userName -eq "gdsgroupsas-jpg") {
    Write-Host "`n✅ Configurazione Git completata correttamente!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Errore: La configurazione non è corretta!" -ForegroundColor Red
    exit 1
}

Write-Host "`n💡 Prossimo passo: Esegui 'git add' e 'git commit' normalmente" -ForegroundColor Cyan
