# ========================================
# 🔧 FIX GIT CONNECTION - Diagnostica Completa
# ========================================

$LogFile = "git-diagnostic.log"
$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

Write-Log "=========================================="
Write-Log "🔧 DIAGNOSTICA GIT COMPLETA"
Write-Log "=========================================="
Write-Log ""

# Cambia directory
$repoPath = "d:\spediresicuro-master"
if (Test-Path $repoPath) {
    Set-Location $repoPath
    Write-Log "✅ Directory cambiata: $repoPath"
} else {
    Write-Log "❌ Directory non trovata: $repoPath"
    exit 1
}

# Disabilita pager Git
$env:GIT_PAGER = ""
$env:PAGER = ""
git config core.pager ""

Write-Log ""
Write-Log "1. VERIFICA GIT INSTALLATO"
Write-Log "---------------------------"
try {
    $gitVersion = git --version 2>&1 | Out-String
    Write-Log "Git Version: $gitVersion"
} catch {
    Write-Log "❌ Git non installato o non nel PATH"
    exit 1
}

Write-Log ""
Write-Log "2. VERIFICA CONFIGURAZIONE GIT"
Write-Log "---------------------------"
$gitUser = git config user.name 2>&1 | Out-String
$gitEmail = git config user.email 2>&1 | Out-String
Write-Log "User Name: $gitUser"
Write-Log "User Email: $gitEmail"

# Fix account se necessario
if ([string]::IsNullOrWhiteSpace($gitUser) -or $gitUser.Trim() -ne "gdsgroupsas-jpg") {
    Write-Log "⚠️  Configurando user.name..."
    git config user.name "gdsgroupsas-jpg"
    Write-Log "✅ user.name configurato"
}

if ([string]::IsNullOrWhiteSpace($gitEmail)) {
    Write-Log "⚠️  Configurando user.email..."
    git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
    Write-Log "✅ user.email configurato"
}

Write-Log ""
Write-Log "3. VERIFICA REMOTE"
Write-Log "---------------------------"
$remotes = git remote -v 2>&1 | Out-String
Write-Log "Remotes: $remotes"

if ($remotes -notmatch "origin") {
    Write-Log "❌ Remote origin non trovato!"
    git remote add origin https://github.com/gdsgroupsas-jpg/spediresicuro.git
    Write-Log "✅ Remote origin aggiunto"
}

Write-Log ""
Write-Log "4. VERIFICA BRANCH"
Write-Log "---------------------------"
$branch = git branch --show-current 2>&1 | Out-String
Write-Log "Current Branch: $branch"

if ([string]::IsNullOrWhiteSpace($branch)) {
    Write-Log "⚠️  Nessun branch trovato, controllando..."
    $branches = git branch 2>&1 | Out-String
    Write-Log "Branches disponibili: $branches"
}

Write-Log ""
Write-Log "5. VERIFICA STATO REPOSITORY"
Write-Log "---------------------------"
$status = git status 2>&1 | Out-String
Write-Log "Git Status: $status"

Write-Log ""
Write-Log "6. VERIFICA FILE MODIFICATI"
Write-Log "---------------------------"
$modified = git diff --name-only 2>&1 | Out-String
$staged = git diff --cached --name-only 2>&1 | Out-String

if (-not [string]::IsNullOrWhiteSpace($modified.Trim())) {
    Write-Log "File modificati (non staged):"
    Write-Log $modified
} else {
    Write-Log "Nessun file modificato (non staged)"
}

if (-not [string]::IsNullOrWhiteSpace($staged.Trim())) {
    Write-Log "File staged:"
    Write-Log $staged
} else {
    Write-Log "Nessun file staged"
}

Write-Log ""
Write-Log "7. VERIFICA COMMIT LOCALI"
Write-Log "---------------------------"
$localCommits = git log origin/master..HEAD --oneline 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($localCommits.Trim())) {
    Write-Log "Commit locali non pushati:"
    Write-Log $localCommits
} else {
    Write-Log "Nessun commit locale da pushare"
}

Write-Log ""
Write-Log "8. TEST CONNESSIONE GITHUB"
Write-Log "---------------------------"
try {
    Write-Log "Tentativo fetch da GitHub..."
    $fetchOutput = git fetch origin master 2>&1 | Out-String
    Write-Log "Fetch Output: $fetchOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✅ Connessione a GitHub OK"
    } else {
        Write-Log "⚠️  Problema con fetch (potrebbe essere autenticazione)"
        if ($fetchOutput -match "authentication|credential|403|401") {
            Write-Log "❌ ERRORE: Problema di autenticazione!"
            Write-Log "SOLUZIONE:"
            Write-Log "1. Vai su: https://github.com/settings/tokens"
            Write-Log "2. Crea Personal Access Token (classic)"
            Write-Log "3. Seleziona permessi: repo (tutti)"
            Write-Log "4. Quando Git chiede password, usa il TOKEN"
        }
    }
} catch {
    Write-Log "❌ Errore durante fetch: $_"
}

Write-Log ""
Write-Log "9. VERIFICA FILE DA COMMITTARE"
Write-Log "---------------------------"
$filesToAdd = @()
$filesToAdd += "components/dashboard-nav.tsx"
$filesToAdd += "supabase/migrations/021_verify_fix_account_type_config.sql"

foreach ($file in $filesToAdd) {
    if (Test-Path $file) {
        $fileStatus = git status --short $file 2>&1 | Out-String
        if (-not [string]::IsNullOrWhiteSpace($fileStatus.Trim())) {
            Write-Log "✅ $file - modificato"
        } else {
            Write-Log "ℹ️  $file - nessuna modifica o già committato"
        }
    } else {
        Write-Log "❌ $file - file non trovato"
    }
}

Write-Log ""
Write-Log "10. TENTATIVO ADD E COMMIT"
Write-Log "---------------------------"
try {
    Write-Log "Aggiungendo file..."
    git add components/dashboard-nav.tsx 2>&1 | Out-String
    git add supabase/migrations/021_verify_fix_account_type_config.sql 2>&1 | Out-String
    
    $stagedAfter = git diff --cached --name-only 2>&1 | Out-String
    if (-not [string]::IsNullOrWhiteSpace($stagedAfter.Trim())) {
        Write-Log "✅ File aggiunti allo staging"
        Write-Log "File staged: $stagedAfter"
        
        Write-Log ""
        Write-Log "Facendo commit..."
        $commitMsg = "Fix: Aggiunto controllo accountType per accesso sezione Admin e script SQL di verifica"
        $commitOutput = git commit -m $commitMsg 2>&1 | Out-String
        Write-Log "Commit Output: $commitOutput"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Commit completato!"
        } else {
            Write-Log "⚠️  Commit fallito o non necessario"
        }
    } else {
        Write-Log "⚠️  Nessun file da committare (già committati o nessuna modifica)"
    }
} catch {
    Write-Log "❌ Errore durante add/commit: $_"
}

Write-Log ""
Write-Log "11. TENTATIVO PUSH"
Write-Log "---------------------------"
try {
    $localHash = git rev-parse HEAD 2>&1 | Out-String
    $remoteHash = git rev-parse origin/master 2>&1 | Out-String
    
    Write-Log "Local Hash: $localHash"
    Write-Log "Remote Hash: $remoteHash"
    
    if ($localHash.Trim() -ne $remoteHash.Trim()) {
        Write-Log "Tentativo push..."
        $pushOutput = git push origin master 2>&1 | Out-String
        Write-Log "Push Output: $pushOutput"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅✅✅ PUSH COMPLETATO! ✅✅✅"
        } else {
            Write-Log "⚠️  Push fallito (codice: $LASTEXITCODE)"
            Write-Log "Output: $pushOutput"
            
            if ($pushOutput -match "authentication|credential|403|401") {
                Write-Log ""
                Write-Log "❌ PROBLEMA DI AUTENTICAZIONE!"
                Write-Log ""
                Write-Log "SOLUZIONE:"
                Write-Log "1. Vai su: https://github.com/settings/tokens"
                Write-Log "2. Clicca 'Generate new token (classic)'"
                Write-Log "3. Nome: 'SpedireSicuro Push'"
                Write-Log "4. Seleziona permessi: repo (tutti)"
                Write-Log "5. Genera e COPIA il token"
                Write-Log "6. Quando Git chiede password, incolla il TOKEN"
                Write-Log "   (NON la password GitHub!)"
            }
        }
    } else {
        Write-Log "✅ Repository già sincronizzato (nessun push necessario)"
    }
} catch {
    Write-Log "❌ Errore durante push: $_"
}

Write-Log ""
Write-Log "=========================================="
Write-Log "✅ DIAGNOSTICA COMPLETATA"
Write-Log "=========================================="
Write-Log "Log salvato in: $LogFile"
Write-Log ""

