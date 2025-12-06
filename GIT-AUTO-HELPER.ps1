# ============================================
# HELPER PER COMANDI GIT AUTOMATICI
# ============================================
# Questo script esegue comandi git e salva
# l'output in un file così può essere letto
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("pull", "push", "status", "fetch", "sync")]
    [string]$Azione
)

$ErrorActionPreference = "Continue"
$outputFile = "git-output-last.txt"
$repoPath = "c:\spediresicuro-master\spediresicuro"

# Disabilita pager Git
$env:GIT_PAGER = ""
$env:PAGER = ""

# Vai nella cartella
if (Test-Path $repoPath) {
    Set-Location $repoPath
} else {
    Write-Output "ERRORE: Cartella non trovata" | Out-File $outputFile
    exit 1
}

# Esegui l'azione richiesta
switch ($Azione) {
    "pull" {
        Write-Output "=== PULL AUTOMATICO ===" | Out-File $outputFile
        Write-Output "" | Out-File -Append $outputFile
        git fetch origin 2>&1 | Out-File -Append $outputFile
        git pull origin master 2>&1 | Out-File -Append $outputFile
    }
    
    "push" {
        Write-Output "=== PUSH AUTOMATICO ===" | Out-File $outputFile
        Write-Output "" | Out-File -Append $outputFile
        git add -A 2>&1 | Out-File -Append $outputFile
        git commit -m "chore: aggiornamento automatico" 2>&1 | Out-File -Append $outputFile
        git push origin master 2>&1 | Out-File -Append $outputFile
    }
    
    "status" {
        Write-Output "=== STATO REPOSITORY ===" | Out-File $outputFile
        Write-Output "" | Out-File -Append $outputFile
        git status 2>&1 | Out-File -Append $outputFile
        git log --oneline -3 2>&1 | Out-File -Append $outputFile
    }
    
    "fetch" {
        Write-Output "=== FETCH REMOTO ===" | Out-File $outputFile
        Write-Output "" | Out-File -Append $outputFile
        git fetch origin 2>&1 | Out-File -Append $outputFile
        git log HEAD..origin/master --oneline 2>&1 | Out-File -Append $outputFile
    }
    
    "sync" {
        Write-Output "=== SINCRONIZZAZIONE COMPLETA ===" | Out-File $outputFile
        Write-Output "" | Out-File -Append $outputFile
        
        Write-Output "--- FETCH ---" | Out-File -Append $outputFile
        git fetch origin 2>&1 | Out-File -Append $outputFile
        
        Write-Output "" | Out-File -Append $outputFile
        Write-Output "--- PULL ---" | Out-File -Append $outputFile
        git pull origin master 2>&1 | Out-File -Append $outputFile
        
        Write-Output "" | Out-File -Append $outputFile
        Write-Output "--- STATUS ---" | Out-File -Append $outputFile
        git status 2>&1 | Out-File -Append $outputFile
        
        Write-Output "" | Out-File -Append $outputFile
        Write-Output "--- ADD E COMMIT ---" | Out-File -Append $outputFile
        git add -A 2>&1 | Out-File -Append $outputFile
        git commit -m "chore: sync automatico" 2>&1 | Out-File -Append $outputFile
        
        Write-Output "" | Out-File -Append $outputFile
        Write-Output "--- PUSH ---" | Out-File -Append $outputFile
        git push origin master 2>&1 | Out-File -Append $outputFile
    }
}

Write-Output "Comando eseguito. Output salvato in: $outputFile"

