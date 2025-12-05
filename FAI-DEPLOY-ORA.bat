@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   DEPLOY AUTOMATICO - SEZIONE PROMOZIONALE ANNE     ║
echo ╚══════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"
echo 📁 Cartella: %CD%
echo.

echo [1/5] 🔍 Verifica Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: Git non trovato!
    echo    Installa Git da: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo ✅ Git installato
echo.

echo [2/5] ➕ Aggiunta file modificati...
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
if errorlevel 1 (
    echo ❌ ERRORE: Impossibile aggiungere file
    pause
    exit /b 1
)
echo ✅ File aggiunti correttamente
echo.

echo [3/5] 📋 Verifica file pronti per commit...
git status --short
echo.

echo [4/5] 💾 Commit delle modifiche...
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"
if errorlevel 1 (
    echo ⚠️  ATTENZIONE: Nessun cambiamento da committare o commit fallito
    echo    (Potrebbe essere già committato)
) else (
    echo ✅ Commit completato con successo!
)
echo.

echo [5/5] 🚀 Push su GitHub/Vercel...
git push
if errorlevel 1 (
    echo.
    echo ❌ ERRORE: Push fallito!
    echo.
    echo Possibili cause:
    echo - Nessun remote configurato
    echo - Problemi di autenticazione
    echo - Branch non configurato
    echo.
    echo Verifica con: git remote -v
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ╔══════════════════════════════════════════════════════╗
    echo ║           ✅✅✅ PUSH COMPLETATO! ✅✅✅              ║
    echo ╚══════════════════════════════════════════════════════╝
    echo.
    echo 🔄 Vercel dovrebbe avviare il deploy automaticamente...
    echo ⏱️  Il deploy richiede circa 2-5 minuti
    echo.
    echo 🌐 Verifica il deploy su:
    echo    https://vercel.com/dashboard
    echo.
    echo 📱 Dopo il deploy, controlla la homepage del tuo sito
    echo    per vedere la nuova sezione promozionale di Anne!
    echo.
)
echo.
pause

