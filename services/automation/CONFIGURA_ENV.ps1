# Script per configurare il file .env per automation-service
# Legge i valori dal .env.local della root e crea il file .env

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAZIONE .env AUTOMATION-SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = Split-Path -Parent $PSScriptRoot
$envLocalPath = Join-Path $rootPath ".env.local"
$envPath = Join-Path $PSScriptRoot ".env"

# Verifica se esiste .env.local
if (-not (Test-Path $envLocalPath)) {
    Write-Host "❌ File .env.local non trovato in: $rootPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Crea prima il file .env.local nella root del progetto!" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Trovato .env.local" -ForegroundColor Green
Write-Host ""

# Leggi il contenuto
$envLocalContent = Get-Content $envLocalPath -Raw

# Funzione per estrarre valore da regex multilinea
function Get-EnvValue {
    param([string]$pattern, [string]$content, [string]$default = "")
    if ($content -match $pattern) {
        return $matches[1].Trim()
    }
    return $default
}

# Estrai i valori
$supabaseUrl = Get-EnvValue -pattern "(?m)^NEXT_PUBLIC_SUPABASE_URL=(.+)$" -content $envLocalContent
$supabaseServiceKey = Get-EnvValue -pattern "(?m)^SUPABASE_SERVICE_ROLE_KEY=(.+)$" -content $envLocalContent
$diagnosticsToken = Get-EnvValue -pattern "(?m)^DIAGNOSTICS_TOKEN=(.+)$" -content $envLocalContent -default "d4t1_d14gn0st1c1_s3gr3t1_2025_x9z"
$automationToken = Get-EnvValue -pattern "(?m)^AUTOMATION_SERVICE_TOKEN=(.+)$" -content $envLocalContent
$encryptionKey = Get-EnvValue -pattern "(?m)^ENCRYPTION_KEY=(.+)$" -content $envLocalContent

# Genera CRON_SECRET_TOKEN
$cronToken = -join ((65..90) + (97..122) + (48..57) + (45, 95) | Get-Random -Count 40 | ForEach-Object {[char]$_})

# Mostra i valori trovati
Write-Host "Valori estratti:" -ForegroundColor Yellow
Write-Host "  SUPABASE_URL: $(if ($supabaseUrl) { '✅' } else { '❌ MANCANTE' })" -ForegroundColor $(if ($supabaseUrl) { 'Green' } else { 'Red' })
Write-Host "  SUPABASE_SERVICE_ROLE_KEY: $(if ($supabaseServiceKey) { '✅' } else { '❌ MANCANTE' })" -ForegroundColor $(if ($supabaseServiceKey) { 'Green' } else { 'Red' })
Write-Host "  DIAGNOSTICS_TOKEN: ✅" -ForegroundColor Green
Write-Host "  AUTOMATION_SERVICE_TOKEN: $(if ($automationToken) { '✅' } else { '❌ MANCANTE' })" -ForegroundColor $(if ($automationToken) { 'Green' } else { 'Red' })
Write-Host "  ENCRYPTION_KEY: $(if ($encryptionKey) { '✅' } else { '❌ MANCANTE' })" -ForegroundColor $(if ($encryptionKey) { 'Green' } else { 'Red' })
Write-Host "  CRON_SECRET_TOKEN: ✅ (generato)" -ForegroundColor Green
Write-Host ""

# Verifica valori obbligatori
if (-not $supabaseUrl -or -not $supabaseServiceKey -or -not $automationToken -or -not $encryptionKey) {
    Write-Host "⚠️  ATTENZIONE: Alcuni valori obbligatori sono mancanti!" -ForegroundColor Yellow
    Write-Host "   Aggiungi i valori mancanti al file .env.local e riprova" -ForegroundColor Yellow
    Write-Host ""
}

# Crea il contenuto del file .env
$envFileContent = @"
# ============================================
# FILE .env - AUTOMATION-SERVICE
# ============================================
# Generato automaticamente da CONFIGURA_ENV.ps1
# NON committare questo file!

# ============================================
# SUPABASE - OBBLIGATORIO
# ============================================
SUPABASE_URL=$supabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceKey

# ============================================
# DIAGNOSTICS - OBBLIGATORIO
# ============================================
DIAGNOSTICS_TOKEN=$diagnosticsToken

# ============================================
# AUTOMATION SERVICE - OBBLIGATORIO
# ============================================
AUTOMATION_SERVICE_TOKEN=$automationToken

# ============================================
# CRON - OBBLIGATORIO
# ============================================
CRON_SECRET_TOKEN=$cronToken

# ============================================
# ENCRYPTION - OBBLIGATORIO
# ============================================
# DEVE ESSERE LA STESSA DEL PROGETTO NEXT.JS!
ENCRYPTION_KEY=$encryptionKey

# ============================================
# SERVER - OPZIONALE
# ============================================
PORT=3000
NODE_ENV=development
"@

# Scrivi il file
$envFileContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline

Write-Host "✅ File .env creato con successo!" -ForegroundColor Green
Write-Host "   Percorso: $envPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Prossimi passi:" -ForegroundColor Cyan
Write-Host "1. Riavvia il server automation-service (Ctrl+C e poi npm start)" -ForegroundColor Yellow
Write-Host "2. I warning dovrebbero scomparire" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Red
Write-Host "   - ENCRYPTION_KEY deve essere LO STESSO del .env.local" -ForegroundColor Yellow
Write-Host "   - AUTOMATION_SERVICE_TOKEN deve essere LO STESSO del .env.local" -ForegroundColor Yellow
Write-Host ""
