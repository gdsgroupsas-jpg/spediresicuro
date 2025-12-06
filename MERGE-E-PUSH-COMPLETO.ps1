# Script PowerShell per merge e push automatico
$ErrorActionPreference = "Continue"
Set-Location "d:\spediresicuro-master"

$logFile = "merge-push-log.txt"
"========================================" | Out-File $logFile -Encoding utf8
"  MERGE E PUSH AUTOMATICO" | Out-File $logFile -Append -Encoding utf8
"  Data: $(Get-Date)" | Out-File $logFile -Append -Encoding utf8
"========================================" | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MERGE E PUSH AUTOMATICO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# [1] Configurazione Git
Write-Host "[1] Configurazione Git..." -ForegroundColor Yellow
git config user.name "gdsgroupsas-jpg" | Out-File $logFile -Append -Encoding utf8
git config user.email "gdsgroupsas-jpg@users.noreply.github.com" | Out-File $logFile -Append -Encoding utf8
git config core.pager "" | Out-File $logFile -Append -Encoding utf8
"[1] Configurazione Git completata" | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# [2] Fetch da GitHub
Write-Host "[2] Fetch da GitHub..." -ForegroundColor Yellow
$fetchOutput = git fetch origin 2>&1 | Out-String
$fetchOutput | Out-File $logFile -Append -Encoding utf8
"[2] Fetch completato" | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# [3] Verifica branch
Write-Host "[3] Verifica branch..." -ForegroundColor Yellow
$branches = git branch -a 2>&1 | Out-String
$branches | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

$remoteBranches = git branch -r 2>&1 | Out-String
"[3] Branch remoti:" | Out-File $logFile -Append -Encoding utf8
$remoteBranches | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# [4] Verifica stato
Write-Host "[4] Verifica stato repository..." -ForegroundColor Yellow
$status = git status 2>&1 | Out-String
$status | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# [5] Aggiungi file
Write-Host "[5] Aggiungo tutti i file..." -ForegroundColor Yellow
git add -A 2>&1 | Out-File $logFile -Append -Encoding utf8
"[5] File aggiunti" | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# [6] Verifica file staged
$staged = git diff --cached --name-only 2>&1 | Out-String
if ($staged.Trim()) {
    "[6] File da committare:" | Out-File $logFile -Append -Encoding utf8
    $staged | Out-File $logFile -Append -Encoding utf8
} else {
    "[6] Nessun file da committare" | Out-File $logFile -Append -Encoding utf8
}
"" | Out-File $logFile -Append -Encoding utf8

# [7] Commit
Write-Host "[7] Creo commit..." -ForegroundColor Yellow
$commitOutput = git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo" 2>&1 | Out-String
$commitOutput | Out-File $logFile -Append -Encoding utf8
if ($LASTEXITCODE -eq 0) {
    "[7] Commit completato" | Out-File $logFile -Append -Encoding utf8
} else {
    "[7] Commit non necessario o fallito" | Out-File $logFile -Append -Encoding utf8
}
"" | Out-File $logFile -Append -Encoding utf8

# [8] Verifica branch da mergiare
Write-Host "[8] Verifica branch da mergiare..." -ForegroundColor Yellow
$allRemoteBranches = git branch -r 2>&1 | Where-Object { $_ -notmatch "HEAD" -and $_ -notmatch "origin/master" }
"[8] Branch remoti trovati (escluso master):" | Out-File $logFile -Append -Encoding utf8
$allRemoteBranches | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

# Merge branch roles-badges-sync-06022 se esiste
if ($allRemoteBranches -match "roles-badges-sync-06022") {
    Write-Host "[9] Merge branch roles-badges-sync-06022..." -ForegroundColor Yellow
    "[9] Merge branch roles-badges-sync-06022" | Out-File $logFile -Append -Encoding utf8
    $mergeOutput = git merge origin/roles-badges-sync-06022 --no-edit 2>&1 | Out-String
    $mergeOutput | Out-File $logFile -Append -Encoding utf8
    if ($LASTEXITCODE -eq 0) {
        "[9] Merge completato" | Out-File $logFile -Append -Encoding utf8
    } else {
        "[9] Merge non necessario o con conflitti" | Out-File $logFile -Append -Encoding utf8
    }
    "" | Out-File $logFile -Append -Encoding utf8
}

# [10] Push
Write-Host "[10] Push su GitHub..." -ForegroundColor Yellow
"[10] Push su GitHub" | Out-File $logFile -Append -Encoding utf8
$pushOutput = git push origin master 2>&1 | Out-String
$pushOutput | Out-File $logFile -Append -Encoding utf8
if ($LASTEXITCODE -eq 0) {
    "[10] Push completato" | Out-File $logFile -Append -Encoding utf8
} else {
    "[10] Push fallito - controlla autenticazione" | Out-File $logFile -Append -Encoding utf8
}
"" | Out-File $logFile -Append -Encoding utf8

# [11] Verifica finale
Write-Host "[11] Verifica finale..." -ForegroundColor Yellow
"[11] Verifica finale" | Out-File $logFile -Append -Encoding utf8
$lastCommit = git log --oneline -3 2>&1 | Out-String
$lastCommit | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

$headHash = git rev-parse HEAD 2>&1 | Out-String
$remoteHash = git rev-parse origin/master 2>&1 | Out-String
"HEAD locale: $headHash" | Out-File $logFile -Append -Encoding utf8
"HEAD remoto: $remoteHash" | Out-File $logFile -Append -Encoding utf8
"" | Out-File $logFile -Append -Encoding utf8

"========================================" | Out-File $logFile -Append -Encoding utf8
"  FINE" | Out-File $logFile -Append -Encoding utf8
"========================================" | Out-File $logFile -Append -Encoding utf8

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMPLETATO - Controlla merge-push-log.txt" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Mostra il log
Get-Content $logFile
