@echo off
echo ========================================
echo PUSH COMMIT ESISTENTE
echo ========================================
echo.

cd /d d:\spediresicuro-master

echo Verifica commit locali non pushati...
git log origin/master..HEAD --oneline
if %errorlevel% neq 0 (
    echo Nessun commit locale da pushare
    pause
    exit /b 0
)

echo.
echo Push commit su GitHub...
git push origin master
if %errorlevel% neq 0 (
    echo ERRORE: git push fallito
    echo.
    echo Possibili cause:
    echo - Problemi di autenticazione
    echo - Conflitti con il remoto
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo PUSH COMPLETATO CON SUCCESSO
echo ========================================
echo.
echo Verifica su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro
echo.
pause
