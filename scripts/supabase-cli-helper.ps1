# Helper script per Supabase CLI con token automatico
# Usa: .\scripts\supabase-cli-helper.ps1 <comando> [argomenti]
# Esempio: .\scripts\supabase-cli-helper.ps1 "db push"
# Esempio: .\scripts\supabase-cli-helper.ps1 "migration new" "fix_cron_security"

param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

# Leggi token da .env.local
$envPath = Join-Path $PSScriptRoot ".." ".env.local"
if (-not (Test-Path $envPath)) {
    Write-Host "ERR: File .env.local non trovato" -ForegroundColor Red
    exit 1
}

# Cerca SUPABASE_ACCESS_TOKEN o crea variabile temporanea
$envContent = Get-Content $envPath -Raw

# Estrai token se presente, altrimenti usa quello hardcoded (da aggiornare)
$token = $null
$tokenMatch = [regex]::Match($envContent, 'SUPABASE_ACCESS_TOKEN=["'']?([^"'']\s]+)')
if ($tokenMatch.Success) {
    $token = $tokenMatch.Groups[1].Value
} else {
    # Token di fallback (da aggiornare se cambia)
    $token = "***REMOVED_SUPABASE_TOKEN***"
    Write-Host "WARN: Token non trovato in .env.local, uso token di fallback" -ForegroundColor Yellow
    Write-Host "INFO: Aggiungi SUPABASE_ACCESS_TOKEN al .env.local per persistenza" -ForegroundColor Cyan
}

# Imposta token come env var
$env:SUPABASE_ACCESS_TOKEN = $token

# Costruisci comando completo
$fullCommand = "npx supabase $Command"
if ($Arguments.Count -gt 0) {
    $fullCommand += " " + ($Arguments -join " ")
}

Write-Host "Eseguendo: $fullCommand" -ForegroundColor Cyan
Write-Host ""

# Esegui comando
Invoke-Expression $fullCommand

# Exit code del comando
exit $LASTEXITCODE










