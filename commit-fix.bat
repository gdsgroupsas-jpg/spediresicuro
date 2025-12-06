@echo off
cd /d C:\spediresicuro-master\spediresicuro
echo Aggiungo file modificato...
git add actions/configurations.ts
echo Creo commit...
git commit -m "fix: Corretto errore sintassi else duplicato in configurations.ts"
echo Eseguo push...
git push
echo Fatto!









