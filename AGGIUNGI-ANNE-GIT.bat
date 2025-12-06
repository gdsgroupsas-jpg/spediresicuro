@echo off
chcp 65001 >nul
echo ========================================
echo AGGIUNGI ANNE A GIT E PUSH
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1/6] Verifica file esiste...
if exist "components\homepage\anne-promo-section.tsx" (
    echo OK: File ESISTE
) else (
    echo ERRORE: File NON TROVATO!
    pause
    exit /b 1
)

echo.
echo [2/6] Verifica se tracciato da Git...
git ls-files components/homepage/anne-promo-section.tsx >nul 2>&1
if %errorlevel% == 0 (
    echo OK: File gia' tracciato da Git
    set FILE_TRACCIATO=1
) else (
    echo ATTENZIONE: File NON tracciato - lo aggiungo ora
    set FILE_TRACCIATO=0
)

echo.
echo [3/6] Aggiungi file a Git...
if %FILE_TRACCIATO% == 0 (
    git add components/homepage/anne-promo-section.tsx
    echo File aggiunto come nuovo
) else (
    git add -f components/homepage/anne-promo-section.tsx
    echo File forzato in staging
)

echo.
echo [4/6] Verifica staging...
git status --short components/homepage/anne-promo-section.tsx
if %errorlevel% == 0 (
    echo OK: File in staging
) else (
    echo ATTENZIONE: File non in staging!
)

echo.
echo [5/6] Crea commit...
git commit -m "feat: Aggiunge componente AnnePromoSection al frontend"
if %errorlevel% == 0 (
    echo OK: Commit creato
) else (
    echo ERRORE: Commit fallito!
    pause
    exit /b 1
)

echo.
echo [6/6] Push su GitHub...
git push origin master
if %errorlevel% == 0 (
    echo OK: Push completato
) else (
    echo ERRORE: Push fallito!
    pause
    exit /b 1
)

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
pause
