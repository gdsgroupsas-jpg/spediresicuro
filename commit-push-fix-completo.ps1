# ========================================
# 🔧 COMMIT E PUSH FIX COMPLETO
# ========================================

$ErrorActionPreference = "Continue"
Set-Location "d:\spediresicuro-master"

# Disabilita pager
$env:GIT_PAGER = ""
$env:PAGER = ""
[System.Environment]::SetEnvironmentVariable("GIT_PAGER", "", "Process")
[System.Environment]::SetEnvironmentVariable("PAGER", "", "Process")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🔧 COMMIT E PUSH FIX COMPLETO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Configura Git
Write-Host "1. Configurazione Git..." -ForegroundColor Yellow
git config user.name "gdsgroupsas-jpg" 2>&1 | Out-Null
git config user.email "gdsgroupsas-jpg@users.noreply.github.com" 2>&1 | Out-Null
git config core.pager "" 2>&1 | Out-Null
Write-Host "   ✅ Configurazione completata" -ForegroundColor Green
Write-Host ""

# 2. Verifica stato
Write-Host "2. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --porcelain 2>&1
if ($status) {
    Write-Host "   File modificati trovati:" -ForegroundColor Cyan
    $status | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
} else {
    Write-Host "   ℹ️  Nessun file modificato" -ForegroundColor Gray
}
Write-Host ""

# 3. Aggiungi file specifici
Write-Host "3. Aggiunta file allo staging..." -ForegroundColor Yellow
$files = @(
    "components/dashboard-nav.tsx",
    "supabase/migrations/021_verify_fix_account_type_config.sql"
)

$filesAdded = $false
foreach ($file in $files) {
    if (Test-Path $file) {
        $fileStatus = git status --porcelain $file 2>&1
        if ($fileStatus -or $true) {
            git add $file 2>&1 | Out-Null
            Write-Host "   ✅ Aggiunto: $file" -ForegroundColor Green
            $filesAdded = $true
        } else {
            Write-Host "   ⏭️  Nessuna modifica: $file" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ❌ File non trovato: $file" -ForegroundColor Red
    }
}

if (-not $filesAdded) {
    # Prova ad aggiungere tutto
    git add components/dashboard-nav.tsx 2>&1 | Out-Null
    git add supabase/migrations/021_verify_fix_account_type_config.sql 2>&1 | Out-Null
}
Write-Host ""

# 4. Verifica staging
Write-Host "4. Verifica staging..." -ForegroundColor Yellow
$staged = git diff --cached --name-only 2>&1
if ($staged) {
    Write-Host "   File in staging:" -ForegroundColor Cyan
    $staged | ForEach-Object { Write-Host "   ✅ $_" -ForegroundColor Green }
} else {
    Write-Host "   ⚠️  Nessun file in staging" -ForegroundColor Yellow
    
    # Controlla se sono già committati
    Write-Host "   Verificando se sono già committati..." -ForegroundColor Gray
    $lastCommit = git log -1 --name-only --pretty=format:"" 2>&1
    if ($lastCommit -match "dashboard-nav|021_verify_fix") {
        Write-Host "   ✅ I file sono già nell'ultimo commit" -ForegroundColor Green
    }
}
Write-Host ""

# 5. Commit
Write-Host "5. Commit modifiche..." -ForegroundColor Yellow
$commitMsg = @"
Fix: Aggiunto controllo accountType per accesso sezione Admin e script SQL di verifica

- Modificato dashboard-nav.tsx per controllare accountType (admin/superadmin) oltre a userRole
- Applicato fix sia per versione desktop (linea 325) che mobile (linea 441)
- Creato script SQL 021_verify_fix_account_type_config.sql per verificare e fixare configurazioni account_type in Supabase
- Lo script verifica ENUM, colonne, fixa inconsistenze e genera report statistiche
"@

$commitOutput = git commit -m $commitMsg 2>&1
$commitExitCode = $LASTEXITCODE

if ($commitExitCode -eq 0) {
    Write-Host "   ✅ Commit completato!" -ForegroundColor Green
    Write-Host "   $commitOutput" -ForegroundColor Gray
} else {
    if ($commitOutput -match "nothing to commit|no changes") {
        Write-Host "   ℹ️  Nessuna modifica da committare (già committato)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Commit fallito:" -ForegroundColor Yellow
        Write-Host "   $commitOutput" -ForegroundColor Red
    }
}
Write-Host ""

# 6. Verifica commit locali da pushare
Write-Host "6. Verifica commit da pushare..." -ForegroundColor Yellow
try {
    $localHash = git rev-parse HEAD 2>&1
    $remoteHash = git rev-parse origin/master 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $localHash -ne $remoteHash) {
        Write-Host "   Commit locali trovati da pushare" -ForegroundColor Cyan
        Write-Host "   Local:  $localHash" -ForegroundColor Gray
        Write-Host "   Remote: $remoteHash" -ForegroundColor Gray
        Write-Host ""
        
        # 7. Push
        Write-Host "7. Push su GitHub..." -ForegroundColor Yellow
        $pushOutput = git push origin master 2>&1
        $pushExitCode = $LASTEXITCODE
        
        if ($pushExitCode -eq 0) {
            Write-Host "   ✅✅✅ PUSH COMPLETATO! ✅✅✅" -ForegroundColor Green
            Write-Host ""
            Write-Host "   Verifica su GitHub:" -ForegroundColor Cyan
            Write-Host "   https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master" -ForegroundColor Yellow
        } else {
            Write-Host "   ❌ Push fallito (codice: $pushExitCode)" -ForegroundColor Red
            Write-Host "   Output: $pushOutput" -ForegroundColor Yellow
            Write-Host ""
            
            if ($pushOutput -match "authentication|credential|403|401|denied") {
                Write-Host "   ⚠️  PROBLEMA DI AUTENTICAZIONE!" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "   SOLUZIONE:" -ForegroundColor Yellow
                Write-Host "   1. Vai su: https://github.com/settings/tokens" -ForegroundColor Cyan
                Write-Host "   2. Clicca 'Generate new token (classic)'" -ForegroundColor Cyan
                Write-Host "   3. Nome: 'SpedireSicuro Push'" -ForegroundColor Cyan
                Write-Host "   4. Seleziona permessi: repo (tutti)" -ForegroundColor Cyan
                Write-Host "   5. Genera e COPIA il token" -ForegroundColor Cyan
                Write-Host "   6. Esegui manualmente: git push origin master" -ForegroundColor Cyan
                Write-Host "   7. Quando chiede password, incolla il TOKEN (non la password!)" -ForegroundColor Cyan
            } elseif ($pushOutput -match "connection|network|timeout") {
                Write-Host "   ⚠️  PROBLEMA DI CONNESSIONE!" -ForegroundColor Yellow
                Write-Host "   Verifica la connessione internet e riprova" -ForegroundColor Cyan
            } else {
                Write-Host "   ⚠️  Errore sconosciuto" -ForegroundColor Yellow
                Write-Host "   Prova a eseguire manualmente: git push origin master" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "   ✅ Repository già sincronizzato" -ForegroundColor Green
        Write-Host "   Local:  $localHash" -ForegroundColor Gray
        Write-Host "   Remote: $remoteHash" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Errore durante verifica: $_" -ForegroundColor Yellow
    Write-Host "   Prova a eseguire manualmente: git push origin master" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ COMPLETATO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Premi un tasto per chiudere..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

