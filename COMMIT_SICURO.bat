@echo off
echo ============================================
echo COMMIT E PUSH SICURO - Verifica Dati Sensibili
echo ============================================
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo [VERIFICA] Controllo dati sensibili...
git diff --cached | findstr /i "api_key password secret token" >nul
if %errorlevel% == 0 (
    echo ⚠️ ATTENZIONE: Potrebbero esserci dati sensibili!
    echo Verifica manualmente prima di continuare.
    pause
    exit /b 1
)

echo ✅ Nessun dato sensibile trovato nei file staged
echo.

echo [1/4] Aggiungo SOLO file di codice (no .env, no secrets)...
git add components/integrazioni/spedisci-online-config.tsx
git add lib/adapters/couriers/spedisci-online.ts
git add lib/couriers/factory.ts
git add lib/actions/spedisci-online.ts
git add lib/engine/fulfillment-orchestrator.ts
git add app/dashboard/integrazioni/page.tsx
git add docs/*.md
echo ✅ File aggiunti
echo.

echo [2/4] Verifico file da committare...
git status --short
echo.

echo [3/4] Creo commit...
git commit -m "feat: Sistema codice contratto Spedisci.Online + log debug dettagliati

- Nuova interfaccia tabellare per configurare contratti
- Campo codice_contratto nel payload API
- Mapping automatico corriere -> codice contratto
- Log dettagliati per debug chiamata API
- Supporto contract_mapping completo

File modificati:
- components/integrazioni/spedisci-online-config.tsx (NUOVO)
- lib/adapters/couriers/spedisci-online.ts
- lib/couriers/factory.ts
- lib/actions/spedisci-online.ts
- lib/engine/fulfillment-orchestrator.ts
- app/dashboard/integrazioni/page.tsx
- docs/DEBUG_CHIAMATA_API.md (NUOVO)
- docs/RIEPILOGO_DEBUG_LOGS.md (NUOVO)"
echo ✅ Commit creato
echo.

echo [4/4] Eseguo push...
git push
echo.

echo ============================================
echo ✅ COMPLETATO IN SICUREZZA!
echo ============================================
echo.
echo Nessun dato sensibile committato.
echo Vai su Vercel per vedere il deploy.
pause







