@echo off
echo ========================================
echo COMMIT E PUSH DIALOG FIX
echo ========================================
echo.

cd /d d:\spediresicuro-master

echo [1/4] Verifica modifiche...
git status --short
echo.

echo [2/4] Aggiunta file modificati...
git add app/dashboard/listini/page.tsx
if %errorlevel% neq 0 (
    echo ERRORE: git add fallito
    pause
    exit /b 1
)
echo OK: File aggiunto
echo.

echo [3/4] Verifica stato commit...
git status --short
echo.

echo Verifica se ci sono modifiche da committare...
git diff --cached --name-only > nul 2>&1
if %errorlevel% neq 0 (
    echo Nessuna modifica staged. Verifica modifiche non staged...
    git diff --name-only
    if %errorlevel% equ 0 (
        echo Trovate modifiche non staged. Aggiungo...
        git add app/dashboard/listini/page.tsx
    )
)

git diff --cached --name-only > nul 2>&1
if %errorlevel% equ 0 (
    echo Commit modifiche...
    git commit -m "Fix: Implementato dialog completo creazione listino prezzi" -m "Sostituito placeholder con form completo funzionante" -m "Aggiunti campi: nome, versione, stato, priorita, corriere, globale, date validita, descrizione" -m "Integrato con createPriceListAction" -m "Aggiunto caricamento corrieri con fallback" -m "Validazione form e gestione errori" -m "Toast notifiche per successo/errore"
    if %errorlevel% neq 0 (
        echo ERRORE: git commit fallito
        pause
        exit /b 1
    )
    echo OK: Commit completato
) else (
    echo Nessuna modifica da committare. Verifica se ci sono commit locali da pushare...
    git log origin/master..HEAD --oneline
)
echo.

echo [4/4] Push su GitHub...
git push origin master
if %errorlevel% neq 0 (
    echo ERRORE: git push fallito
    pause
    exit /b 1
)
echo OK: Push completato
echo.

echo ========================================
echo OPERAZIONE COMPLETATA CON SUCCESSO
echo ========================================
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo.
pause
