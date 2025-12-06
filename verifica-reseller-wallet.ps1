# Script PowerShell per Verifica Sistema Reseller e Wallet
# Esegue lo script TypeScript di verifica completa

Write-Host ""
Write-Host "🔍 VERIFICA SISTEMA RESELLER E WALLET" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che Node.js sia installato
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js trovato: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non trovato. Installa Node.js per continuare." -ForegroundColor Red
    exit 1
}

# Verifica che npm sia installato
try {
    $npmVersion = npm --version
    Write-Host "✅ npm trovato: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm non trovato. Installa npm per continuare." -ForegroundColor Red
    exit 1
}

# Verifica che le dipendenze siano installate
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules non trovato. Installo le dipendenze..." -ForegroundColor Yellow
    npm install
}

# Verifica variabili d'ambiente Supabase
Write-Host ""
Write-Host "📋 Verifica Variabili d'Ambiente..." -ForegroundColor Cyan

$envFile = ".env.local"
if (Test-Path $envFile) {
    Write-Host "✅ File .env.local trovato" -ForegroundColor Green
    
    $envContent = Get-Content $envFile -Raw
    
    $requiredVars = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=") {
            Write-Host "  ✅ $var configurato" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var MANCANTE" -ForegroundColor Red
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  ATTENZIONE: Alcune variabili d'ambiente mancano!" -ForegroundColor Yellow
        Write-Host "   Aggiungi le seguenti variabili in .env.local:" -ForegroundColor Yellow
        foreach ($var in $missingVars) {
            Write-Host "   - $var" -ForegroundColor Yellow
        }
        Write-Host ""
        $continue = Read-Host "Vuoi continuare comunque? (s/n)"
        if ($continue -ne "s" -and $continue -ne "S") {
            exit 1
        }
    }
} else {
    Write-Host "⚠️  File .env.local non trovato" -ForegroundColor Yellow
    Write-Host "   Crea .env.local con le variabili Supabase necessarie" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Vuoi continuare comunque? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        exit 1
    }
}

# Esegui lo script di verifica
Write-Host ""
Write-Host "🚀 Eseguo verifica completa..." -ForegroundColor Cyan
Write-Host ""

try {
    npm run verify:reseller-wallet
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Verifica completata con successo!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Verifica completata con errori. Controlla l'output sopra." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "❌ Errore durante l'esecuzione:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✨ Fine verifica" -ForegroundColor Cyan
Write-Host ""
