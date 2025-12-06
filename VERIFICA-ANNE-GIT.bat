@echo off
echo ========================================
echo VERIFICA ANNE IN GIT
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1] Verifica file esiste...
if exist "components\homepage\anne-promo-section.tsx" (
    echo OK: File ESISTE localmente
) else (
    echo ERRORE: File NON ESISTE!
    pause
    exit /b 1
)

echo.
echo [2] Verifica se tracciato da Git...
git ls-files components/homepage/anne-promo-section.tsx
if %errorlevel% == 0 (
    echo OK: File E' TRACCIATO da Git
) else (
    echo ATTENZIONE: File NON tracciato da Git!
    echo.
    echo Aggiungo file a Git...
    git add components/homepage/anne-promo-section.tsx
    git status components/homepage/anne-promo-section.tsx
)

echo.
echo [3] Verifica modifiche...
git diff HEAD components/homepage/anne-promo-section.tsx
if %errorlevel% == 0 (
    echo OK: Nessuna modifica (file identico a HEAD)
) else (
    echo ATTENZIONE: Ci sono modifiche non committate!
)

echo.
echo [4] Verifica in commit d5a69be...
git show d5a69be:components/homepage/anne-promo-section.tsx >nul 2>&1
if %errorlevel% == 0 (
    echo OK: File presente nel commit d5a69be
) else (
    echo ATTENZIONE: File NON presente nel commit d5a69be!
)

echo.
echo [5] Verifica app/page.tsx...
git diff HEAD app/page.tsx | findstr /i "Anne"
if %errorlevel% == 0 (
    echo OK: app/page.tsx contiene Anne
) else (
    echo ATTENZIONE: app/page.tsx potrebbe non contenere Anne!
)

echo.
echo ========================================
echo VERIFICA COMPLETATA
echo ========================================
pause
