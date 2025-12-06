@echo off
chcp 65001 >nul
echo ========================================
echo   🔧 FIX GIT PUSH DEFINITIVO
echo ========================================
echo.

cd /d "d:\spediresicuro-master"

echo 1. Configurazione Git...
git config user.name "gdsgroupsas-jpg"
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
git config core.pager ""
echo ✅ Configurazione completata
echo.

echo 2. Verifica file modificati...
git status --short
echo.

echo 3. Aggiunta file...
git add components/dashboard-nav.tsx
git add supabase/migrations/021_verify_fix_account_type_config.sql
git add fix-git-connection.ps1
git add commit-push-fix-completo.ps1
echo ✅ File aggiunti
echo.

echo 4. Verifica staging...
git diff --cached --name-only
echo.

echo 5. Commit...
git commit -m "Fix: Aggiunto controllo accountType per accesso sezione Admin e script SQL di verifica

- Modificato dashboard-nav.tsx per controllare accountType (admin/superadmin) oltre a userRole
- Applicato fix sia per versione desktop (linea 325) che mobile (linea 441)
- Creato script SQL 021_verify_fix_account_type_config.sql per verificare e fixare configurazioni account_type in Supabase
- Lo script verifica ENUM, colonne, fixa inconsistenze e genera report statistiche"
echo.

echo 6. Push su GitHub...
git push origin master
echo.

echo ========================================
echo   ✅ COMPLETATO
echo ========================================
echo.
echo Verifica su GitHub:
echo https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
echo.
pause

