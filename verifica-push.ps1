# Script per verificare se il push è andato a buon fine

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICA PUSH GITHUB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager
$env:GIT_PAGER = ""
git config core.pager ""

Write-Host "1. Verifica file locali..." -ForegroundColor Yellow
$files = @("sync-automatico.ps1", "avvia-lavoro.ps1", "salva-lavoro.ps1", "GUIDA_SCRIPT_AUTOMATICI.md")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file esiste" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NON esiste" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "2. Verifica se file sono tracciati da Git..." -ForegroundColor Yellow
foreach ($file in $files) {
    $tracked = git ls-files $file 2>&1
    if ($tracked -and $LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $file è tracciato" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NON è tracciato" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "3. Verifica ultimo commit..." -ForegroundColor Yellow
$lastCommit = git log -1 --oneline 2>&1
if ($lastCommit) {
    Write-Host "   Ultimo commit:" -ForegroundColor Cyan
    Write-Host "   $lastCommit" -ForegroundColor White
} else {
    Write-Host "   ⚠️  Nessun commit trovato" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "4. Verifica stato repository..." -ForegroundColor Yellow
git fetch origin 2>&1 | Out-Null
$status = git status --porcelain 2>&1
if ($status) {
    Write-Host "   ⚠️  Ci sono modifiche non committate:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor White
} else {
    Write-Host "   ✅ Repository pulito" -ForegroundColor Green
}
Write-Host ""

Write-Host "5. Verifica commit da pushare..." -ForegroundColor Yellow
$commitsToPush = git log origin/master..HEAD --oneline 2>&1
if ($commitsToPush) {
    Write-Host "   ⚠️  Ci sono commit da pushare:" -ForegroundColor Yellow
    Write-Host $commitsToPush -ForegroundColor White
    Write-Host ""
    Write-Host "   Eseguo push ora..." -ForegroundColor Cyan
    $pushOutput = git push origin master 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Push completato!" -ForegroundColor Green
        Write-Host $pushOutput -ForegroundColor White
    } else {
        Write-Host "   ❌ Errore durante push:" -ForegroundColor Red
        Write-Host $pushOutput -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Nessun commit da pushare (già sincronizzato)" -ForegroundColor Green
}
Write-Host ""

Write-Host "6. Verifica sincronizzazione..." -ForegroundColor Yellow
$localHash = git rev-parse HEAD 2>&1
$remoteHash = git rev-parse origin/master 2>&1
if ($localHash -eq $remoteHash) {
    Write-Host "   ✅ Locale e remoto sono sincronizzati" -ForegroundColor Green
    Write-Host "   Hash: $localHash" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠️  Locale e remoto sono diversi" -ForegroundColor Yellow
    Write-Host "   Locale:  $localHash" -ForegroundColor Cyan
    Write-Host "   Remoto:  $remoteHash" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICA COMPLETATA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Verifica su GitHub:" -ForegroundColor Yellow
Write-Host "   https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Cyan
Write-Host ""



