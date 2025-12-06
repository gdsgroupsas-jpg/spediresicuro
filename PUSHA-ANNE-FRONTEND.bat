@echo off
echo ========================================
echo PUSH ANNE FRONTEND SU GITHUB
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1/5] Verifica file Anne...
if exist "components\homepage\anne-promo-section.tsx" (
    echo OK: anne-promo-section.tsx presente
) else (
    echo ERRORE: anne-promo-section.tsx NON TROVATO!
    pause
    exit /b 1
)

echo.
echo [2/5] Aggiungi file al staging...
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
git add app/api/ai/agent-chat/route.ts
echo File aggiunti.

echo.
echo [3/5] Verifica staging...
git status --short
echo.

echo [4/5] Crea commit...
git commit -m "feat: Aggiunge Anne al frontend - Sezione promozionale homepage + API chat

✅ Frontend:
- Componente AnnePromoSection in homepage
- Integrazione in app/page.tsx
- Design moderno con gradient e animazioni

✅ Backend:
- API route /api/ai/agent-chat per chat con Anne
- Integrazione Claude 3.5 Sonnet
- Tools e context building

✅ Features:
- Calcolo prezzi intelligente
- Gestione spedizioni
- Tracking avanzato
- Analisi business (admin)
- Monitoraggio sistema (admin)"
echo.

echo [5/5] Push su GitHub...
git push origin master
echo.

echo ========================================
echo VERIFICA FINALE
echo ========================================
git log --oneline -3
echo.

echo ========================================
echo COMPLETATO!
echo ========================================
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
echo Dovresti vedere il commit "feat: Aggiunge Anne al frontend..."
echo.
pause
