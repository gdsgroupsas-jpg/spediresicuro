@echo off
chcp 65001 >nul
cd /d "d:\spediresicuro-master"

echo ========================================
echo   MERGE E PUSH AUTOMATICO
echo ========================================
echo.

echo [1] Configurazione Git...
git config user.name "gdsgroupsas-jpg"
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
git config core.pager ""
echo OK
echo.

echo [2] Fetch da GitHub...
git fetch origin
echo OK
echo.

echo [3] Verifica branch disponibili...
git branch -a
echo.

echo [4] Verifica branch remoti...
git branch -r
echo.

echo [5] Verifica stato repository...
git status
echo.

echo [6] Aggiungo tutti i file modificati...
git add -A
echo OK
echo.

echo [7] Verifica file da committare...
git status --short
echo.

echo [8] Commit modifiche...
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo" || echo Nessuna modifica da committare
echo.

echo [9] Verifica branch da mergiare...
for /f "tokens=*" %%b in ('git branch -r ^| findstr /v "HEAD" ^| findstr /v "master"') do (
    echo Trovato branch remoto: %%b
    set BRANCH_NAME=%%b
    set BRANCH_NAME=!BRANCH_NAME:origin/=!
    echo Nome branch: !BRANCH_NAME!
    echo.
    echo [10] Merge branch !BRANCH_NAME! in master...
    git merge !BRANCH_NAME! --no-edit || echo Merge non necessario o già fatto
    echo.
)

echo [11] Push su GitHub...
git push origin master
echo.

echo [12] Verifica finale...
git log --oneline -3
echo.
git rev-parse HEAD
echo.

echo ========================================
echo   COMPLETATO
echo ========================================
pause
