# Script PowerShell per forzare commit e push
$ErrorActionPreference = "Stop"
Set-Location "d:\spediresicuro-master"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FORZA COMMIT E PUSH REALE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica stato
Write-Host "1. Verifica stato repository..." -ForegroundColor Yellow
$status = git status --porcelain
Write-Host "File modificati:" -ForegroundColor Yellow
$status | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "2. Aggiungo tutti i file..." -ForegroundColor Yellow
git add -A

Write-Host ""
Write-Host "3. Verifica file staged..." -ForegroundColor Yellow
$staged = git diff --cached --name-only
$staged | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "4. Creo commit..." -ForegroundColor Yellow
$commitMsg = "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo"
git commit -m $commitMsg

Write-Host ""
Write-Host "5. Push su GitHub..." -ForegroundColor Yellow
git push origin master

Write-Host ""
Write-Host "6. Verifica finale..." -ForegroundColor Yellow
$lastCommit = git log --oneline -1
Write-Host "Ultimo commit: $lastCommit" -ForegroundColor Green

$headHash = git rev-parse HEAD
$remoteHash = git rev-parse origin/master
Write-Host "HEAD locale: $headHash" -ForegroundColor Green
Write-Host "HEAD remoto: $remoteHash" -ForegroundColor Green

if ($headHash -eq $remoteHash) {
    Write-Host ""
    Write-Host "✅ SUCCESSO: Repository sincronizzato!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ ATTENZIONE: Hash diversi, potrebbe esserci un problema" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
