@echo off
chcp 65001 >nul
cd /d "d:\spediresicuro-master"

echo ======================================== > commit-forzato.log
echo COMMIT FORZATO FINALE >> commit-forzato.log
echo Data: %date% %time% >> commit-forzato.log
echo ======================================== >> commit-forzato.log
echo. >> commit-forzato.log

echo [1] STATO INIZIALE >> commit-forzato.log
git status --porcelain >> commit-forzato.log 2>&1
echo. >> commit-forzato.log

echo [2] AGGIUNGO TUTTI I FILE >> commit-forzato.log
git add -A >> commit-forzato.log 2>&1
echo Exit code: %ERRORLEVEL% >> commit-forzato.log
echo. >> commit-forzato.log

echo [3] FILE STAGED >> commit-forzato.log
git diff --cached --name-only >> commit-forzato.log 2>&1
echo. >> commit-forzato.log

echo [4] CREO COMMIT >> commit-forzato.log
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo" >> commit-forzato.log 2>&1
echo Exit code: %ERRORLEVEL% >> commit-forzato.log
echo. >> commit-forzato.log

echo [5] PUSH SU GITHUB >> commit-forzato.log
git push origin master >> commit-forzato.log 2>&1
echo Exit code: %ERRORLEVEL% >> commit-forzato.log
echo. >> commit-forzato.log

echo [6] VERIFICA FINALE >> commit-forzato.log
git log --oneline -1 >> commit-forzato.log 2>&1
git rev-parse HEAD >> commit-forzato.log 2>&1
git rev-parse origin/master >> commit-forzato.log 2>&1
echo. >> commit-forzato.log

echo ======================================== >> commit-forzato.log
echo FINE >> commit-forzato.log
echo ======================================== >> commit-forzato.log

type commit-forzato.log
