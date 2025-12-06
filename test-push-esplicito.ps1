# Test esplicito push

Write-Host "TEST PUSH GITHUB" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager
$env:GIT_PAGER = ""
git config core.pager ""

Write-Host "Verifico stato..." -ForegroundColor Yellow
$status = git status --short
Write-Host "Status: $status" -ForegroundColor White
Write-Host ""

Write-Host "Verifico commit locali..." -ForegroundColor Yellow
$commits = git log --oneline -3
Write-Host "Ultimi 3 commit:" -ForegroundColor White
Write-Host $commits
Write-Host ""

Write-Host "Eseguo fetch..." -ForegroundColor Yellow
git fetch origin
Write-Host "Fetch completato" -ForegroundColor Green
Write-Host ""

Write-Host "Verifico differenze..." -ForegroundColor Yellow
$diff = git log origin/master..HEAD --oneline
if ($diff) {
    Write-Host "Commit da pushare:" -ForegroundColor Yellow
    Write-Host $diff -ForegroundColor White
    Write-Host ""
    Write-Host "ESEGUO PUSH..." -ForegroundColor Cyan
    $output = git push origin master 2>&1 | Out-String
    Write-Host "Output push:" -ForegroundColor White
    Write-Host $output
    Write-Host ""
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PUSH COMPLETATO!" -ForegroundColor Green
    } else {
        Write-Host "❌ ERRORE PUSH (codice: $LASTEXITCODE)" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Nessun commit da pushare" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verifica manuale su:" -ForegroundColor Yellow
Write-Host "https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Cyan




