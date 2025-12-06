@echo off
echo ========================================
echo COMMIT E PUSH FIX TYPESCRIPT
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1/4] Verifica stato Git...
git status
echo.

echo [2/4] Aggiungi file modificato...
git add automation-service/src/agent.ts
echo.

echo [3/4] Crea commit...
git commit -m "fix: Correggi errore TypeScript - Array.from NodeListOf per .find() su cells"
echo.

echo [4/4] Push su GitHub...
git push origin master
echo.

echo ========================================
echo VERIFICA COMMIT
echo ========================================
git log --oneline -3
echo.

echo ========================================
echo VERIFICA STATO FINALE
echo ========================================
git status
echo.

echo ========================================
echo COMPLETATO!
echo ========================================
pause
