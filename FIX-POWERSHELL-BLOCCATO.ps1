# ========================================
# 🔧 FIX POWERSHELL BLOCCATO
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🔧 FIX POWERSHELL BLOCCATO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Chiudi processi PowerShell bloccati
Write-Host "1. Cercando processi PowerShell bloccati..." -ForegroundColor Yellow
$psProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID }
if ($psProcesses) {
    Write-Host "   ⚠️  Trovati $($psProcesses.Count) processi PowerShell" -ForegroundColor Yellow
    $psProcesses | ForEach-Object {
        Write-Host "   - PID: $($_.Id) | StartTime: $($_.StartTime)" -ForegroundColor Gray
    }
    Write-Host ""
    $response = Read-Host "   Chiudere tutti i processi PowerShell? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        $psProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Processi PowerShell chiusi" -ForegroundColor Green
    }
} else {
    Write-Host "   ✅ Nessun processo PowerShell bloccato" -ForegroundColor Green
}
Write-Host ""

# 2. Chiudi processi Git bloccati
Write-Host "2. Cercando processi Git bloccati..." -ForegroundColor Yellow
$gitProcesses = Get-Process git -ErrorAction SilentlyContinue
if ($gitProcesses) {
    Write-Host "   ⚠️  Trovati $($gitProcesses.Count) processi Git" -ForegroundColor Yellow
    $gitProcesses | ForEach-Object {
        Write-Host "   - PID: $($_.Id) | StartTime: $($_.StartTime)" -ForegroundColor Gray
    }
    Write-Host ""
    $response = Read-Host "   Chiudere tutti i processi Git? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        $gitProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Processi Git chiusi" -ForegroundColor Green
    }
} else {
    Write-Host "   ✅ Nessun processo Git bloccato" -ForegroundColor Green
}
Write-Host ""

# 3. Vai nella directory del progetto
$repoPath = "d:\spediresicuro-master"
if (Test-Path $repoPath) {
    Set-Location $repoPath
    Write-Host "3. Directory cambiata: $repoPath" -ForegroundColor Green
} else {
    Write-Host "3. ❌ Directory non trovata: $repoPath" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Rimuovi lock Git
Write-Host "4. Rimuovendo lock Git..." -ForegroundColor Yellow
$locks = @(
    ".git\index.lock",
    ".git\.MERGE_MSG.swp"
)

foreach ($lock in $locks) {
    if (Test-Path $lock) {
        try {
            Remove-Item $lock -Force -ErrorAction Stop
            Write-Host "   ✅ Rimosso: $lock" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile rimuovere: $lock - $_" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# 5. Aborti operazioni Git in corso
Write-Host "5. Verificando operazioni Git in corso..." -ForegroundColor Yellow

if (Test-Path ".git\REBASE_HEAD") {
    Write-Host "   ⚠️  Trovato REBASE_HEAD - rebase in corso" -ForegroundColor Yellow
    $response = Read-Host "   Abortire il rebase? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        try {
            git rebase --abort 2>&1 | Out-Null
            Write-Host "   ✅ Rebase abortito" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile abortire rebase" -ForegroundColor Yellow
        }
    }
}

if (Test-Path ".git\MERGE_HEAD") {
    Write-Host "   ⚠️  Trovato MERGE_HEAD - merge in corso" -ForegroundColor Yellow
    $response = Read-Host "   Abortire il merge? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        try {
            git merge --abort 2>&1 | Out-Null
            Write-Host "   ✅ Merge abortito" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile abortire merge" -ForegroundColor Yellow
        }
    }
}

if (-not (Test-Path ".git\REBASE_HEAD") -and -not (Test-Path ".git\MERGE_HEAD")) {
    Write-Host "   ✅ Nessuna operazione Git in corso" -ForegroundColor Green
}
Write-Host ""

# 6. Verifica Execution Policy
Write-Host "6. Verificando Execution Policy..." -ForegroundColor Yellow
$currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
Write-Host "   Current User Policy: $currentPolicy" -ForegroundColor Gray

if ($currentPolicy -eq "Restricted") {
    Write-Host "   ⚠️  Execution Policy è Restricted" -ForegroundColor Yellow
    $response = Read-Host "   Impostare Execution Policy a RemoteSigned? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        try {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Write-Host "   ✅ Execution Policy impostato a RemoteSigned" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Impossibile cambiare Execution Policy: $_" -ForegroundColor Yellow
            Write-Host "   Esegui manualmente come Administrator:" -ForegroundColor Cyan
            Write-Host "   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ✅ Execution Policy OK: $currentPolicy" -ForegroundColor Green
}
Write-Host ""

# 7. Test PowerShell
Write-Host "7. Test esecuzione PowerShell..." -ForegroundColor Yellow
try {
    $testResult = Get-Date
    Write-Host "   ✅ PowerShell funziona correttamente!" -ForegroundColor Green
    Write-Host "   Test: $testResult" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Errore PowerShell: $_" -ForegroundColor Red
}
Write-Host ""

# 8. Verifica stato Git
Write-Host "8. Verificando stato Git..." -ForegroundColor Yellow
try {
    $gitStatus = git status --porcelain 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Git funziona correttamente" -ForegroundColor Green
        if ($gitStatus) {
            Write-Host "   File modificati:" -ForegroundColor Cyan
            $gitStatus | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
        } else {
            Write-Host "   Nessun file modificato" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  Git ha restituito un errore" -ForegroundColor Yellow
        Write-Host "   Output: $gitStatus" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Errore Git: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ PULIZIA COMPLETATA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ora puoi provare a eseguire:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File commit-push-fix-completo.ps1" -ForegroundColor Cyan
Write-Host ""

