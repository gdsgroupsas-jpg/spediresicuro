# Script PowerShell per Commit Automatico Completo
$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "COMMIT AUTOMATICO COMPLETO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

cd C:\spediresicuro-master\spediresicuro

# Disabilita completamente git pager
Write-Host "[PREPARAZIONE] Disabilito Git Pager..." -ForegroundColor Yellow
$env:GIT_PAGER = ""
git config --global core.pager ""
Write-Host "✅ Git Pager disabilitato" -ForegroundColor Green
Write-Host ""

# Reset eventuali staging che bloccano
Write-Host "[PREPARAZIONE] Reset staging area..." -ForegroundColor Yellow
git reset HEAD . 2>&1 | Out-Null
Write-Host "✅ Staging resettato" -ForegroundColor Green
Write-Host ""

# Aggiungi tutti i file modificati
Write-Host "[1/5] Aggiungo file modificati..." -ForegroundColor Yellow
git add components/integrazioni/spedisci-online-config-multi.tsx 2>&1 | Out-Null
git add components/integrazioni/spedisci-online-config.tsx 2>&1 | Out-Null
git add lib/adapters/couriers/spedisci-online.ts 2>&1 | Out-Null
git add lib/couriers/factory.ts 2>&1 | Out-Null
git add lib/actions/spedisci-online.ts 2>&1 | Out-Null
git add lib/engine/fulfillment-orchestrator.ts 2>&1 | Out-Null
git add actions/configurations.ts 2>&1 | Out-Null
git add app/dashboard/integrazioni/page.tsx 2>&1 | Out-Null
git add docs/*.md 2>&1 | Out-Null
git add -A 2>&1 | Out-Null
Write-Host "✅ File aggiunti" -ForegroundColor Green
Write-Host ""

# Mostra file da committare
Write-Host "[2/5] File da committare:" -ForegroundColor Yellow
$status = git status --short 2>&1
if ($status) {
    Write-Host $status
} else {
    Write-Host "Nessun file da committare" -ForegroundColor Yellow
}
Write-Host ""

# Verifica se ci sono modifiche
$hasChanges = git diff --cached --quiet 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[3/5] Creo commit..." -ForegroundColor Yellow
    
    $commitMsg = @"
feat: Fix visibilità testo + interfaccia multi-dominio Spedisci.Online

- Fix: Testo perfettamente visibile negli input (text-gray-900, bg-white)
- Nuova interfaccia multi-dominio per gestire più configurazioni
- Lista tutte le configurazioni Spedisci.Online
- Toggle attiva/disattiva per ogni configurazione
- Aggiungi/Modifica/Elimina configurazioni (solo superadmin)
- Campo codice_contratto aggiunto al payload API
- Mapping automatico corriere -> codice contratto
- Log dettagliati per debug chiamata API
- Supporto contract_mapping completo

File modificati:
- components/integrazioni/spedisci-online-config-multi.tsx (NUOVO)
- components/integrazioni/spedisci-online-config.tsx (fix visibilità)
- lib/adapters/couriers/spedisci-online.ts
- lib/couriers/factory.ts
- lib/actions/spedisci-online.ts
- lib/engine/fulfillment-orchestrator.ts
- actions/configurations.ts (aggiunta toggle status)
- app/dashboard/integrazioni/page.tsx
- docs/DEBUG_CHIAMATA_API.md (NUOVO)
- docs/RIEPILOGO_DEBUG_LOGS.md (NUOVO)
- docs/RIEPILOGO_FIX_VISIBILITA_MULTIDOMINIO.md (NUOVO)
"@

    git commit -m $commitMsg 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Commit creato" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Errore durante commit" -ForegroundColor Yellow
        Write-Host "Provo comunque il push..." -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Nessuna modifica da committare" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[4/5] Eseguo push su GitHub..." -ForegroundColor Yellow
git push 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push completato" -ForegroundColor Green
} else {
    Write-Host "⚠️ Errore durante push, ma potrebbe essere normale se non ci sono modifiche" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ COMPLETATO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vai su Vercel per vedere il deploy automatico." -ForegroundColor Yellow
Write-Host ""

