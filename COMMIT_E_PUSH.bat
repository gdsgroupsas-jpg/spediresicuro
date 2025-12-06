@echo off
echo ============================================
echo COMMIT E PUSH: Fix Codice Contratto
echo ============================================
echo.

cd /d C:\spediresicuro-master\spediresicuro

echo [1/4] Aggiungo file modificati...
git config --global core.pager ""
git add -A

echo.
echo [2/4] Verifico file...
git status --short

echo.
echo [3/4] Creo commit...
git commit -m "feat: Sistema completo codice contratto Spedisci.Online + interfaccia migliorata

- Nuova interfaccia tabellare chiara per configurare contratti Spedisci.Online
- Caratteri leggibili (font-size 15px) e form semplice
- Campo codice_contratto aggiunto al payload API
- Mapping automatico corriere -> codice contratto
- Supporto contract_mapping completo in adapter
- Orchestrator passa corriere ai dati spedizione
- Integrata nuova interfaccia nella pagina integrazioni"

echo.
echo [4/4] Eseguo push...
git push

echo.
echo ============================================
echo COMPLETATO!
echo ============================================
echo.
echo Vai su Vercel per vedere il deploy automatico.
pause









