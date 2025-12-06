@echo off
chcp 65001 >nul
echo ========================================
echo FORZA ADD ANNE A GIT
echo ========================================
echo.

cd /d "c:\spediresicuro-master\spediresicuro"

echo [1] Verifica file esiste...
if not exist "components\homepage\anne-promo-section.tsx" (
    echo ERRORE: File NON TROVATO!
    pause
    exit /b 1
)
echo OK: File esiste

echo.
echo [2] Verifica se tracciato...
git ls-files components/homepage/anne-promo-section.tsx >nul 2>&1
if %errorlevel% == 0 (
    echo File GIA' tracciato da Git
    echo Verifico se ci sono modifiche...
    git diff components/homepage/anne-promo-section.tsx
    if %errorlevel% == 0 (
        echo Nessuna modifica - file identico a HEAD
    ) else (
        echo CI SONO MODIFICHE - le aggiungo
        git add components/homepage/anne-promo-section.tsx
    )
) else (
    echo File NON tracciato - lo aggiungo ora
    git add components/homepage/anne-promo-section.tsx
)

echo.
echo [3] Verifica staging...
git status --short components/homepage/anne-promo-section.tsx
if %errorlevel% == 0 (
    echo OK: File in staging o gia' committato
) else (
    echo ERRORE: File non in staging!
    echo Provo con -f (force)...
    git add -f components/homepage/anne-promo-section.tsx
    git status --short components/homepage/anne-promo-section.tsx
)

echo.
echo [4] Se file in staging, creo commit...
git diff --cached --name-only | findstr /i "anne-promo" >nul
if %errorlevel% == 0 (
    echo File in staging - creo commit
    git commit -m "feat: Aggiunge componente AnnePromoSection al frontend"
    if %errorlevel% == 0 (
        echo OK: Commit creato
        echo.
        echo [5] Push su GitHub...
        git push origin master
    ) else (
        echo ERRORE: Commit fallito!
    )
) else (
    echo File NON in staging - potrebbe essere gia' committato
    echo Verifico ultimi commit...
    git log --oneline --all -- components/homepage/anne-promo-section.tsx
)

echo.
echo ========================================
echo VERIFICA FINALE
echo ========================================
git log --oneline -5
echo.
pause
