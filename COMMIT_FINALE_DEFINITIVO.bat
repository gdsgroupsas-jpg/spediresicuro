@echo off
echo ============================================
echo COMMIT E PUSH AUTOMATICO - VERSIONE DEFINITIVA
echo ============================================
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo [PREPARAZIONE] Disabilito Git Pager per sempre...
git config --global core.pager "" >nul 2>&1
git config --global --unset core.pager >nul 2>&1
set GIT_PAGER=
set PAGER=
echo ✅ Pager disabilitato
echo.

echo [PREPARAZIONE] Reset staging area...
git reset HEAD . >nul 2>&1
echo ✅ Staging resettato
echo.

echo [1/5] Aggiungo file modificati...
git add components/integrazioni/spedisci-online-config-multi.tsx >nul 2>&1
git add components/integrazioni/spedisci-online-config.tsx >nul 2>&1
git add lib/adapters/couriers/spedisci-online.ts >nul 2>&1
git add lib/couriers/factory.ts >nul 2>&1
git add lib/actions/spedisci-online.ts >nul 2>&1
git add lib/engine/fulfillment-orchestrator.ts >nul 2>&1
git add actions/configurations.ts >nul 2>&1
git add app/dashboard/integrazioni/page.tsx >nul 2>&1
git add docs/*.md >nul 2>&1
git add -A >nul 2>&1
echo ✅ File aggiunti
echo.

echo [2/5] Verifico file da committare...
git status --short
echo.

echo [3/5] Creo commit...
git commit -m "feat: Fix visibilità testo + interfaccia multi-dominio + codice contratto + log debug

- Fix: Testo perfettamente visibile negli input (text-gray-900, bg-white)
- Nuova interfaccia multi-dominio per gestire piu configurazioni Spedisci.Online
- Lista configurazioni con toggle attiva/disattiva (solo superadmin)
- Funzione elimina configurazione aggiunta
- Campo codice_contratto nel payload API
- Mapping automatico corriere -> codice contratto
- Log dettagliati per debug chiamata API
- Supporto contract_mapping completo

File:
- components/integrazioni/spedisci-online-config-multi.tsx (NUOVO)
- components/integrazioni/spedisci-online-config.tsx (fix visibilità)
- lib/adapters/couriers/spedisci-online.ts
- lib/couriers/factory.ts
- lib/actions/spedisci-online.ts
- lib/engine/fulfillment-orchestrator.ts
- actions/configurations.ts (toggle status + delete)
- app/dashboard/integrazioni/page.tsx
- docs/*.md"
echo ✅ Commit creato
echo.

echo [4/5] Eseguo push...
git push
echo.

echo [5/5] Verifico stato finale...
git status --short
echo.

echo ============================================
echo ✅ COMPLETATO!
echo ============================================
echo.
echo Vai su Vercel per vedere il deploy automatico.
pause






