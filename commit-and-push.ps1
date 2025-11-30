# Script per fare commit e push
$env:GIT_PAGER = ""
git config core.pager ""

Write-Host "📦 Aggiungo tutti i file..." -ForegroundColor Cyan
git add -A

Write-Host "✅ Faccio commit..." -ForegroundColor Cyan
git commit -F commit-msg.txt

Write-Host "🚀 Faccio push su master..." -ForegroundColor Cyan
git push origin master

Write-Host "✨ Fatto! Il codice è stato inviato su GitHub e Vercel lo aggiornerà automaticamente." -ForegroundColor Green
