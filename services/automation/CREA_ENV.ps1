# Script per creare il file .env per automation-service
# Copia i valori dal tuo .env.local del progetto principale

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREAZIONE FILE .env PER AUTOMATION-SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envLocalPath = "..\\.env.local"
$envPath = ".env"

# Verifica se esiste .env.local nella root
if (Test-Path $envLocalPath) {
    Write-Host "✅ Trovato .env.local nella root del progetto" -ForegroundColor Green
    Write-Host ""
    
    # Leggi i valori da .env.local
    $envContent = Get-Content $envLocalPath -Raw
    
    # Estrai i valori necessari
    $supabaseUrl = if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL=(.+)") { $matches[1].Trim() } else { "" }
    $supabaseServiceKey = if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=(.+)") { $matches[1].Trim() } else { "" }
    $diagnosticsToken = if ($envContent -match "DIAGNOSTICS_TOKEN=(.+)") { $matches[1].Trim() } else { "d4t1_d14gn0st1c1_s3gr3t1_2025_x9z" }
    $automationToken = if ($envContent -match "AUTOMATION_SERVICE_TOKEN=(.+)") { $matches[1].Trim() } else { "" }
    $encryptionKey = if ($envContent -match "ENCRYPTION_KEY=(.+)") { $matches[1].Trim() } else { "" }
    
    Write-Host "Valori estratti da .env.local:" -ForegroundColor Yellow
    Write-Host "  SUPABASE_URL: $(if ($supabaseUrl) { '✅ Trovato' } else { '❌ Mancante' })" -ForegroundColor $(if ($supabaseUrl) { 'Green' } else { 'Red' })
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY: $(if ($supabaseServiceKey) { '✅ Trovato' } else { '❌ Mancante' })" -ForegroundColor $(if ($supabaseServiceKey) { 'Green' } else { 'Red' })
    Write-Host "  DIAGNOSTICS_TOKEN: $(if ($diagnosticsToken) { '✅ Trovato' } else { '❌ Mancante' })" -ForegroundColor $(if ($diagnosticsToken) { 'Green' } else { 'Red' })
    Write-Host "  AUTOMATION_SERVICE_TOKEN: $(if ($automationToken) { '✅ Trovato' } else { '❌ Mancante' })" -ForegroundColor $(if ($automationToken) { 'Green' } else { 'Red' })
    Write-Host "  ENCRYPTION_KEY: $(if ($encryptionKey) { '✅ Trovato' } else { '❌ Mancante' })" -ForegroundColor $(if ($encryptionKey) { 'Green' } else { 'Red' })
    Write-Host ""
    
    # Genera CRON_SECRET_TOKEN se non esiste
    if (-not $automationToken) {
        Write-Host "⚠️  AUTOMATION_SERVICE_TOKEN non trovato in .env.local" -ForegroundColor Yellow
        Write-Host "   Genera un token e aggiungilo a .env.local prima di continuare" -ForegroundColor Yellow
        Write-Host ""
    }
    
    $cronToken = if ($automationToken) { 
        # Genera un token diverso da AUTOMATION_SERVICE_TOKEN
        -join ((65..90) + (97..122) + (48..57) + (45, 95) | Get-Random -Count 40 | ForEach-Object {[char]$_})
    } else { 
        "" 
    }
    
    # Crea il contenuto del file .env
    $envFileContent = @"
# ============================================
# FILE .env - AUTOMATION-SERVICE
# ============================================
# Generato automaticamente da CREA_ENV.ps1
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
    
    # Scrivi il file .env
    $envFileContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
    
    Write-Host "✅ File .env creato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prossimi passi:" -ForegroundColor Cyan
    Write-Host "1. Riavvia il server automation-service (Ctrl+C e poi npm start)" -ForegroundColor Yellow
    Write-Host "2. I warning dovrebbero scomparire" -ForegroundColor Yellow
    Write-Host ""
    
} else {
    Write-Host "❌ File .env.local non trovato nella root del progetto" -ForegroundColor Red
    Write-Host ""
    Write-Host "Crea manualmente il file .env con questi valori:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SUPABASE_URL=https://pxd2.supabase.co" -ForegroundColor White
    Write-Host "SUPABASE_SERVICE_ROLE_KEY=la_tua_service_role_key" -ForegroundColor White
    Write-Host "DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z" -ForegroundColor White
    Write-Host "AUTOMATION_SERVICE_TOKEN=il_tuo_token" -ForegroundColor White
    Write-Host "CRON_SECRET_TOKEN=un_token_diverso" -ForegroundColor White
    Write-Host "ENCRYPTION_KEY=la_tua_chiave_64_caratteri" -ForegroundColor White
    Write-Host ""
}
