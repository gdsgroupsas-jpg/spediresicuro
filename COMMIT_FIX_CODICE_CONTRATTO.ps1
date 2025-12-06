# PowerShell script per commit e push
$ErrorActionPreference = "Stop"

cd C:\spediresicuro-master\spediresicuro

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "COMMIT: Fix Codice Contratto" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Disabilita pager git
$env:GIT_PAGER = ""
git config --global core.pager ""

Write-Host "[1/4] Aggiungo file modificati..." -ForegroundColor Yellow
git add components/integrazioni/spedisci-online-config.tsx 2>&1 | Out-Null
git add lib/adapters/couriers/spedisci-online.ts 2>&1 | Out-Null
git add lib/couriers/factory.ts 2>&1 | Out-Null
git add lib/actions/spedisci-online.ts 2>&1 | Out-Null
git add lib/engine/fulfillment-orchestrator.ts 2>&1 | Out-Null
git add app/dashboard/integrazioni/page.tsx 2>&1 | Out-Null
git add docs/*.md 2>&1 | Out-Null
git add -A 2>&1 | Out-Null
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Verifico file..." -ForegroundColor Yellow
$status = git status --short 2>&1
Write-Host $status
Write-Host ""

Write-Host "[3/4] Creo commit..." -ForegroundColor Yellow
$commitMsg = @"
feat: Sistema completo codice contratto Spedisci.Online + interfaccia migliorata

- Nuova interfaccia tabellare chiara per configurare contratti Spedisci.Online
- Caratteri leggibili (font-size 15px) e form semplice
- Campo codice_contratto aggiunto al payload API
- Mapping automatico corriere -> codice contratto
- Supporto contract_mapping completo in adapter
- Orchestrator passa corriere ai dati spedizione
- Integrata nuova interfaccia nella pagina integrazioni

File modificati:
- components/integrazioni/spedisci-online-config.tsx (NUOVO)
- lib/adapters/couriers/spedisci-online.ts
- lib/couriers/factory.ts
- lib/actions/spedisci-online.ts
- lib/engine/fulfillment-orchestrator.ts
- app/dashboard/integrazioni/page.tsx
- docs/RIEPILOGO_IMPLEMENTAZIONE_CODICE_CONTRATTO.md (NUOVO)
"@

git commit -m $commitMsg 2>&1 | Out-Null
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[4/4] Eseguo push..." -ForegroundColor Yellow
git push 2>&1 | Out-Null
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "COMPLETATO!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vai su Vercel per vedere il deploy automatico." -ForegroundColor Yellow









