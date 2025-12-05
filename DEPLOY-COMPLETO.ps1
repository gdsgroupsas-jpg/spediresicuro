# Script PowerShell completo per deploy Anne
$ErrorActionPreference = "Continue"
$logFile = "deploy-completo-log.txt"

function Write-Log {
    param($message, [switch]$NoNewline)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $message"
    if ($NoNewline) {
        Write-Host $logMessage -NoNewline
        Add-Content -Path $logFile -Value $logMessage -NoNewline
    } else {
        Write-Host $logMessage
        Add-Content -Path $logFile -Value $logMessage
    }
}

# Pulisci log precedente
if (Test-Path $logFile) { Remove-Item $logFile }

Write-Log "=========================================="
Write-Log "DEPLOY SEZIONE PROMOZIONALE ANNE"
Write-Log "=========================================="
Write-Log ""

# Vai nella cartella corretta
Set-Location "c:\spediresicuro-master\spediresicuro"
Write-Log "Cartella corrente: $(Get-Location)"
Write-Log ""

# Verifica Git
Write-Log "[1/6] Verifica Git..."
try {
    $gitVersion = & git --version 2>&1
    Write-Log "  Git trovato: $gitVersion"
} catch {
    Write-Log "  ERRORE: Git non trovato!"
    exit 1
}
Write-Log ""

# Verifica file
Write-Log "[2/6] Verifica file..."
$file1 = "components/homepage/anne-promo-section.tsx"
$file2 = "app/page.tsx"

if (Test-Path $file1) {
    Write-Log "  ✅ $file1 esiste"
} else {
    Write-Log "  ❌ $file1 NON esiste!"
    exit 1
}

if (Test-Path $file2) {
    Write-Log "  ✅ $file2 esiste"
} else {
    Write-Log "  ❌ $file2 NON esiste!"
    exit 1
}
Write-Log ""

# Stato iniziale
Write-Log "[3/6] Stato repository PRIMA..."
$statusBefore = & git status --porcelain 2>&1 | Out-String
Write-Log "  Status: $statusBefore"
Write-Log ""

# Aggiungi file
Write-Log "[4/6] Aggiunta file a Git..."
try {
    $add1 = & git add $file1 2>&1 | Out-String
    $add2 = & git add $file2 2>&1 | Out-String
    Write-Log "  File aggiunti"
} catch {
    Write-Log "  ERRORE durante git add: $_"
    exit 1
}

# Verifica file staged
$statusAfter = & git status --short 2>&1 | Out-String
Write-Log "  File staged: $statusAfter"
Write-Log ""

# Commit
Write-Log "[5/6] Commit..."
try {
    $commitOutput = & git commit -m "Aggiunta sezione promozionale Anne sulla homepage" 2>&1 | Out-String
    Write-Log "  Output commit: $commitOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "  ✅ Commit completato con successo"
    } else {
        Write-Log "  ⚠️  Commit potrebbe essere fallito (exit code: $LASTEXITCODE)"
    }
} catch {
    Write-Log "  ERRORE durante commit: $_"
}

# Verifica commit
$lastCommit = & git log --oneline -1 2>&1 | Out-String
Write-Log "  Ultimo commit: $lastCommit"
Write-Log ""

# Push
Write-Log "[6/6] Push su origin/master..."
try {
    $pushOutput = & git push origin master 2>&1 | Out-String
    Write-Log "  Output push: $pushOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log ""
        Write-Log "=========================================="
        Write-Log "✅✅✅ PUSH COMPLETATO CON SUCCESSO! ✅✅✅"
        Write-Log "=========================================="
        Write-Log ""
        Write-Log "🔄 Vercel dovrebbe avviare il deploy automaticamente..."
        Write-Log "⏱️  Il deploy richiede circa 2-5 minuti"
        Write-Log ""
        Write-Log "🌐 Verifica il deploy su: https://vercel.com/dashboard"
        Write-Log "📱 Dopo il deploy, controlla la homepage del tuo sito"
    } else {
        Write-Log ""
        Write-Log "❌ ERRORE durante push (exit code: $LASTEXITCODE)"
        Write-Log "Output: $pushOutput"
    }
} catch {
    Write-Log ""
    Write-Log "❌ ERRORE durante push: $_"
}

Write-Log ""
Write-Log "=========================================="
Write-Log "FINE SCRIPT"
Write-Log "=========================================="
Write-Log ""
Write-Log "Log completo salvato in: $logFile"

# Mostra il log
Write-Host ""
Write-Host "Premi un tasto per vedere il log completo..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Get-Content $logFile

