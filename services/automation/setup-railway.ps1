# ============================================
# Script Setup Automatico Railway
# ============================================
# Questo script configura automaticamente Railway
# per il servizio automation
#
# REQUISITI:
# 1. Railway CLI installato: npm install -g @railway/cli
# 2. Loggato in Railway: railway login
# ============================================

Write-Host "🚀 Setup Automatico Railway - Automation Service" -ForegroundColor Cyan
Write-Host ""

# Verifica Railway CLI
Write-Host "📋 Verifica Railway CLI..." -ForegroundColor Yellow
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI trovato: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installa Railway CLI con:" -ForegroundColor Yellow
    Write-Host "  npm install -g @railway/cli" -ForegroundColor White
    Write-Host ""
    Write-Host "Poi esegui:" -ForegroundColor Yellow
    Write-Host "  railway login" -ForegroundColor White
    exit 1
}

# Verifica login
Write-Host ""
Write-Host "📋 Verifica login Railway..." -ForegroundColor Yellow
try {
    railway whoami | Out-Null
    Write-Host "✅ Loggato in Railway" -ForegroundColor Green
} catch {
    Write-Host "❌ Non loggato in Railway!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Esegui:" -ForegroundColor Yellow
    Write-Host "  railway login" -ForegroundColor White
    exit 1
}

# Leggi variabili d'ambiente da .env.local
Write-Host ""
Write-Host "📋 Leggo variabili d'ambiente da .env.local..." -ForegroundColor Yellow

$envFile = Join-Path $PSScriptRoot "..\env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "⚠️ File .env.local non trovato!" -ForegroundColor Yellow
    Write-Host "Cercando in: $envFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Inserisci manualmente le variabili d'ambiente:" -ForegroundColor Yellow
    Write-Host ""
    
    $supabaseUrl = Read-Host "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)"
    $supabaseServiceKey = Read-Host "SUPABASE_SERVICE_ROLE_KEY"
    $encryptionKey = Read-Host "ENCRYPTION_KEY"
} else {
    Write-Host "✅ File .env.local trovato" -ForegroundColor Green
    
    # Leggi variabili
    $envContent = Get-Content $envFile
    $supabaseUrl = ($envContent | Where-Object { $_ -match "^NEXT_PUBLIC_SUPABASE_URL=" }) -replace "NEXT_PUBLIC_SUPABASE_URL=", "" -replace '"', ''
    if (-not $supabaseUrl) {
        $supabaseUrl = ($envContent | Where-Object { $_ -match "^SUPABASE_URL=" }) -replace "SUPABASE_URL=", "" -replace '"', ''
    }
    $supabaseServiceKey = ($envContent | Where-Object { $_ -match "^SUPABASE_SERVICE_ROLE_KEY=" }) -replace "SUPABASE_SERVICE_ROLE_KEY=", "" -replace '"', ''
    $encryptionKey = ($envContent | Where-Object { $_ -match "^ENCRYPTION_KEY=" }) -replace "ENCRYPTION_KEY=", "" -replace '"', ''
    
    if (-not $supabaseUrl) {
        $supabaseUrl = Read-Host "SUPABASE_URL non trovato. Inserisci manualmente"
    }
    if (-not $supabaseServiceKey) {
        $supabaseServiceKey = Read-Host "SUPABASE_SERVICE_ROLE_KEY non trovato. Inserisci manualmente"
    }
    if (-not $encryptionKey) {
        $encryptionKey = Read-Host "ENCRYPTION_KEY non trovato. Inserisci manualmente"
    }
}

# Verifica variabili
if (-not $supabaseUrl -or -not $supabaseServiceKey -or -not $encryptionKey) {
    Write-Host ""
    Write-Host "❌ Variabili d'ambiente mancanti!" -ForegroundColor Red
    Write-Host "Assicurati di avere:" -ForegroundColor Yellow
    Write-Host "  - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)" -ForegroundColor White
    Write-Host "  - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
    Write-Host "  - ENCRYPTION_KEY" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ Variabili d'ambiente lette" -ForegroundColor Green

# Seleziona progetto Railway
Write-Host ""
Write-Host "📋 Seleziona progetto Railway..." -ForegroundColor Yellow
Write-Host "Se il progetto non esiste, verrà creato automaticamente" -ForegroundColor Gray
Write-Host ""

# Lista progetti esistenti
Write-Host "Progetti disponibili:" -ForegroundColor Cyan
railway list 2>&1 | Out-String | Write-Host

$projectName = Read-Host "Nome progetto Railway (o premi Enter per 'spediresicuro')"
if ([string]::IsNullOrWhiteSpace($projectName)) {
    $projectName = "spediresicuro"
}

# Crea o seleziona progetto
Write-Host ""
Write-Host "📋 Configurazione progetto: $projectName" -ForegroundColor Yellow
try {
    railway link --project $projectName 2>&1 | Out-Null
    Write-Host "✅ Progetto selezionato: $projectName" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Progetto non trovato, creazione..." -ForegroundColor Yellow
    railway init --name $projectName 2>&1 | Out-Null
    Write-Host "✅ Progetto creato: $projectName" -ForegroundColor Green
}

# Crea servizio automation (se non esiste)
Write-Host ""
Write-Host "📋 Configurazione servizio automation..." -ForegroundColor Yellow

$serviceName = "automation-service"
Write-Host "Nome servizio: $serviceName" -ForegroundColor Cyan

# Verifica se servizio esiste già
$services = railway service list 2>&1 | Out-String
if ($services -match $serviceName) {
    Write-Host "✅ Servizio $serviceName già esistente" -ForegroundColor Green
    railway service use $serviceName 2>&1 | Out-Null
} else {
    Write-Host "📦 Creazione nuovo servizio..." -ForegroundColor Yellow
    railway service create $serviceName 2>&1 | Out-Null
    railway service use $serviceName 2>&1 | Out-Null
    Write-Host "✅ Servizio creato: $serviceName" -ForegroundColor Green
}

# Configura variabili d'ambiente
Write-Host ""
Write-Host "📋 Configurazione variabili d'ambiente..." -ForegroundColor Yellow

Write-Host "  → SUPABASE_URL" -ForegroundColor Gray
railway variables set "SUPABASE_URL=$supabaseUrl" 2>&1 | Out-Null

Write-Host "  → SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Gray
railway variables set "SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKey" 2>&1 | Out-Null

Write-Host "  → ENCRYPTION_KEY" -ForegroundColor Gray
railway variables set "ENCRYPTION_KEY=$encryptionKey" 2>&1 | Out-Null

Write-Host "  → NODE_ENV" -ForegroundColor Gray
railway variables set "NODE_ENV=production" 2>&1 | Out-Null

Write-Host "✅ Variabili d'ambiente configurate" -ForegroundColor Green

# Configura root directory (se supportato)
Write-Host ""
Write-Host "📋 Configurazione root directory..." -ForegroundColor Yellow
Write-Host "⚠️ Root directory deve essere configurato manualmente su Railway Dashboard" -ForegroundColor Yellow
Write-Host "   Vai su: Settings → Root Directory → Imposta: automation-service" -ForegroundColor White

# Genera domain pubblico
Write-Host ""
Write-Host "📋 Generazione domain pubblico..." -ForegroundColor Yellow
try {
    railway domain 2>&1 | Out-String | Write-Host
    Write-Host "✅ Domain configurato" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Domain non generato automaticamente" -ForegroundColor Yellow
    Write-Host "   Genera manualmente su Railway Dashboard: Settings → Networking → Generate Domain" -ForegroundColor White
}

# Deploy
Write-Host ""
Write-Host "📋 Avvio deploy..." -ForegroundColor Yellow
Write-Host "⚠️ Assicurati di essere nella root del progetto (non in automation-service)" -ForegroundColor Yellow
Write-Host ""

$deploy = Read-Host "Vuoi fare deploy ora? (s/n)"
if ($deploy -eq "s" -or $deploy -eq "S" -or $deploy -eq "y" -or $deploy -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Avvio deploy..." -ForegroundColor Cyan
    
    # Torna alla root del progetto
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Push-Location $projectRoot
    
    try {
        railway up --service $serviceName 2>&1 | Write-Host
        Write-Host ""
        Write-Host "✅ Deploy completato!" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "❌ Errore durante deploy" -ForegroundColor Red
        Write-Host "Verifica logs su Railway Dashboard" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
} else {
    Write-Host ""
    Write-Host "⏭️ Deploy saltato" -ForegroundColor Yellow
    Write-Host "Esegui manualmente con: railway up" -ForegroundColor White
}

# Riepilogo
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETATO!" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Prossimi passi:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Vai su Railway Dashboard" -ForegroundColor White
Write-Host "2. Settings → Root Directory → Imposta: automation-service" -ForegroundColor White
Write-Host "3. Settings → Networking → Generate Domain" -ForegroundColor White
Write-Host "4. Copia URL domain e aggiungi a Vercel:" -ForegroundColor White
Write-Host "   AUTOMATION_SERVICE_URL=https://tuo-url-railway.app" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test health check:" -ForegroundColor White
Write-Host "   https://tuo-url-railway.app/health" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentazione:" -ForegroundColor Yellow
Write-Host "   - GUIDA_SETUP_RAILWAY.md" -ForegroundColor White
Write-Host "   - RIEPILOGO_SETUP_RAILWAY.md" -ForegroundColor White
Write-Host ""

