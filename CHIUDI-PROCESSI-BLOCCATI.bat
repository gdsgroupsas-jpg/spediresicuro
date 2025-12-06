@echo off
chcp 65001 >nul
echo ========================================
echo   🔧 CHIUDI PROCESSI BLOCCATI
echo ========================================
echo.

echo 1. Cercando processi PowerShell...
tasklist /FI "IMAGENAME eq powershell.exe" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Trovati processi PowerShell attivi
    echo.
    echo Chiudere tutti i processi PowerShell? (S/N)
    set /p choice=
    if /i "%choice%"=="S" (
        echo Chiudendo processi PowerShell...
        taskkill /F /IM powershell.exe 2>nul
        echo ✅ Processi PowerShell chiusi
    )
) else (
    echo ✅ Nessun processo PowerShell trovato
)
echo.

echo 2. Cercando processi Git...
tasklist /FI "IMAGENAME eq git.exe" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  Trovati processi Git attivi
    echo.
    echo Chiudere tutti i processi Git? (S/N)
    set /p choice=
    if /i "%choice%"=="S" (
        echo Chiudendo processi Git...
        taskkill /F /IM git.exe 2>nul
        echo ✅ Processi Git chiusi
    )
) else (
    echo ✅ Nessun processo Git trovato
)
echo.

echo 3. Pulizia repository Git...
cd /d "d:\spediresicuro-master"

if exist ".git\REBASE_HEAD" (
    echo ⚠️  Trovato REBASE_HEAD - rebase in corso
    echo.
    echo Abortire il rebase? (S/N)
    set /p choice=
    if /i "%choice%"=="S" (
        git rebase --abort 2>nul
        echo ✅ Rebase abortito
    )
)

if exist ".git\MERGE_HEAD" (
    echo ⚠️  Trovato MERGE_HEAD - merge in corso
    echo.
    echo Abortire il merge? (S/N)
    set /p choice=
    if /i "%choice%"=="S" (
        git merge --abort 2>nul
        echo ✅ Merge abortito
    )
)

if exist ".git\index.lock" (
    echo ⚠️  Trovato index.lock - Git bloccato
    del /F /Q ".git\index.lock" 2>nul
    echo ✅ Lock rimosso
)

if exist ".git\.MERGE_MSG.swp" (
    echo ⚠️  Trovato .MERGE_MSG.swp
    del /F /Q ".git\.MERGE_MSG.swp" 2>nul
    echo ✅ File swap rimosso
)
echo.

echo 4. Verifica Execution Policy PowerShell...
powershell -Command "Get-ExecutionPolicy -List" 2>nul
echo.

echo 5. Test esecuzione PowerShell...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'PowerShell funziona!' -ForegroundColor Green" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ PowerShell funziona correttamente
) else (
    echo ❌ Problema con PowerShell
    echo.
    echo Prova a eseguire manualmente:
    echo powershell -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
)
echo.

echo ========================================
echo   ✅ PULIZIA COMPLETATA
echo ========================================
echo.
pause

