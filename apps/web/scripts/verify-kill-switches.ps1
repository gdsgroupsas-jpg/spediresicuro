# ============================================
# VERIFY KILL-SWITCHES - SpedireSicuro
# Script PowerShell per verificare env vars
# ============================================
#
# SCOPO: Verificare che i kill-switches siano configurati
#        correttamente in locale e produzione.
#
# COME ESEGUIRE:
#   .\scripts\verify-kill-switches.ps1
#
# ============================================

Write-Host ""
Write-Host "🔍 ============================================" -ForegroundColor Cyan
Write-Host "   VERIFY KILL-SWITCHES - SpedireSicuro" -ForegroundColor Cyan
Write-Host "   ============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 1: VERIFICA FILE .env.local
# ============================================
Write-Host "📋 CHECK 1: Verifica .env.local" -ForegroundColor Yellow
Write-Host ""

$envLocalPath = ".env.local"
$envPath = ".env"

if (Test-Path $envLocalPath) {
    Write-Host "  ✅ File .env.local trovato" -ForegroundColor Green
    Write-Host ""
    
    # Cerca ALLOW_SUPERADMIN_WALLET_BYPASS
    $walletBypass = Get-Content $envLocalPath | Select-String "ALLOW_SUPERADMIN_WALLET_BYPASS"
    if ($walletBypass) {
        Write-Host "  📍 ALLOW_SUPERADMIN_WALLET_BYPASS:" -ForegroundColor White
        Write-Host "     $walletBypass" -ForegroundColor Gray
        
        if ($walletBypass -match "=\s*true") {
            Write-Host "     ⚠️ ATTENZIONE: Impostato a TRUE! Dovrebbe essere FALSE in produzione!" -ForegroundColor Red
        } elseif ($walletBypass -match "=\s*false") {
            Write-Host "     ✅ Corretto: false (fail-closed)" -ForegroundColor Green
        }
    } else {
        Write-Host "  📍 ALLOW_SUPERADMIN_WALLET_BYPASS: NON TROVATO" -ForegroundColor Yellow
        Write-Host "     ℹ️  Se non definito, default = false (sicuro)" -ForegroundColor Gray
    }
    
    Write-Host ""
    
    # Cerca ENABLE_OCR_IMAGES
    $ocrEnabled = Get-Content $envLocalPath | Select-String "ENABLE_OCR_IMAGES"
    if ($ocrEnabled) {
        Write-Host "  📍 ENABLE_OCR_IMAGES:" -ForegroundColor White
        Write-Host "     $ocrEnabled" -ForegroundColor Gray
        
        if ($ocrEnabled -match "=\s*true") {
            Write-Host "     ✅ Corretto: true (OCR abilitato)" -ForegroundColor Green
        } elseif ($ocrEnabled -match "=\s*false") {
            Write-Host "     ⚠️ OCR disabilitato" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  📍 ENABLE_OCR_IMAGES: NON TROVATO" -ForegroundColor Yellow
        Write-Host "     ℹ️  Se non definito, default = false (OCR disabilitato)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️ File .env.local NON trovato" -ForegroundColor Yellow
    Write-Host "     Verifica se esiste .env o .env.production" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# STEP 2: VERIFICA .env (se esiste)
# ============================================
if (Test-Path $envPath) {
    Write-Host "📋 CHECK 2: Verifica .env" -ForegroundColor Yellow
    Write-Host ""
    
    $walletBypassEnv = Get-Content $envPath | Select-String "ALLOW_SUPERADMIN_WALLET_BYPASS"
    $ocrEnabledEnv = Get-Content $envPath | Select-String "ENABLE_OCR_IMAGES"
    
    if ($walletBypassEnv) {
        Write-Host "  📍 ALLOW_SUPERADMIN_WALLET_BYPASS: $walletBypassEnv" -ForegroundColor Gray
    }
    if ($ocrEnabledEnv) {
        Write-Host "  📍 ENABLE_OCR_IMAGES: $ocrEnabledEnv" -ForegroundColor Gray
    }
    if (-not $walletBypassEnv -and -not $ocrEnabledEnv) {
        Write-Host "  ℹ️  Nessun kill-switch trovato in .env" -ForegroundColor Gray
    }
}

Write-Host ""

# ============================================
# STEP 3: VERIFICA VERCEL (se CLI disponibile)
# ============================================
Write-Host "📋 CHECK 3: Verifica Vercel (se CLI disponibile)" -ForegroundColor Yellow
Write-Host ""

$vercelCli = Get-Command vercel -ErrorAction SilentlyContinue
if ($vercelCli) {
    Write-Host "  ✅ Vercel CLI trovato" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Esegui manualmente per vedere le env vars:" -ForegroundColor White
    Write-Host "     vercel env ls" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Oppure vai su:" -ForegroundColor White
    Write-Host "     https://vercel.com/[tuo-progetto]/settings/environment-variables" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️ Vercel CLI non installato" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Per verificare su Vercel, vai su:" -ForegroundColor White
    Write-Host "     https://vercel.com/[tuo-progetto]/settings/environment-variables" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Verifica che:" -ForegroundColor White
    Write-Host "     ALLOW_SUPERADMIN_WALLET_BYPASS = false" -ForegroundColor Green
    Write-Host "     ENABLE_OCR_IMAGES = true" -ForegroundColor Green
}

Write-Host ""

# ============================================
# STEP 4: RIEPILOGO
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 RIEPILOGO CONFIGURAZIONE RICHIESTA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Kill-Switch                          | Valore Richiesto | Effetto" -ForegroundColor White
Write-Host "  -------------------------------------|------------------|------------------" -ForegroundColor Gray
Write-Host "  ALLOW_SUPERADMIN_WALLET_BYPASS       | false            | Blocca bypass" -ForegroundColor Green
Write-Host "  ENABLE_OCR_IMAGES                    | true             | Abilita OCR" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 5: SUGGERIMENTI
# ============================================
Write-Host "📝 SUGGERIMENTI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Se i valori non sono configurati, aggiungi a .env.local:" -ForegroundColor White
Write-Host ""
Write-Host "     ALLOW_SUPERADMIN_WALLET_BYPASS=false" -ForegroundColor Cyan
Write-Host "     ENABLE_OCR_IMAGES=true" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Per produzione (Vercel), imposta nella dashboard:" -ForegroundColor White
Write-Host "     https://vercel.com/[tuo-progetto]/settings/environment-variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VERIFICA COMPLETATA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
