@echo off
chcp 65001 >nul

echo ======================================== > analisi-completa.txt
echo ANALISI COMPLETA GIT - %DATE% %TIME% >> analisi-completa.txt
echo ======================================== >> analisi-completa.txt
echo. >> analisi-completa.txt

cd /d "%~dp0"
echo Cartella: %CD% >> analisi-completa.txt
echo. >> analisi-completa.txt

echo [1] STATO REPOSITORY >> analisi-completa.txt
git status >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [2] FILE MODIFICATI >> analisi-completa.txt
git status --porcelain >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [3] ULTIMI 10 COMMIT LOCALI >> analisi-completa.txt
git log --oneline -10 >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [4] COMMIT LOCALI NON PUSHATI >> analisi-completa.txt
git log origin/master..HEAD --oneline >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [5] COMMIT REMOTI NON IN LOCALE >> analisi-completa.txt
git log HEAD..origin/master --oneline >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [6] DIFFERENZE CON REMOTO >> analisi-completa.txt
git diff HEAD origin/master --stat >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [7] REMOTE CONFIGURATO >> analisi-completa.txt
git remote -v >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [8] BRANCH CORRENTE >> analisi-completa.txt
git branch >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [9] CONFLITTI NON RISOLTI >> analisi-completa.txt
git ls-files --unmerged >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [10] VERIFICA CONFLITTI NEI FILE >> analisi-completa.txt
git diff --check >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [11] FETCH DA REMOTO >> analisi-completa.txt
git fetch origin master >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo [12] STATO DOPO FETCH >> analisi-completa.txt
git status >> analisi-completa.txt 2>&1
echo. >> analisi-completa.txt

echo ======================================== >> analisi-completa.txt
echo FINE ANALISI >> analisi-completa.txt
echo ======================================== >> analisi-completa.txt

type analisi-completa.txt
echo.
echo Analisi salvata in: analisi-completa.txt
pause
