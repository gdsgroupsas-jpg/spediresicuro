# ============================================
# Script Automatico - Recupera Variabili da Vercel
# ============================================
# 
# Questo script usa Vercel CLI per scaricare
# automaticamente tutte le variabili d'ambiente
#
# PREREQUISITI:
# 1. Vercel CLI installato: npm install -g vercel
# 2. Autenticato con Vercel: vercel login
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RECUPERO AUTOMATICO VARIABILI DA VERCEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che siamo nella cartella giusta
$currentDir = Get-Location
if (-not (Test-Path "package.json")) {
    Write-Host "ERRORE: Esegui questo script dalla root del progetto!" -ForegroundColor Red
    Write-Host "   Cartella attuale: $currentDir" -ForegroundColor Yellow
    Write-Host "   Dovresti essere in: C:\spediresicuro-master\spediresicuro" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "OK: Cartella corretta rilevata" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 1: Verifica Vercel CLI
# ============================================

Write-Host "Verificando Vercel CLI..." -ForegroundColor Yellow

$vercelInstalled = $false
try {
    $vercelVersion = vercel --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Vercel CLI installato: $vercelVersion" -ForegroundColor Green
        $vercelInstalled = $true
    }
} catch {
    $vercelInstalled = $false
}

if (-not $vercelInstalled) {
    Write-Host "   ERRORE: Vercel CLI non trovato!" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALLAZIONE VERCEL CLI:" -ForegroundColor Yellow
    Write-Host "   1. Esegui: npm install -g vercel" -ForegroundColor White
    Write-Host "   2. Poi esegui: vercel login" -ForegroundColor White
    Write-Host "   3. Riavvia questo script" -ForegroundColor White
    Write-Host ""
    
    $install = Read-Host "   Vuoi installare Vercel CLI ora? (s/n)"
    if ($install -eq "s") {
        Write-Host ""
        Write-Host "   Installazione in corso..." -ForegroundColor Yellow
        npm install -g vercel
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK: Vercel CLI installato!" -ForegroundColor Green
            Write-Host ""
            Write-Host "   Ora devi autenticarti:" -ForegroundColor Yellow
            Write-Host "   Esegui: vercel login" -ForegroundColor White
            Write-Host "   Poi riavvia questo script" -ForegroundColor White
            Write-Host ""
            exit 0
        } else {
            Write-Host "   ERRORE: Errore durante l'installazione" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "   ATTENZIONE: Devi installare Vercel CLI per continuare" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================
# STEP 2: Verifica Autenticazione
# ============================================

Write-Host "Verificando autenticazione Vercel..." -ForegroundColor Yellow

try {
    $whoami = vercel whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Autenticato come: $whoami" -ForegroundColor Green
    } else {
        Write-Host "   ERRORE: Non autenticato!" -ForegroundColor Red
        Write-Host ""
        Write-Host "AUTENTICAZIONE RICHIESTA:" -ForegroundColor Yellow
        Write-Host "   Esegui: vercel login" -ForegroundColor White
        Write-Host "   Poi riavvia questo script" -ForegroundColor White
        Write-Host ""
        
        $login = Read-Host "   Vuoi autenticarti ora? (s/n)"
        if ($login -eq "s") {
            Write-Host ""
            Write-Host "   Apertura browser per login..." -ForegroundColor Yellow
            vercel login
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK: Autenticazione completata!" -ForegroundColor Green
            } else {
                Write-Host "   ERRORE: Errore durante l'autenticazione" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host ""
            Write-Host "   ATTENZIONE: Devi autenticarti per continuare" -ForegroundColor Yellow
            exit 1
        }
    }
} catch {
    Write-Host "   ERRORE: Errore durante la verifica" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# STEP 3: Verifica/Collega Progetto a Vercel
# ============================================

Write-Host "Verificando collegamento progetto a Vercel..." -ForegroundColor Yellow

# Verifica se il progetto è già linkato
$isLinked = $false
try {
    $linkCheck = vercel ls 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        # Prova a fare un pull per vedere se è linkato
        $testPull = vercel env pull .env.test 2>&1 | Out-String
        if ($testPull -notmatch "isn't linked") {
            $isLinked = $true
        }
        # Rimuovi il file di test se esiste
        if (Test-Path ".env.test") {
            Remove-Item ".env.test" -ErrorAction SilentlyContinue
        }
    }
} catch {
    $isLinked = $false
}

# Se non è linkato, esegui vercel link
if (-not $isLinked) {
    Write-Host "   ATTENZIONE: Progetto non collegato a Vercel" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Eseguendo vercel link..." -ForegroundColor Cyan
    Write-Host "   Ti verrà chiesto di:" -ForegroundColor Gray
    Write-Host "   1. Selezionare il progetto 'spediresicuro'" -ForegroundColor Gray
    Write-Host "   2. Confermare le impostazioni" -ForegroundColor Gray
    Write-Host ""
    
    try {
        vercel link
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK: Progetto collegato con successo!" -ForegroundColor Green
        } else {
            Write-Host "   ERRORE: Errore durante il collegamento" -ForegroundColor Red
            Write-Host "   Esegui manualmente: vercel link" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "   ERRORE: Errore durante il collegamento: $_" -ForegroundColor Red
        Write-Host "   Esegui manualmente: vercel link" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   OK: Progetto già collegato a Vercel" -ForegroundColor Green
}

Write-Host ""

# ============================================
# STEP 4: Recupera Variabili da Vercel
# ============================================

Write-Host "Scaricando variabili d'ambiente da Vercel..." -ForegroundColor Yellow
Write-Host ""

# Verifica se esiste già un .env.local
$backupCreated = $false
if (Test-Path ".env.local") {
    $backupName = ".env.local.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item ".env.local" $backupName
    Write-Host "   Backup creato: $backupName" -ForegroundColor Cyan
    $backupCreated = $true
}

# Scarica le variabili da Vercel
# vercel env pull crea automaticamente .env.local
Write-Host "   Esecuzione: vercel env pull .env.local" -ForegroundColor Gray
Write-Host ""

try {
    vercel env pull .env.local
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Variabili scaricate con successo!" -ForegroundColor Green
    } else {
        Write-Host "   ERRORE: Errore durante il download" -ForegroundColor Red
        Write-Host "   Verifica di essere nel progetto corretto" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ERRORE: Errore durante il download: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# STEP 5: Modifica NEXTAUTH_URL per locale
# ============================================

Write-Host "Modificando NEXTAUTH_URL per sviluppo locale..." -ForegroundColor Yellow

$envContent = Get-Content ".env.local" -Raw
$envContent = $envContent -replace "NEXTAUTH_URL=https://.*", "NEXTAUTH_URL=http://localhost:3000"
$envContent = $envContent -replace "NEXTAUTH_URL=http://.*\.vercel\.app", "NEXTAUTH_URL=http://localhost:3000"

Set-Content -Path ".env.local" -Value $envContent -NoNewline

Write-Host "   OK: NEXTAUTH_URL impostato a http://localhost:3000" -ForegroundColor Green
Write-Host ""

# ============================================
# STEP 6: Crea .env per Automation Service
# ============================================

Write-Host "Creando file automation-service/.env..." -ForegroundColor Yellow

if (-not (Test-Path "automation-service")) {
    Write-Host "   ATTENZIONE: Cartella automation-service non trovata!" -ForegroundColor Yellow
    Write-Host "   Saltato automation-service/.env" -ForegroundColor Gray
} else {
    # Leggi le variabili dal .env.local
    $envVars = @{}
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
    
    # Crea il contenuto per automation-service
    $automationEnvContent = @"
# ============================================
# FILE .env per Automation Service
# ============================================
# Generato automaticamente da RECUPERA_VARIABILI_VERCEL_AUTO.ps1
# 

# ============================================
# SUPABASE - Database
# ============================================
SUPABASE_URL=$($envVars['NEXT_PUBLIC_SUPABASE_URL'])
SUPABASE_SERVICE_ROLE_KEY=$($envVars['SUPABASE_SERVICE_ROLE_KEY'])

# ============================================
# DIAGNOSTICS
# ============================================
DIAGNOSTICS_TOKEN=$($envVars['DIAGNOSTICS_TOKEN'])

# ============================================
# AUTOMATION SERVICE
# ============================================
AUTOMATION_SERVICE_TOKEN=$($envVars['AUTOMATION_SERVICE_TOKEN'])

# ============================================
# ENCRYPTION
# ============================================
ENCRYPTION_KEY=$($envVars['ENCRYPTION_KEY'])

# ============================================
# SERVER
# ============================================
PORT=3001
NODE_ENV=development
"@
    
    # Verifica se esiste già
    if (Test-Path "automation-service\.env") {
        $backupName = "automation-service\.env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item "automation-service\.env" $backupName
        Write-Host "   Backup creato: $backupName" -ForegroundColor Cyan
    }
    
    $automationEnvContent | Out-File -FilePath "automation-service\.env" -Encoding UTF8
    Write-Host "   OK: File automation-service/.env creato" -ForegroundColor Green
}

Write-Host ""

# ============================================
# STEP 7: Verifica Finale
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPLETATO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "File creati:" -ForegroundColor Yellow
Write-Host "   - .env.local (Next.js)" -ForegroundColor White
if (Test-Path "automation-service\.env") {
    Write-Host "   - automation-service/.env" -ForegroundColor White
}
if ($backupCreated) {
    Write-Host ""
    Write-Host "Backup salvati (se esistevano file precedenti)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Verifica la configurazione:" -ForegroundColor Yellow
Write-Host "   npm run verify:config" -ForegroundColor White
Write-Host ""
Write-Host "Avvia il server:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "   - NEXTAUTH_URL è stato impostato a http://localhost:3000" -ForegroundColor Yellow
Write-Host "   - Verifica che ENCRYPTION_KEY sia presente in entrambi i file" -ForegroundColor Yellow
Write-Host "   - Verifica che AUTOMATION_SERVICE_TOKEN sia presente in entrambi i file" -ForegroundColor Yellow
Write-Host ""

