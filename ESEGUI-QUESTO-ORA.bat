@echo off
echo.
echo ========================================
echo   PUSH GIT - VERSIONE SEMPLICE
echo ========================================
echo.

cd /d "%~dp0"

echo [1] Aggiunta file...
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
git add -A

echo [2] Commit...
git commit -m "Deploy: Sezione promozionale Anne"

echo [3] Push...
git push origin master

echo.
echo ========================================
echo   COMPLETATO!
echo ========================================
echo.
pause
