@echo off
echo ========================================
echo FIX COMMIT - Soluzione Definitiva
echo ========================================
echo.

echo [1] Configurazione Git...
git config user.name "gdsgroupsas-jpg"
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
echo OK
echo.

echo [2] Verifica stato...
git status
echo.

echo [3] Aggiunta file modificati...
git add -A
echo OK
echo.

echo [4] Verifica file aggiunti...
git status --short
echo.

echo [5] Creazione commit...
git commit -m "fix: Rimossa proprietà env non valida da playwright.config.ts"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ COMMIT CREATO CON SUCCESSO!
    echo ========================================
    echo.
    git log --oneline -1
) else (
    echo.
    echo ========================================
    echo ⚠️ Nessun file da committare o errore
    echo ========================================
    echo.
    echo Verifica lo stato con: git status
)
echo.
pause
