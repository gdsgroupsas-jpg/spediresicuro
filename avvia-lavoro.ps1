# ========================================
# 🚀 AVVIA LAVORO - Setup Automatico
# ========================================
# Script per preparare tutto quando riprendi a lavorare
# ========================================

# Colori output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Header
Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "  🚀 AVVIA LAVORO - Setup Automatico" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

# ========================================
# STEP 1: Sincronizza Repository
# ========================================
Write-ColorOutput "📥 STEP 1: Sincronizzazione repository..." "Yellow"
& "$PSScriptRoot\sync-automatico.ps1" -SoloPull -Verifica:$false
Write-Host ""

# ========================================
# STEP 2: Verifica Dipendenze
# ========================================
Write-ColorOutput "📦 STEP 2: Verifica dipendenze..." "Yellow"
if (-not (Test-Path "node_modules")) {
    Write-ColorOutput "⚠️  Dipendenze non installate" "Yellow"
    Write-ColorOutput "   Installo dipendenze..." "Cyan"
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Dipendenze installate" "Green"
    } else {
        Write-ColorOutput "❌ Errore durante installazione" "Red"
    }
} else {
    Write-ColorOutput "✅ Dipendenze già installate" "Green"
    Write-ColorOutput "   Verifico aggiornamenti..." "Cyan"
    npm install
}
Write-Host ""

# ========================================
# STEP 3: Verifica Configurazione
# ========================================
Write-ColorOutput "🔍 STEP 3: Verifica configurazione..." "Yellow"

# Verifica .env.local
if (Test-Path ".env.local") {
    Write-ColorOutput "✅ File .env.local presente" "Green"
} else {
    Write-ColorOutput "⚠️  File .env.local mancante" "Yellow"
    if (Test-Path ".env.example") {
        # AUTOMATICO: copia sempre da .env.example senza chiedere
        Copy-Item ".env.example" ".env.local"
        Write-ColorOutput "✅ File .env.local creato automaticamente" "Green"
        Write-ColorOutput "   ⚠️  IMPORTANTE: Configura le variabili in .env.local!" "Yellow"
    }
}

# Verifica connessione Supabase (opzionale)
Write-ColorOutput "   Verifico connessione Supabase..." "Cyan"
npm run verify:supabase 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Connessione Supabase OK" "Green"
} else {
    Write-ColorOutput "⚠️  Verifica Supabase fallita (controlla .env.local)" "Yellow"
}
Write-Host ""

# ========================================
# STEP 4: Riepilogo Stato
# ========================================
Write-ColorOutput "📊 STEP 4: Riepilogo stato progetto..." "Yellow"

# Verifica branch
$branch = git branch --show-current
Write-ColorOutput "   Branch corrente: $branch" "Cyan"

# Verifica modifiche
$status = git status --short
if ($status) {
    Write-ColorOutput "   ⚠️  Ci sono modifiche non committate" "Yellow"
} else {
    Write-ColorOutput "   ✅ Repository pulito" "Green"
}

Write-Host ""

# ========================================
# RIEPILOGO FINALE
# ========================================
Write-ColorOutput "========================================" "Green"
Write-ColorOutput "  ✅ SETUP COMPLETATO" "Green"
Write-ColorOutput "========================================`n" "Green"

Write-ColorOutput "🎯 Progetto pronto per lavorare!" "Cyan"
Write-Host ""

Write-ColorOutput "📌 Prossimi passi:" "Cyan"
Write-ColorOutput "   1. Avvia server sviluppo:" "White"
Write-ColorOutput "      npm run dev" "Yellow"
Write-ColorOutput "   2. Apri browser:" "White"
Write-ColorOutput "      http://localhost:3000" "Yellow"
Write-Host ""

Write-ColorOutput "💡 Comandi utili:" "Cyan"
Write-ColorOutput "   • .\sync-automatico.ps1        - Sincronizza con GitHub" "White"
Write-ColorOutput "   • .\sync-automatico.ps1 -AutoCommit  - Sync + commit automatico" "White"
Write-ColorOutput "   • npm run dev                  - Avvia sviluppo" "White"
Write-ColorOutput "   • npm run build                - Build produzione" "White"
Write-Host ""

Write-ColorOutput "📚 Documentazione:" "Cyan"
Write-ColorOutput "   • Leggi: RIEPILOGO_LAVORO_ATTUALE.md" "White"
Write-Host ""



