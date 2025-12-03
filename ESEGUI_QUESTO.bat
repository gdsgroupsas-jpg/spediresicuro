@echo off
echo.
echo ============================================
echo COMMIT E PUSH AUTOMATICO
echo ============================================
echo.
echo IMPORTANTE: Chiudi qualsiasi terminale git aperto prima di eseguire questo script!
echo.
pause
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo Disabilito Git Pager...
git config --global core.pager ""
echo.

echo Aggiungo file...
git add components/integrazioni/spedisci-online-config-multi.tsx
git add components/integrazioni/spedisci-online-config.tsx
git add lib/adapters/couriers/spedisci-online.ts
git add lib/couriers/factory.ts
git add lib/actions/spedisci-online.ts
git add lib/engine/fulfillment-orchestrator.ts
git add actions/configurations.ts
git add app/dashboard/integrazioni/page.tsx
git add docs/
git add -A
echo.

echo Creo commit...
git commit -m "feat: Fix visibilità testo + interfaccia multi-dominio + codice contratto + log debug"
echo.

echo Eseguo push...
git push
echo.

echo.
echo ============================================
echo COMPLETATO!
echo ============================================
echo.
pause

