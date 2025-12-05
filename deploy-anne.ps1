# Script per deploy automatico sezione Anne
Write-Host "🚀 Deploy Sezione Promozionale Anne" -ForegroundColor Cyan
Write-Host ""

# Vai nella cartella del progetto
Set-Location "c:\spediresicuro-master\spediresicuro"
Write-Host "📁 Cartella: $(Get-Location)" -ForegroundColor Yellow

# Verifica git
Write-Host "🔍 Verifica Git..." -ForegroundColor Yellow
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git non trovato! Installa Git prima di continuare." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git trovato: $gitVersion" -ForegroundColor Green

# Verifica repository
Write-Host ""
Write-Host "🔍 Verifica repository..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    Write-Host "❌ Repository Git non trovato!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Repository Git trovato" -ForegroundColor Green

# Mostra stato
Write-Host ""
Write-Host "📊 Stato repository:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Aggiungi file
Write-Host "➕ Aggiunta file..." -ForegroundColor Yellow
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
git add -A
Write-Host "✅ File aggiunti" -ForegroundColor Green

# Mostra file staged
Write-Host ""
Write-Host "📋 File pronti per commit:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Commit
Write-Host "💾 Commit..." -ForegroundColor Yellow
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit completato" -ForegroundColor Green
} else {
    Write-Host "⚠️  Nessun cambiamento da committare o commit fallito" -ForegroundColor Yellow
}

# Verifica remote
Write-Host ""
Write-Host "🔍 Verifica remote..." -ForegroundColor Yellow
$remote = git remote -v
if ($remote) {
    Write-Host "✅ Remote configurato:" -ForegroundColor Green
    Write-Host $remote
} else {
    Write-Host "❌ Nessun remote configurato!" -ForegroundColor Red
    Write-Host "Configura un remote con: git remote add origin <url>" -ForegroundColor Yellow
    exit 1
}

# Verifica branch
Write-Host ""
Write-Host "🔍 Verifica branch..." -ForegroundColor Yellow
$branch = git branch --show-current
if (-not $branch) {
    $branch = git rev-parse --abbrev-ref HEAD
}
Write-Host "✅ Branch corrente: $branch" -ForegroundColor Green

# Push
Write-Host ""
Write-Host "🚀 Push su remote..." -ForegroundColor Yellow
git push origin $branch
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅✅✅ PUSH COMPLETATO! ✅✅✅" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Vercel dovrebbe avviare il deploy automaticamente tra pochi secondi..." -ForegroundColor Cyan
    Write-Host "⏱️  Il deploy richiede circa 2-5 minuti" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Verifica il deploy su: https://vercel.com/dashboard" -ForegroundColor Yellow
} else {
    Write-Host "❌ Push fallito!" -ForegroundColor Red
    Write-Host "Verifica i permessi e la connessione al remote" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✨ Completato!" -ForegroundColor Green

