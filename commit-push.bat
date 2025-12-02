@echo off
echo ========================================
echo   COMMIT E PUSH SU MASTER
echo ========================================
echo.

echo Passo 1: Aggiungo tutti i file modificati...
git add -A
if errorlevel 1 (
    echo ERRORE durante git add
    pause
    exit /b 1
)
echo OK - File aggiunti correttamente
echo.

echo Passo 2: Faccio commit...
git commit -m "chore: pulizia file obsoleti e commit modifiche"
if errorlevel 1 (
    echo ERRORE durante git commit
    echo Prova a vedere lo stato con: git status
    pause
    exit /b 1
)
echo OK - Commit completato
echo.

echo Passo 3: Faccio push su master...
git push origin master
if errorlevel 1 (
    echo ERRORE durante git push
    pause
    exit /b 1
)
echo.

echo ========================================
echo   COMPLETATO!
echo ========================================
echo.
echo Il codice e stato inviato su GitHub.
echo Vercel aggiornera automaticamente il sito.
echo.
pause


