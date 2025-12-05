cd d:\spediresicuro-master

# Rimuovi file problematico se esiste
if (Test-Path "tatus") {
    Remove-Item "tatus" -Force
    Write-Host "Rimosso file tatus" -ForegroundColor Yellow
}

# Aggiungi file
Write-Host "`n=== Aggiunta file ===" -ForegroundColor Cyan
git add components/homepage/dynamic/
git add app/page.tsx
$status = git status --short
Write-Host $status

if ($status -match "components/homepage/dynamic|app/page.tsx") {
    Write-Host "`n=== Commit ===" -ForegroundColor Cyan
    git commit -m "feat: Homepage dinamica con animazioni Framer Motion"
    
    $lastCommit = git log --oneline -1
    Write-Host "Ultimo commit: $lastCommit" -ForegroundColor Green
    
    Write-Host "`n=== Push ===" -ForegroundColor Cyan
    git push origin master
    
    Write-Host "`n=== Completato! ===" -ForegroundColor Green
} else {
    Write-Host "`nNessun file da committare!" -ForegroundColor Yellow
    Write-Host "File presenti:" -ForegroundColor Yellow
    git status
}
