# Script per verificare lo stato Git
$env:GIT_PAGER = ""
$env:PAGER = ""

Write-Host "=== VERIFICA STATO GIT ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Ultimi 5 commit:" -ForegroundColor Yellow
git log --oneline -5
Write-Host ""

Write-Host "Stato repository:" -ForegroundColor Yellow
git status --short
Write-Host ""

Write-Host "Commit locali non ancora su remote:" -ForegroundColor Yellow
git log origin/master..master --oneline
Write-Host ""

Write-Host "=== FINE VERIFICA ===" -ForegroundColor Cyan


