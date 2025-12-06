# ============================================
# SCRIPT AUTOMATICO COMPLETO - PULL E PUSH
# ============================================
# Questo script fa TUTTO in automatico:
# 1. Scarica le modifiche da GitHub (pull)
# 2. Verifica se ci sono modifiche locali da salvare
# 3. Fa commit e push se necessario
# ============================================

$ErrorActionPreference = "Continue"
$outputFile = "sync-log.txt"

# Disabilita pager Git per vedere output
$env:GIT_PAGER = ""
$env:PAGER = ""
git config core.pager ""

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SINCRONIZZAZIONE AUTOMATICA GIT      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vai nella cartella corretta
$repoPath = "c:\spediresicuro-master\spediresicuro"
if (Test-Path $repoPath) {
    Set-Location $repoPath
    Write-Host "✓ Cartella trovata: $repoPath" -ForegroundColor Green
} else {
    Write-Host "✗ ERRORE: Cartella non trovata!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# FASE 1: VERIFICA REPOSITORY
# ============================================
Write-Host "--- FASE 1: Verifica Repository ---" -ForegroundColor Yellow

if (-not (Test-Path ".git")) {
    Write-Host "✗ ERRORE: Non è un repository Git!" -ForegroundColor Red
    exit 1
}

$remoteUrl = git remote get-url origin 2>&1
Write-Host "✓ Repository remoto: $remoteUrl" -ForegroundColor Green
Write-Host ""

# ============================================
# FASE 2: SCARICA MODIFICHE REMOTE (PULL)
# ============================================
Write-Host "--- FASE 2: Scarica Modifiche da GitHub ---" -ForegroundColor Yellow

Write-Host "Aggiornamento informazioni remote..." -ForegroundColor Cyan
$fetchResult = git fetch origin 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Avviso durante fetch (potrebbe essere normale)" -ForegroundColor Yellow
}

# Controlla se ci sono commit remoti da scaricare
$remoteCommits = git log HEAD..origin/master --oneline 2>&1 | Where-Object { $_ -notmatch "fatal" }

if ($remoteCommits -and $remoteCommits.Trim() -ne "") {
    Write-Host "📥 Trovati commit remoti da scaricare!" -ForegroundColor Cyan
    Write-Host $remoteCommits -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Scaricamento modifiche..." -ForegroundColor Cyan
    $pullResult = git pull origin master 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Pull completato con successo!" -ForegroundColor Green
        Write-Host $pullResult -ForegroundColor Gray
    } else {
        Write-Host "⚠ Problema durante pull (potrebbe esserci conflitto)" -ForegroundColor Yellow
        Write-Host $pullResult -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Nessuna modifica da scaricare - già aggiornato!" -ForegroundColor Green
}

Write-Host ""

# ============================================
# FASE 3: VERIFICA MODIFICHE LOCALI
# ============================================
Write-Host "--- FASE 3: Verifica Modifiche Locali ---" -ForegroundColor Yellow

# Controlla se ci sono file modificati
$status = git status --short 2>&1 | Where-Object { $_ -notmatch "fatal" }

if ($status -and $status.Trim() -ne "") {
    Write-Host "📝 Trovati file modificati:" -ForegroundColor Cyan
    Write-Host $status -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Aggiunta file modificati..." -ForegroundColor Cyan
    $addResult = git add -A 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ File aggiunti correttamente" -ForegroundColor Green
    } else {
        Write-Host "✗ Errore durante git add" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Creazione commit..." -ForegroundColor Cyan
    $commitMessage = "chore: aggiornamento automatico - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $commitResult = git commit -m $commitMessage 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Commit creato: $commitMessage" -ForegroundColor Green
    } else {
        Write-Host "⚠ Nessun commit necessario (nessuna modifica reale)" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Nessun file modificato localmente" -ForegroundColor Green
}

Write-Host ""

# ============================================
# FASE 4: VERIFICA COMMIT DA CARICARE
# ============================================
Write-Host "--- FASE 4: Verifica Commit da Caricare ---" -ForegroundColor Yellow

$localCommits = git log origin/master..HEAD --oneline 2>&1 | Where-Object { $_ -notmatch "fatal" }

if ($localCommits -and $localCommits.Trim() -ne "") {
    Write-Host "📤 Trovati commit locali da caricare:" -ForegroundColor Cyan
    Write-Host $localCommits -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Caricamento su GitHub..." -ForegroundColor Cyan
    $pushResult = git push origin master 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Push completato con successo!" -ForegroundColor Green
        Write-Host $pushResult -ForegroundColor Gray
    } else {
        Write-Host "✗ ERRORE durante push!" -ForegroundColor Red
        Write-Host $pushResult -ForegroundColor Red
        Write-Host ""
        Write-Host "Possibili cause:" -ForegroundColor Yellow
        Write-Host "  - Problemi di autenticazione GitHub" -ForegroundColor Yellow
        Write-Host "  - Conflitti con il repository remoto" -ForegroundColor Yellow
        Write-Host "  - Connessione internet" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✓ Nessun commit da caricare - già sincronizzato!" -ForegroundColor Green
}

Write-Host ""

# ============================================
# FASE 5: VERIFICA FINALE SINCRONIZZAZIONE
# ============================================
Write-Host "--- FASE 5: Verifica Finale ---" -ForegroundColor Yellow

$localHash = git rev-parse HEAD 2>&1
$remoteHash = git rev-parse origin/master 2>&1

if ($localHash -eq $remoteHash) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ REPOSITORY PERFETTAMENTE          ║" -ForegroundColor Green
    Write-Host "║     SINCRONIZZATO!                    ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Hash locale:  $localHash" -ForegroundColor Gray
    Write-Host "Hash remoto:  $remoteHash" -ForegroundColor Gray
} else {
    Write-Host "⚠ Repository NON completamente sincronizzato" -ForegroundColor Yellow
    Write-Host "Hash locale:  $localHash" -ForegroundColor Gray
    Write-Host "Hash remoto:  $remoteHash" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# RIEPILOGO
# ============================================
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  OPERAZIONI COMPLETATE                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Cyan
Write-Host ""

