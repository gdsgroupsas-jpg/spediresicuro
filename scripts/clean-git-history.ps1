# Script per rimuovere API key dalla storia Git
# ⚠️ ATTENZIONE: Riscrive la storia Git!
#
# ⚠️ SECURITY: Le API key devono essere fornite via variabili d'ambiente!
# Uso: $env:GIT_CLEANUP_API_KEY_1 = 'key1'; $env:GIT_CLEANUP_API_KEY_2 = 'key2'; .\scripts\clean-git-history.ps1

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

if (-not $Force) {
    Write-Host "⚠️ ATTENZIONE: Questo script riscriverà la storia Git!" -ForegroundColor Red
    Write-Host "Le API key verranno rimosse da TUTTI i commit nella storia." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Sei sicuro? (scrivi 'SI' per confermare)"
    
    if ($confirm -ne "SI") {
        Write-Host "Operazione annullata." -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "🔍 Creazione backup..." -ForegroundColor Cyan
$backupBranch = "backup-before-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git branch $backupBranch
Write-Host "✅ Backup: $backupBranch" -ForegroundColor Green

Write-Host ""
Write-Host "🧹 Rimozione API key dalla storia Git..." -ForegroundColor Cyan
Write-Host "Questo richiedera tempo (molti commit da processare)..." -ForegroundColor Yellow

# ⚠️ SECURITY: Leggi API key da variabili d'ambiente, mai hardcoded!
$apiKey1 = $env:GIT_CLEANUP_API_KEY_1
$apiKey2 = $env:GIT_CLEANUP_API_KEY_2

if (-not $apiKey1 -or -not $apiKey2) {
    Write-Host "❌ API key mancanti!" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Imposta le variabili d'ambiente:" -ForegroundColor Yellow
    Write-Host "   `$env:GIT_CLEANUP_API_KEY_1 = 'prima-api-key'" -ForegroundColor Cyan
    Write-Host "   `$env:GIT_CLEANUP_API_KEY_2 = 'seconda-api-key'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️ NON committare mai le API key nel codice!" -ForegroundColor Red
    exit 1
}

# Crea script di filtro con API key passate come variabili d'ambiente
# Usa @"..."@ per permettere interpolazione delle variabili
$filterCode = @"
`$apiKey1 = `$env:GIT_CLEANUP_API_KEY_1
`$apiKey2 = `$env:GIT_CLEANUP_API_KEY_2

if (-not `$apiKey1 -or -not `$apiKey2) {
    Write-Error "API key non configurate nello script di filtro"
    exit 1
}

`$files = Get-ChildItem -Recurse -Include *.ts,*.js,*.tsx,*.jsx -File -ErrorAction SilentlyContinue
foreach (`$file in `$files) {
    if (Test-Path `$file.FullName) {
        try {
            `$content = Get-Content `$file.FullName -Raw -ErrorAction SilentlyContinue
            if (`$content) {
                `$new = `$content -replace [regex]::Escape(`$apiKey1), '[API_KEY_REMOVED]' -replace [regex]::Escape(`$apiKey2), '[API_KEY_REMOVED]'
                if (`$content -ne `$new) {
                    Set-Content `$file.FullName -Value `$new -NoNewline -ErrorAction SilentlyContinue
                }
            }
        } catch {}
    }
}
"@

$tempFile = Join-Path $env:TEMP "git-filter-$(Get-Random).ps1"
$filterCode | Out-File -FilePath $tempFile -Encoding UTF8

$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
$env:GIT_CLEANUP_API_KEY_1 = $apiKey1
$env:GIT_CLEANUP_API_KEY_2 = $apiKey2
$absPath = (Resolve-Path $tempFile).Path

Write-Host "  Esecuzione git filter-branch..." -ForegroundColor Cyan
Write-Host "  (Questo richiedera diversi minuti, sii paziente...)" -ForegroundColor Yellow

$result = git filter-branch --force --tree-filter "powershell -ExecutionPolicy Bypass -File `"$absPath`"" --prune-empty --tag-name-filter cat -- --all 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Completato" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🧹 Pulizia riferimenti..." -ForegroundColor Cyan
    git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin 2>&1 | Out-Null
    git reflog expire --expire=now --all 2>&1 | Out-Null
    git gc --prune=now --aggressive 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "✅ Completato!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Prossimi passi:" -ForegroundColor Cyan
    Write-Host "  1. Verifica: git log -p --all -S '[API_KEY_REMOVED]' | Select-String 'API_KEY_REMOVED' | Select-Object -First 3"
    Write-Host "  2. Se OK: git push --force --all"
    Write-Host "  3. Collaboratori: git fetch --all && git reset --hard origin/master"
    Write-Host ""
    Write-Host "⚠️ RUOTA le API key su Spedisci.Online!" -ForegroundColor Red
} else {
    Write-Host "  ❌ Errore durante filter-branch" -ForegroundColor Red
    Write-Host "  Verifica manualmente l'output sopra" -ForegroundColor Yellow
}

if (Test-Path $tempFile) {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

# Pulisci variabili d'ambiente dalla sessione corrente
Remove-Item Env:\GIT_CLEANUP_API_KEY_1 -ErrorAction SilentlyContinue
Remove-Item Env:\GIT_CLEANUP_API_KEY_2 -ErrorAction SilentlyContinue
