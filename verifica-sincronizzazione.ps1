# Script per verificare la sincronizzazione Git
$ErrorActionPreference = "Continue"

Write-Host "=== VERIFICA SINCRONIZZAZIONE GIT ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se siamo in un repository Git
$gitDir = ""
if (Test-Path "c:\spediresicuro-master\spediresicuro\.git") {
    $gitDir = "c:\spediresicuro-master\spediresicuro"
    Set-Location $gitDir
    Write-Host "Repository trovato in: spediresicuro" -ForegroundColor Green
} elseif (Test-Path "c:\spediresicuro-master\.git") {
    $gitDir = "c:\spediresicuro-master"
    Set-Location $gitDir
    Write-Host "Repository trovato in: spediresicuro-master" -ForegroundColor Green
} else {
    Write-Host "Nessun repository Git trovato!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "--- 1. STATO REPOSITORY ---" -ForegroundColor Yellow
$status = git status --short 2>&1
if ($status) {
    Write-Host "File modificati:" -ForegroundColor Yellow
    Write-Host $status
} else {
    Write-Host "Nessun file modificato localmente" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- 2. ULTIMI COMMIT LOCALI ---" -ForegroundColor Yellow
git log --oneline -3 2>&1

Write-Host ""
Write-Host "--- 3. VERIFICA REMOTE ---" -ForegroundColor Yellow
git remote -v 2>&1

Write-Host ""
Write-Host "--- 4. AGGIORNAMENTO INFO REMOTE ---" -ForegroundColor Yellow
git fetch origin 2>&1

Write-Host ""
Write-Host "--- 5. COMMIT REMOTI NON ANCORA LOCALI ---" -ForegroundColor Yellow
$remoteCommits = git log HEAD..origin/master --oneline 2>&1
if ($remoteCommits -and $remoteCommits -notmatch "fatal") {
    Write-Host "Ci sono commit su GitHub che non hai localmente:" -ForegroundColor Red
    Write-Host $remoteCommits
} else {
    Write-Host "Nessun commit remoto da scaricare (OK)" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- 6. COMMIT LOCALI NON ANCORA REMOTI ---" -ForegroundColor Yellow
$localCommits = git log origin/master..HEAD --oneline 2>&1
if ($localCommits -and $localCommits -notmatch "fatal") {
    Write-Host "Ci sono commit locali che non sono su GitHub:" -ForegroundColor Red
    Write-Host $localCommits
} else {
    Write-Host "Nessun commit locale da caricare (OK)" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- 7. HASH COMMIT ATTUALE ---" -ForegroundColor Yellow
$localHash = git rev-parse HEAD 2>&1
$remoteHash = git rev-parse origin/master 2>&1

Write-Host "Locale:  $localHash"
Write-Host "Remoto:  $remoteHash"

if ($localHash -eq $remoteHash) {
    Write-Host ""
    Write-Host "✅ REPOSITORY PERFETTAMENTE SINCRONIZZATO!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ Repository NON sincronizzato!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== FINE VERIFICA ===" -ForegroundColor Cyan



