# ========================================
# 💾 SALVA LAVORO - Commit e Push Automatico
# ========================================
# Script per salvare tutto prima di finire
# ========================================

param(
    [string]$Messaggio = "",  # Messaggio commit personalizzato
    [switch]$Forza = $true    # DEFAULT: true - non chiede conferma, tutto automatico
)

# Colori output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Header
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  💾 SALVA LAVORO - Commit e Push" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

# Disabilita pager Git
$env:GIT_PAGER = ""
$env:PAGER = ""
git config core.pager ""

# ========================================
# STEP 1: Verifica Modifiche
# ========================================
Write-ColorOutput "📊 STEP 1: Verifica modifiche..." "Yellow"
$status = git status --short
$hasChanges = $status -ne $null -and $status.Count -gt 0

if (-not $hasChanges) {
    Write-ColorOutput "✅ Nessuna modifica da salvare" "Green"
    Write-ColorOutput "   Repository già aggiornato" "Cyan"
    exit 0
}

Write-ColorOutput "📝 File modificati:" "Cyan"
git status --short | ForEach-Object {
    Write-ColorOutput "   $_" "White"
}
Write-Host ""

# ========================================
# STEP 2: Genera Messaggio Commit (AUTOMATICO)
# ========================================
# SEMPRE automatico - nessuna richiesta
if ([string]::IsNullOrWhiteSpace($Messaggio)) {
    $commitMessage = "chore: salvataggio lavoro - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
} else {
    $commitMessage = $Messaggio
}

Write-ColorOutput "   Messaggio: $commitMessage" "Cyan"
Write-Host ""

# ========================================
# STEP 4: Pull (per evitare conflitti)
# ========================================
Write-ColorOutput "📥 STEP 4: Sincronizzazione con GitHub..." "Yellow"
git pull origin master 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Repository sincronizzato" "Green"
} else {
    Write-ColorOutput "⚠️  Possibili conflitti - verifica manualmente" "Yellow"
}
Write-Host ""

# ========================================
# STEP 5: Add e Commit
# ========================================
Write-ColorOutput "💾 STEP 5: Commit modifiche..." "Yellow"
git add -A
if ($LASTEXITCODE -eq 0) {
    git commit -m $commitMessage
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Commit completato" "Green"
    } else {
        Write-ColorOutput "❌ Errore durante commit" "Red"
        exit 1
    }
} else {
    Write-ColorOutput "❌ Errore durante git add" "Red"
    exit 1
}
Write-Host ""

# ========================================
# STEP 6: Push su GitHub
# ========================================
Write-ColorOutput "🚀 STEP 6: Push su GitHub..." "Yellow"
git push origin master
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Push completato" "Green"
    Write-ColorOutput "   Vercel aggiornerà automaticamente il sito" "Cyan"
} else {
    Write-ColorOutput "❌ Errore durante push" "Red"
    Write-ColorOutput "   Verifica le credenziali GitHub" "Yellow"
    exit 1
}
Write-Host ""

# ========================================
# RIEPILOGO FINALE
# ========================================
Write-ColorOutput "========================================" "Green"
Write-ColorOutput "  ✅ LAVORO SALVATO CON SUCCESSO" "Green"
Write-ColorOutput "========================================`n" "Green"

Write-ColorOutput "📌 Riepilogo:" "Cyan"
Write-ColorOutput "   • Modifiche committate" "White"
Write-ColorOutput "   • Push completato su GitHub" "White"
Write-ColorOutput "   • Vercel aggiornerà automaticamente" "White"
Write-Host ""

Write-ColorOutput "🔗 Verifica:" "Cyan"
Write-ColorOutput "   • GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro" "White"
Write-ColorOutput "   • Vercel: https://vercel.com" "White"
Write-Host ""



