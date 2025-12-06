@echo off
echo COMMIT AUTOMATICO
cd /d C:\spediresicuro-master\spediresicuro
git config --global core.pager ""
git add -A
git commit -m "fix: Correzione TypeScript session role + tutti i fix completati"
git push
echo FATTO!









