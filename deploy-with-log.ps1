# Script PowerShell con logging completo
$logFile = "deploy-log.txt"
$ErrorActionPreference = "Continue"

function Write-Log {
    param($message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

Write-Log "=========================================="
Write-Log "INIZIO DEPLOY SEZIONE ANNE"
Write-Log "=========================================="

# Vai nella cartella corretta
Set-Location "c:\spediresicuro-master\spediresicuro"
Write-Log "Cartella: $(Get-Location)"

# Verifica Git
Write-Log "Verifica Git..."
try {
    $gitVersion = git --version 2>&1 | Out-String
    Write-Log "Git trovato: $gitVersion"
} catch {
    Write-Log "ERRORE: Git non trovato!"
    exit 1
}

# Verifica file
Write-Log "Verifica file..."
$file1 = "components/homepage/anne-promo-section.tsx"
$file2 = "app/page.tsx"

if (Test-Path $file1) {
    Write-Log "OK: $file1 esiste"
} else {
    Write-Log "ERRORE: $file1 NON esiste!"
    exit 1
}

if (Test-Path $file2) {
    Write-Log "OK: $file2 esiste"
} else {
    Write-Log "ERRORE: $file2 NON esiste!"
    exit 1
}

# Stato iniziale
Write-Log "Stato iniziale repository..."
$status = git status --porcelain 2>&1 | Out-String
Write-Log "Status: $status"

# Aggiungi file
Write-Log "Aggiunta file..."
try {
    git add $file1 2>&1 | Out-String | ForEach-Object { Write-Log "OUT: $_" }
    git add $file2 2>&1 | Out-String | ForEach-Object { Write-Log "OUT: $_" }
    Write-Log "File aggiunti"
} catch {
    Write-Log "ERRORE durante git add: $_"
    exit 1
}

# Verifica file staged
Write-Log "File staged..."
$staged = git status --short 2>&1 | Out-String
Write-Log "Staged: $staged"

# Commit
Write-Log "Commit..."
try {
    $commitOutput = git commit -m "Aggiunta sezione promozionale Anne sulla homepage" 2>&1 | Out-String
    Write-Log "Commit output: $commitOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Commit completato con successo"
    } else {
        Write-Log "ATTENZIONE: Commit potrebbe essere fallito o già fatto (exit code: $LASTEXITCODE)"
    }
} catch {
    Write-Log "ERRORE durante commit: $_"
}

# Verifica commit
Write-Log "Ultimo commit..."
$lastCommit = git log --oneline -1 2>&1 | Out-String
Write-Log "Last commit: $lastCommit"

# Push
Write-Log "Push su origin/master..."
try {
    $pushOutput = git push origin master 2>&1 | Out-String
    Write-Log "Push output: $pushOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "=========================================="
        Write-Log "PUSH COMPLETATO CON SUCCESSO!"
        Write-Log "=========================================="
        Write-Log "Vercel dovrebbe avviare il deploy automaticamente"
    } else {
        Write-Log "ERRORE durante push (exit code: $LASTEXITCODE)"
        Write-Log "Output: $pushOutput"
    }
} catch {
    Write-Log "ERRORE durante push: $_"
}

Write-Log "=========================================="
Write-Log "FINE SCRIPT"
Write-Log "=========================================="
Write-Log ""
Write-Log "Controlla il file deploy-log.txt per i dettagli completi"

