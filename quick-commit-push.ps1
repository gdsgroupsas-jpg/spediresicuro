# Quick commit and push - no pager
Set-Location "C:\spediresicuro-master\spediresicuro"

# Disabilita completamente il pager
$env:GIT_PAGER = ""
$env:PAGER = ""

# Configurazione git temporanea
git config --global core.pager ""

Write-Host "Aggiungo file..." -ForegroundColor Yellow
git add lib/actions/spedisci-online.ts 2>&1 | Out-Null
git add lib/security/encryption.ts 2>&1 | Out-Null
git add actions/configurations.ts 2>&1 | Out-Null
git add docs/*.md 2>&1 | Out-Null
git add env.example.txt 2>&1 | Out-Null
git add -A 2>&1 | Out-Null

Write-Host "Creo commit..." -ForegroundColor Yellow
git commit -m "fix: Sistema chiamata API Spedisci.Online + criptazione opzionale + fix vari" 2>&1 | Out-Null

Write-Host "Eseguo push..." -ForegroundColor Yellow
git push 2>&1 | Out-Null

Write-Host "FATTO!" -ForegroundColor Green

