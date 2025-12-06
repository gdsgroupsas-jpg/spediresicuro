# ========================================
# 🚨 PUSH MANUALE IMMEDIATO
# ========================================
# Esegui questo script APRIENDO PowerShell
# nella cartella del progetto e incollando:
# .\PUSH_MANUALE_IMMEDIATO.ps1
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PUSH MANUALE IMMEDIATO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager
$env:GIT_PAGER = ""
git config core.pager ""

# STEP 1: Add
Write-Host "📦 STEP 1: Aggiungo tutti i file..." -ForegroundColor Yellow
git add -A
$addResult = $LASTEXITCODE
Write-Host "   Exit code: $addResult" -ForegroundColor Gray
Write-Host ""

# STEP 2: Commit
Write-Host "💾 STEP 2: Faccio commit..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "chore: push manuale immediato - $timestamp"
Write-Host "   Messaggio: $commitMsg" -ForegroundColor Gray
git commit -m $commitMsg
$commitResult = $LASTEXITCODE
Write-Host "   Exit code: $commitResult" -ForegroundColor Gray

if ($commitResult -eq 0) {
    Write-Host "   ✅ Commit OK" -ForegroundColor Green
} elseif ($commitResult -eq 1) {
    Write-Host "   ℹ️  Nessuna modifica da committare" -ForegroundColor Cyan
} else {
    Write-Host "   ❌ Errore commit" -ForegroundColor Red
}
Write-Host ""

# STEP 3: Push (CON OUTPUT COMPLETO)
Write-Host "🚀 STEP 3: Push su GitHub..." -ForegroundColor Yellow
Write-Host "   (Se chiede credenziali, inseriscile)" -ForegroundColor Yellow
Write-Host ""

# Push con cattura output completo
$pushOutput = git push origin master 2>&1
$pushResult = $LASTEXITCODE

Write-Host "   OUTPUT COMPLETO PUSH:" -ForegroundColor Cyan
Write-Host $pushOutput -ForegroundColor White
Write-Host ""
Write-Host "   Exit code: $pushResult" -ForegroundColor Gray
Write-Host ""

if ($pushResult -eq 0) {
    Write-Host "   ✅✅✅ PUSH COMPLETATO! ✅✅✅" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Verifica su GitHub:" -ForegroundColor Cyan
    Write-Host "   https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master" -ForegroundColor Yellow
} else {
    Write-Host "   ❌❌❌ PUSH FALLITO ❌❌❌" -ForegroundColor Red
    Write-Host ""
    
    if ($pushOutput -match "authentication|credential|password|username|denied|403|401") {
        Write-Host "   ⚠️  PROBLEMA DI AUTENTICAZIONE!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   SOLUZIONE:" -ForegroundColor Yellow
        Write-Host "   1. Vai su: https://github.com/settings/tokens" -ForegroundColor Cyan
        Write-Host "   2. Clicca 'Generate new token (classic)'" -ForegroundColor Cyan
        Write-Host "   3. Nome: 'SpedireSicuro Push'" -ForegroundColor Cyan
        Write-Host "   4. Seleziona: repo (tutti i permessi)" -ForegroundColor Cyan
        Write-Host "   5. Clicca 'Generate token'" -ForegroundColor Cyan
        Write-Host "   6. COPIA il token (lo vedi solo una volta!)" -ForegroundColor Cyan
        Write-Host "   7. Quando Git chiede password, incolla il TOKEN" -ForegroundColor Cyan
        Write-Host "      (NON usare la password di GitHub!)" -ForegroundColor Cyan
    } elseif ($pushOutput -match "connection|network|timeout") {
        Write-Host "   ⚠️  PROBLEMA DI CONNESSIONE!" -ForegroundColor Yellow
        Write-Host "   Verifica la connessione internet" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  ERRORE SCONOSCIUTO" -ForegroundColor Yellow
        Write-Host "   Controlla l'output sopra per dettagli" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Premi un tasto per chiudere..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')



