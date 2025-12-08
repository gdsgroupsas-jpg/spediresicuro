# Script DEFINITIVO per commit - Salva tutto in un file di log
# Esegui: powershell -ExecutionPolicy Bypass -File COMMIT_DEFINITIVO.ps1

$logFile = "git-commit-log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

"========================================" | Out-File -FilePath $logFile -Encoding UTF8
"COMMIT AUTOMATICO - $timestamp" | Out-File -FilePath $logFile -Append -Encoding UTF8
"========================================" | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host "🔧 Configurazione Git..." -ForegroundColor Cyan

# 1. Configura Git
git config user.name "gdsgroupsas-jpg" 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
git config user.email "gdsgroupsas-jpg@users.noreply.github.com" 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

$userName = git config user.name 2>&1
$userEmail = git config user.email 2>&1

"User configurato: $userName" | Out-File -FilePath $logFile -Append -Encoding UTF8
"Email configurata: $userEmail" | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host "✅ Git configurato: $userName" -ForegroundColor Green

# 2. Verifica stato
Write-Host "`n📋 Verifica stato Git..." -ForegroundColor Cyan
"=== STATO GIT ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git status 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

# 3. Aggiungi tutti i file
Write-Host "📦 Aggiunta file..." -ForegroundColor Cyan
"=== AGGIUNTA FILE ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git add -A 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

$status = git status --short 2>&1
if ($status) {
    "File da committare:" | Out-File -FilePath $logFile -Append -Encoding UTF8
    $status | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "File trovati:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor White
} else {
    "Nessun file da committare" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "⚠️ Nessun file da committare" -ForegroundColor Yellow
}
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

# 4. Crea commit
Write-Host "`n💾 Creazione commit..." -ForegroundColor Cyan
"=== CREAZIONE COMMIT ===" | Out-File -FilePath $logFile -Append -Encoding UTF8

$commitMessage = "fix: Rimossa proprietà env non valida da playwright.config.ts"
$commitResult = git commit -m $commitMessage 2>&1

$commitResult | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ COMMIT CREATO!" -ForegroundColor Green
    "✅ COMMIT CREATO CON SUCCESSO" | Out-File -FilePath $logFile -Append -Encoding UTF8
} else {
    Write-Host "❌ ERRORE nel commit" -ForegroundColor Red
    "❌ ERRORE NEL COMMIT" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host $commitResult -ForegroundColor Red
}

# 5. Verifica commit
Write-Host "`n🔍 Verifica commit..." -ForegroundColor Cyan
"=== VERIFICA COMMIT ===" | Out-File -FilePath $logFile -Append -Encoding UTF8
git log --oneline -1 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8
"" | Out-File -FilePath $logFile -Append -Encoding UTF8

$lastCommit = git log --oneline -1 2>&1
Write-Host "Ultimo commit:" -ForegroundColor Yellow
Write-Host $lastCommit -ForegroundColor White

Write-Host "`n✅ COMPLETATO! Controlla git-commit-log.txt per i dettagli" -ForegroundColor Green
