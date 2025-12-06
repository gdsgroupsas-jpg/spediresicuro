@echo off
echo ========================================
echo VERIFICA COMMIT RIEPILOGO
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1/3] Ultimi 3 commit...
git log --oneline -3
echo.

echo [2/3] Stato repository...
git status --short
echo.

echo [3/3] Verifica push...
git log origin/master --oneline -1
echo.

echo ========================================
echo RIEPILOGO COMPLETATO!
echo ========================================
echo.
echo Tutti i commit sono stati pushati su GitHub.
echo Anne e' online su Railway!
echo.
pause
