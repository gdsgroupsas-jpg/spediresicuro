# Script PowerShell per Commit e Push Automatico
# Risolve il problema ricorrente del push che non funziona

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMMIT E PUSH AUTOMATICO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vai nella directory del progetto
Set-Location "d:\spediresicuro-master"

# Configura Git per evitare problemi
$env:GIT_TERMINAL_PROMPT = 0
$env:GIT_ASKPASS = ""

# Verifica stato
Write-Host "[1] Verifica stato Git..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "Modifiche trovate:" -ForegroundColor Green
    Write-Host $status
} else {
    Write-Host "Nessuna modifica da committare" -ForegroundColor Gray
}

# Verifica commit locali non pushati
Write-Host ""
Write-Host "[2] Verifica commit locali..." -ForegroundColor Yellow
$localCommits = git log origin/master..HEAD --oneline
if ($localCommits) {
    Write-Host "Commit locali da pushare:" -ForegroundColor Green
    Write-Host $localCommits
} else {
    Write-Host "Nessun commit locale da pushare" -ForegroundColor Gray
}

# Se ci sono modifiche, fai add e commit
if ($status) {
    Write-Host ""
    Write-Host "[3] Aggiunta file modificati..." -ForegroundColor Yellow
    git add .
    
    Write-Host "[4] Creazione commit..." -ForegroundColor Yellow
    $commitMessage = "Fix: Aggiornamento automatico - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRORE: Commit fallito!" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: Commit completato" -ForegroundColor Green
}

# Push con retry
Write-Host ""
Write-Host "[5] Push su GitHub..." -ForegroundColor Yellow

# Prova push con output dettagliato
$pushOutput = git push origin master 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -eq 0) {
    Write-Host "OK: Push completato con successo!" -ForegroundColor Green
} else {
    Write-Host "ERRORE: Push fallito" -ForegroundColor Red
    Write-Host "Output:" -ForegroundColor Yellow
    Write-Host $pushOutput
    
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "1. Autenticazione GitHub richiesta"
    Write-Host "2. Connessione internet"
    Write-Host "3. Conflitti con remoto"
    Write-Host ""
    Write-Host "SOLUZIONE:" -ForegroundColor Cyan
    Write-Host "Esegui manualmente: git push origin master" -ForegroundColor White
    Write-Host "Se richiede autenticazione, usa un Personal Access Token GitHub" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OPERAZIONE COMPLETATA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: https://github.com/gdsgroupsas-jpg/spediresicuro" -ForegroundColor Cyan
Write-Host ""


