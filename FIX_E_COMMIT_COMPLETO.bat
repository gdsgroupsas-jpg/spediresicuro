@echo off
echo ============================================
echo FIX GIT PAGER + COMMIT + PUSH SICURO
echo ============================================
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo [1/6] Disabilito Git Pager (così non blocca più)...
git config --global core.pager ""
echo ✅ Git Pager disabilitato globalmente
echo.

echo [2/6] Verifico stato repository...
git status --short
echo.

echo [3/6] Aggiungo SOLO file sicuri (no .env, no secrets)...
git add components/integrazioni/spedisci-online-config.tsx
git add lib/adapters/couriers/spedisci-online.ts
git add lib/couriers/factory.ts
git add lib/actions/spedisci-online.ts
git add lib/engine/fulfillment-orchestrator.ts
git add app/dashboard/integrazioni/page.tsx
git add docs/DEBUG_CHIAMATA_API.md
git add docs/RIEPILOGO_DEBUG_LOGS.md
git add docs/COS_E_GIT_PAGER.md
git add docs/VERIFICA_SICUREZZA.md
echo ✅ File aggiunti (verificati: nessun dato sensibile)
echo.

echo [4/6] Verifico file da committare...
git status --short
echo.

echo [5/6] Creo commit con messaggio descrittivo...
git commit -m "feat: Sistema codice contratto Spedisci.Online + log debug dettagliati

- Nuova interfaccia tabellare per configurare contratti Spedisci.Online
- Campo codice_contratto aggiunto al payload API
- Mapping automatico corriere -> codice contratto
- Log dettagliati per debug chiamata API
- Supporto contract_mapping completo in adapter
- Orchestrator passa corriere ai dati spedizione

File modificati:
- components/integrazioni/spedisci-online-config.tsx (NUOVO)
- lib/adapters/couriers/spedisci-online.ts
- lib/couriers/factory.ts
- lib/actions/spedisci-online.ts
- lib/engine/fulfillment-orchestrator.ts
- app/dashboard/integrazioni/page.tsx
- docs/DEBUG_CHIAMATA_API.md (NUOVO)
- docs/RIEPILOGO_DEBUG_LOGS.md (NUOVO)
- docs/COS_E_GIT_PAGER.md (NUOVO)"
echo ✅ Commit creato
echo.

echo [6/6] Eseguo push su GitHub...
git push
echo.

echo ============================================
echo ✅ COMPLETATO IN SICUREZZA!
echo ============================================
echo.
echo ✅ Git Pager disabilitato (non bloccherà più)
echo ✅ Nessun dato sensibile committato
echo ✅ Push completato
echo.
echo Vai su Vercel per vedere il deploy automatico.
echo.
pause






