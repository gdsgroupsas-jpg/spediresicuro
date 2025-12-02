# Script PowerShell per commit e push
# Esegui questo script aprendo PowerShell nella cartella del progetto

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMMIT E PUSH SU MASTER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita il pager di git
$env:GIT_PAGER = ""
$env:PAGER = ""
git config core.pager ""

Write-Host "📦 Passo 1: Aggiungo tutti i file modificati..." -ForegroundColor Yellow
git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante git add" -ForegroundColor Red
    exit 1
}
Write-Host "✅ File aggiunti correttamente" -ForegroundColor Green
Write-Host ""

Write-Host "💾 Passo 2: Faccio commit..." -ForegroundColor Yellow
git commit -m "chore: pulizia file obsoleti e commit modifiche"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante git commit" -ForegroundColor Red
    Write-Host "💡 Prova a vedere lo stato con: git status" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Commit completato" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Passo 3: Faccio push su master..." -ForegroundColor Yellow
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante git push" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ COMPLETATO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Il codice è stato inviato su GitHub." -ForegroundColor Cyan
Write-Host "Vercel aggiornerà automaticamente il sito." -ForegroundColor Cyan
Write-Host ""
Write-Host "Puoi verificare su: https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Yellow


