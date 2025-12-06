# ========================================
# 🔄 SYNC AUTOMATICO - SpedireSicuro.it
# ========================================
# Script intelligente per sincronizzazione automatica
# Gestisce: pull, verifica, commit, push
# ========================================

param(
    [switch]$AutoCommit = $true,   # DEFAULT: true - fa commit automatico senza chiedere
    [switch]$SoloPull = $false,    # Se true, fa solo pull (non commit/push)
    [switch]$Verifica = $true      # Se true, verifica configurazione
)

# Colori output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Header
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  🔄 SYNC AUTOMATICO PROGETTO" "Cyan"
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
    Write-ColorOutput "⚠️  Account Git non configurato correttamente" "Yellow"
    Write-ColorOutput "   Configuro account: gdsgroupsas-jpg" "Cyan"
    git config user.name "gdsgroupsas-jpg"
    Write-ColorOutput "✅ Account configurato" "Green"
} else {
    Write-ColorOutput "✅ Account Git OK: $gitUser" "Green"
}
Write-Host ""

# ========================================
# STEP 2: Pull da GitHub
# ========================================
Write-ColorOutput "📥 STEP 2: Sincronizzazione con GitHub..." "Yellow"
try {
    $pullOutput = git pull origin master 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Repository aggiornato" "Green"
        # Controlla se ci sono stati aggiornamenti
        if ($pullOutput -match "Already up to date") {
            Write-ColorOutput "   Nessun aggiornamento disponibile" "Cyan"
        } else {
            Write-ColorOutput "   ✅ Nuovi aggiornamenti scaricati" "Green"
        }
    } else {
        Write-ColorOutput "⚠️  Possibili conflitti o errori nel pull" "Yellow"
        Write-ColorOutput "   Controlla manualmente: git status" "Yellow"
    }
} catch {
    Write-ColorOutput "❌ Errore durante pull: $_" "Red"
}
Write-Host ""

# ========================================
# STEP 3: Verifica Stato Repository
# ========================================
Write-ColorOutput "📊 STEP 3: Verifica modifiche locali..." "Yellow"
$status = git status --short
$hasChanges = $status -ne $null -and $status.Count -gt 0

if ($hasChanges) {
    Write-ColorOutput "📝 File modificati trovati:" "Cyan"
    git status --short | ForEach-Object {
        Write-ColorOutput "   $_" "White"
    }
    Write-Host ""
    
    if (-not $SoloPull) {
        # ========================================
        # STEP 4: Commit Modifiche (AUTOMATICO)
        # ========================================
        # SEMPRE automatico - nessuna richiesta conferma
        $commitMessage = "chore: sincronizzazione automatica - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        Write-ColorOutput "💾 STEP 4: Commit automatico..." "Yellow"
        
        Write-ColorOutput "   Messaggio: $commitMessage" "Cyan"
        git add -A
        if ($LASTEXITCODE -eq 0) {
            git commit -m $commitMessage
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ Commit completato" "Green"
                
                # ========================================
                # STEP 5: Push su GitHub
                # ========================================
                Write-ColorOutput "🚀 STEP 5: Push su GitHub..." "Yellow"
                git push origin master
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorOutput "✅ Push completato" "Green"
                    Write-ColorOutput "   Vercel aggiornerà automaticamente il sito" "Cyan"
                } else {
                    Write-ColorOutput "❌ Errore durante push" "Red"
                    Write-ColorOutput "   Verifica le credenziali GitHub" "Yellow"
                }
            } else {
                Write-ColorOutput "❌ Errore durante commit" "Red"
                Write-ColorOutput "   Potrebbe essere necessario verificare lo stato" "Yellow"
            }
        } else {
            Write-ColorOutput "❌ Errore durante git add" "Red"
        }
    } else {
        Write-ColorOutput "⏭️  Solo pull richiesto - modifiche locali non committate" "Yellow"
    }
} else {
    Write-ColorOutput "✅ Nessuna modifica locale da committare" "Green"
}
Write-Host ""

# ========================================
# STEP 6: Verifica Configurazione (Opzionale)
# ========================================
if ($Verifica) {
    Write-ColorOutput "🔍 STEP 6: Verifica configurazione..." "Yellow"
    
    # Verifica file .env.local
    if (Test-Path ".env.local") {
        Write-ColorOutput "✅ File .env.local presente" "Green"
    } else {
        Write-ColorOutput "⚠️  File .env.local mancante" "Yellow"
        Write-ColorOutput "   Crea da .env.example se necessario" "Cyan"
    }
    
    # Verifica node_modules
    if (Test-Path "node_modules") {
        Write-ColorOutput "✅ Dipendenze installate" "Green"
    } else {
        Write-ColorOutput "⚠️  Dipendenze non installate" "Yellow"
        Write-ColorOutput "   Esegui: npm install" "Cyan"
    }
    
    Write-Host ""
}

# ========================================
# RIEPILOGO FINALE
# ========================================
Write-ColorOutput "========================================" "Green"
Write-ColorOutput "  ✅ SINCRONIZZAZIONE COMPLETATA" "Green"
Write-ColorOutput "========================================`n" "Green"

Write-ColorOutput "📌 Riepilogo:" "Cyan"
Write-ColorOutput "   • Repository sincronizzato con GitHub" "White"
if ($hasChanges -and -not $SoloPull) {
    Write-ColorOutput "   • Modifiche committate e inviate" "White"
}
Write-ColorOutput "   • Vercel aggiornerà automaticamente" "White"
Write-Host ""

Write-ColorOutput "🔗 Link utili:" "Cyan"
Write-ColorOutput "   • GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro" "White"
Write-ColorOutput "   • Vercel: https://vercel.com" "White"
Write-ColorOutput "   • Live: https://spediresicuro.vercel.app" "White"
Write-Host ""

Write-ColorOutput "💡 Prossimi comandi utili:" "Cyan"
Write-ColorOutput "   • npm run dev          - Avvia server sviluppo" "White"
Write-ColorOutput "   • npm run verify:supabase - Verifica database" "White"
Write-ColorOutput "   • git status          - Vedi stato repository" "White"
Write-Host ""



