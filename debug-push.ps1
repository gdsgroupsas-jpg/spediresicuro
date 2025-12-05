# Script di debug per capire perché il push non funziona

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEBUG PUSH GITHUB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager
$env:GIT_PAGER = ""
git config core.pager ""

Write-Host "1. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "   Modifiche trovate:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor White
} else {
    Write-Host "   ✅ Nessuna modifica" -ForegroundColor Green
}
Write-Host ""

Write-Host "2. Verifica ultimo commit locale..." -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "   $lastCommit" -ForegroundColor White
Write-Host ""

Write-Host "3. Fetch da GitHub..." -ForegroundColor Yellow
git fetch origin 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host ""

Write-Host "4. Verifica commit da pushare..." -ForegroundColor Yellow
$commitsToPush = git log origin/master..HEAD --oneline
if ($commitsToPush) {
    Write-Host "   Commit da pushare:" -ForegroundColor Yellow
    Write-Host $commitsToPush -ForegroundColor White
    Write-Host ""
    
    Write-Host "5. PROVO PUSH CON OUTPUT VERBOSO..." -ForegroundColor Cyan
    Write-Host "   (Se chiede credenziali, inseriscile)" -ForegroundColor Yellow
    Write-Host ""
    
    # Push con output completo
    $pushResult = git push origin master 2>&1
    $exitCode = $LASTEXITCODE
    
    Write-Host "   Output push:" -ForegroundColor Yellow
    Write-Host $pushResult -ForegroundColor White
    Write-Host ""
    
    if ($exitCode -eq 0) {
        Write-Host "   ✅ PUSH COMPLETATO!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PUSH FALLITO (codice: $exitCode)" -ForegroundColor Red
        
        if ($pushResult -match "authentication|credential|password|username") {
            Write-Host ""
            Write-Host "   ⚠️  PROBLEMA DI AUTENTICAZIONE!" -ForegroundColor Yellow
            Write-Host "   Soluzione:" -ForegroundColor Yellow
            Write-Host "   1. Vai su: https://github.com/settings/tokens" -ForegroundColor Cyan
            Write-Host "   2. Crea Personal Access Token (classic)" -ForegroundColor Cyan
            Write-Host "   3. Seleziona permessi: repo (tutti)" -ForegroundColor Cyan
            Write-Host "   4. Quando Git chiede password, incolla il TOKEN (non la password)" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ✅ Nessun commit da pushare (già sincronizzato)" -ForegroundColor Green
}

Write-Host ""
Write-Host "6. Verifica sincronizzazione finale..." -ForegroundColor Yellow
$localHash = git rev-parse HEAD
$remoteHash = git rev-parse origin/master
if ($localHash -eq $remoteHash) {
    Write-Host "   ✅ Locale e remoto sincronizzati" -ForegroundColor Green
    Write-Host "   Hash: $localHash" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Locale e remoto diversi" -ForegroundColor Yellow
    Write-Host "   Locale:  $localHash" -ForegroundColor Cyan
    Write-Host "   Remoto:  $remoteHash" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEBUG COMPLETATO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
