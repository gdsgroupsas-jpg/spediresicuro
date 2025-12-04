@echo off
echo ============================================
echo COMMIT E PUSH URGENTE
echo ============================================
echo.
echo IMPORTANTE: Esegui questo script in un NUOVO terminale!
echo Chiudi quello bloccato e apri PowerShell/CMD nuovo.
echo.
pause

cd /d C:\spediresicuro-master\spediresicuro

echo [1/4] Disabilito pager...
git config --global core.pager "" 2>nul
git config --global --unset core.pager 2>nul
set GIT_PAGER=
set PAGER=
echo OK

echo.
echo [2/4] Aggiungo file...
git add components/integrazioni/spedisci-online-config-multi.tsx 2>nul
git add lib/security/audit-log.ts 2>nul
git add components/integrazioni/spedisci-online-config.tsx 2>nul
git add lib/adapters/couriers/spedisci-online.ts 2>nul
git add lib/couriers/factory.ts 2>nul
git add lib/actions/spedisci-online.ts 2>nul
git add lib/engine/fulfillment-orchestrator.ts 2>nul
git add actions/configurations.ts 2>nul
git add app/dashboard/integrazioni/page.tsx 2>nul
git add docs/*.md 2>nul
git add -A 2>nul
echo OK

echo.
echo [3/4] Creo commit...
git commit -m "fix: Correzione TypeScript session role + audit log types + fix visibilità + multi-dominio" 2>nul
echo OK

echo.
echo [4/4] Eseguo push...
git push 2>nul
echo OK

echo.
echo ============================================
echo COMPLETATO!
echo ============================================
pause






