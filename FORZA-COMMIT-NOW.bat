@echo off
chcp 65001 >nul
cd /d "d:\spediresicuro-master"
echo ========================================
echo   FORZA COMMIT E PUSH
echo ========================================
echo.
echo Aggiungo tutti i file...
git add -A
echo.
echo Stato dopo git add:
git status --short
echo.
echo Creo commit...
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo"
echo.
echo Push su GitHub...
git push origin master
echo.
echo ========================================
echo   VERIFICA FINALE
echo ========================================
echo.
echo Ultimo commit:
git log --oneline -1
echo.
echo Hash HEAD:
git rev-parse HEAD
echo.
echo Hash origin/master:
git rev-parse origin/master
echo.
pause
