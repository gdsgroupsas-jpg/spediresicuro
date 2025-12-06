@echo off
chcp 65001 >nul
cd /d "d:\spediresicuro-master"
echo ======================================== > commit-log.txt
echo   COMMIT E PUSH CON LOG >> commit-log.txt
echo ======================================== >> commit-log.txt
echo Data: %date% %time% >> commit-log.txt
echo. >> commit-log.txt

echo [1] Verifica stato... >> commit-log.txt
git status --porcelain >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo [2] Aggiungo file... >> commit-log.txt
git add -A >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo [3] File staged: >> commit-log.txt
git diff --cached --name-only >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo [4] Creo commit... >> commit-log.txt
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo" >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo [5] Push su GitHub... >> commit-log.txt
git push origin master >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo [6] Verifica finale: >> commit-log.txt
git log --oneline -1 >> commit-log.txt 2>&1
echo. >> commit-log.txt
git rev-parse HEAD >> commit-log.txt 2>&1
echo. >> commit-log.txt
git rev-parse origin/master >> commit-log.txt 2>&1
echo. >> commit-log.txt

echo ======================================== >> commit-log.txt
echo   FINE >> commit-log.txt
echo ======================================== >> commit-log.txt

type commit-log.txt
