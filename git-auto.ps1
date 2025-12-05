# ========================================
# 🤖 GIT AUTO - Tutto Automatico
# ========================================
# Script che fa TUTTO in automatico:
# - Pull da GitHub
# - Add tutti i file
# - Commit automatico
# - Push su GitHub
# NESSUNA richiesta, tutto automatico!
# ========================================

# Colori output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Header
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  🤖 GIT AUTO - Tutto Automatico" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

# Disabilita pager Git
$env:GIT_PAGER = ""
$env:PAGER = ""
git config core.pager ""

# ========================================
# STEP 1: Verifica Account Git
# ========================================
Write-ColorOutput "📋 STEP 1: Verifica configurazione Git..." "Yellow"
$gitUser = git config user.name
if (-not $gitUser -or $gitUser -ne "gdsgroupsas-jpg") {
    Write-ColorOutput "   Configuro account: gdsgroupsas-jpg" "Cyan"
    git config user.name "gdsgroupsas-jpg"
}
Write-ColorOutput "✅ Account Git OK" "Green"
Write-Host ""

# ========================================
# STEP 2: Pull da GitHub
# ========================================
Write-ColorOutput "📥 STEP 2: Sincronizzazione con GitHub..." "Yellow"
$pullOutput = git pull origin master 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Repository aggiornato" "Green"
} else {
    Write-ColorOutput "⚠️  Possibili conflitti nel pull" "Yellow"
}
Write-Host ""

# ========================================
# STEP 3: Add Tutti i File
# ========================================
Write-ColorOutput "📦 STEP 3: Aggiunta file modificati..." "Yellow"
git add -A
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ File aggiunti" "Green"
} else {
    Write-ColorOutput "❌ Errore durante git add" "Red"
    exit 1
}
Write-Host ""

# ========================================
# STEP 4: Commit Automatico
# ========================================
Write-ColorOutput "💾 STEP 4: Commit automatico..." "Yellow"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "chore: aggiornamento automatico - $timestamp"
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Commit completato: $commitMessage" "Green"
} else {
    # Se non ci sono modifiche da committare, va bene lo stesso
    if ($LASTEXITCODE -eq 1) {
        Write-ColorOutput "ℹ️  Nessuna modifica da committare" "Cyan"
    } else {
        Write-ColorOutput "❌ Errore durante commit" "Red"
        exit 1
    }
}
Write-Host ""

# ========================================
# STEP 5: Push su GitHub
# ========================================
Write-ColorOutput "🚀 STEP 5: Push su GitHub..." "Yellow"
$pushOutput = git push origin master 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Push completato" "Green"
    Write-ColorOutput "   Vercel aggiornerà automaticamente il sito" "Cyan"
} else {
    Write-ColorOutput "❌ Errore durante push" "Red"
    Write-ColorOutput "   Output: $pushOutput" "Yellow"
    Write-ColorOutput "   Verifica le credenziali GitHub" "Yellow"
    exit 1
}
Write-Host ""

# ========================================
# RIEPILOGO FINALE
# ========================================
Write-ColorOutput "========================================" "Green"
Write-ColorOutput "  ✅ TUTTO COMPLETATO AUTOMATICAMENTE" "Green"
Write-ColorOutput "========================================`n" "Green"

Write-ColorOutput "📌 Riepilogo:" "Cyan"
Write-ColorOutput "   • Repository sincronizzato" "White"
Write-ColorOutput "   • File committati" "White"
Write-ColorOutput "   • Push completato su GitHub" "White"
Write-ColorOutput "   • Vercel aggiornerà automaticamente" "White"
Write-Host ""

Write-ColorOutput "🔗 Verifica:" "Cyan"
Write-ColorOutput "   • GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro" "White"
Write-ColorOutput "   • Vercel: https://vercel.com" "White"
Write-Host ""

