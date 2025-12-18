# Script per configurare GitHub Secrets automaticamente
# Requisito: GitHub CLI (gh) installato e autenticato
# Esegui: gh auth login prima di usare questo script

param(
    [switch]$DryRun
)

Write-Host "Setup GitHub Secrets per Release Guard" -ForegroundColor Cyan
Write-Host ""

# Verifica GitHub CLI
try {
    $ghVersion = gh --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI non trovato"
    }
    Write-Host "[OK] GitHub CLI trovato" -ForegroundColor Green
} catch {
    Write-Host "[ERR] GitHub CLI non installato" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installa GitHub CLI:" -ForegroundColor Yellow
    Write-Host "  winget install --id GitHub.cli"
    Write-Host "  oppure: https://cli.github.com/"
    Write-Host ""
    Write-Host "Poi autenticati:"
    Write-Host "  gh auth login"
    exit 1
}

# Verifica autenticazione
try {
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Non autenticato"
    }
    Write-Host "[OK] Autenticato su GitHub" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Non autenticato su GitHub" -ForegroundColor Red
    Write-Host ""
    Write-Host "Esegui: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Verifica .env.local
$rootPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $rootPath ".env.local"
if (-not (Test-Path $envPath)) {
    Write-Host "[ERR] File .env.local non trovato" -ForegroundColor Red
    Write-Host "   Percorso atteso: $envPath" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] File .env.local trovato" -ForegroundColor Green
Write-Host ""

# Leggi variabili da .env.local
$envContent = Get-Content $envPath -Raw

function Get-EnvValue {
    param([string]$varName)
    if ($envContent -match "(?m)^${varName}=(.+)$") {
        return $matches[1].Trim('"').Trim("'")
    }
    return $null
}

$supabaseUrl = Get-EnvValue "NEXT_PUBLIC_SUPABASE_URL"
$serviceRoleKey = Get-EnvValue "SUPABASE_SERVICE_ROLE_KEY"
$anonKey = Get-EnvValue "NEXT_PUBLIC_SUPABASE_ANON_KEY"

# Verifica variabili
$missing = @()
if (-not $supabaseUrl) { $missing += "NEXT_PUBLIC_SUPABASE_URL" }
if (-not $serviceRoleKey) { $missing += "SUPABASE_SERVICE_ROLE_KEY" }
if (-not $anonKey) { $missing += "NEXT_PUBLIC_SUPABASE_ANON_KEY" }

if ($missing.Count -gt 0) {
    Write-Host "[ERR] Variabili mancanti in .env.local:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
    exit 1
}

Write-Host "Secrets da configurare:" -ForegroundColor Cyan
Write-Host "   1. NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Gray
Write-Host "   2. SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Gray
Write-Host "   3. NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Nessuna modifica verra applicata" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Comandi che verrebbero eseguiti:"
    Write-Host "  gh secret set NEXT_PUBLIC_SUPABASE_URL --body '***'" -ForegroundColor Gray
    Write-Host "  gh secret set SUPABASE_SERVICE_ROLE_KEY --body '***'" -ForegroundColor Gray
    Write-Host "  gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body '***'" -ForegroundColor Gray
    exit 0
}

# Ottieni repository
$repo = gh repo view --json nameWithOwner -q .nameWithOwner 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Errore recupero repository" -ForegroundColor Red
    Write-Host "   Assicurati di essere nella directory del repository" -ForegroundColor Yellow
    exit 1
}

Write-Host "Repository: $repo" -ForegroundColor Cyan
Write-Host ""

# Crea secrets
$secrets = @(
    @{ Name = "NEXT_PUBLIC_SUPABASE_URL"; Value = $supabaseUrl },
    @{ Name = "SUPABASE_SERVICE_ROLE_KEY"; Value = $serviceRoleKey },
    @{ Name = "NEXT_PUBLIC_SUPABASE_ANON_KEY"; Value = $anonKey }
)

$success = 0
$failed = 0

foreach ($secret in $secrets) {
    Write-Host "Configurando $($secret.Name)..." -ForegroundColor Yellow -NoNewline
    
    try {
        $secret.Value | gh secret set $secret.Name 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [OK]" -ForegroundColor Green
            $success++
        } else {
            Write-Host " [ERR]" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host " [ERR] Errore: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "[OK] Tutti i secrets configurati con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifica in GitHub:" -ForegroundColor Cyan
    Write-Host "   https://github.com/$repo/settings/secrets/actions" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "[WARN] Alcuni secrets non sono stati configurati" -ForegroundColor Yellow
    Write-Host "   Successi: $success" -ForegroundColor Green
    Write-Host "   Falliti: $failed" -ForegroundColor Red
    exit 1
}
