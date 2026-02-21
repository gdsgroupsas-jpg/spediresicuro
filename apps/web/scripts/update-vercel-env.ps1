# Script per aggiornare variabili ambiente su Vercel
# Utilizzo: .\scripts\update-vercel-env.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔄 Aggiornamento variabili ambiente su Vercel...`n"

# Leggi valori da .env.local (MAI hardcodare segreti!)
$envPath = Join-Path $PSScriptRoot ".." ".env.local"
if (-not (Test-Path $envPath)) {
    Write-Error "File .env.local non trovato. Crea il file con i segreti."
    exit 1
}

$envContent = Get-Content $envPath -Raw
$newEncryptionKey = if ($envContent -match 'ENCRYPTION_KEY=["'']?([^"''\r\n]+)') { $matches[1] } else { throw "ENCRYPTION_KEY non trovato" }
$newAutomationToken = if ($envContent -match 'AUTOMATION_SERVICE_TOKEN=["'']?([^"''\r\n]+)') { $matches[1] } else { throw "AUTOMATION_SERVICE_TOKEN non trovato" }
$newSupabaseKey = if ($envContent -match 'SUPABASE_SERVICE_ROLE_KEY=["'']?([^"''\r\n]+)') { $matches[1] } else { throw "SUPABASE_SERVICE_ROLE_KEY non trovato" }

$environments = @("development", "preview", "production")

# Funzione per aggiornare una variabile
function Update-VercelEnv {
    param(
        [string]$Key,
        [string]$Value,
        [string[]]$Envs
    )
    
    Write-Host "📝 Aggiornamento $Key..."
    
    foreach ($env in $Envs) {
        Write-Host "  - Rimozione da $env..."
        echo "y" | npx vercel env rm $Key $env --yes 2>&1 | Out-Null
        
        Write-Host "  - Aggiunta a $env..."
        echo $Value | npx vercel env add $Key $env 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $env aggiornato"
        } else {
            Write-Host "  ⚠️  Errore in $env"
        }
    }
    Write-Host ""
}

# Aggiorna ENCRYPTION_KEY
Update-VercelEnv -Key "ENCRYPTION_KEY" -Value $newEncryptionKey -Envs $environments

# Aggiorna AUTOMATION_SERVICE_TOKEN
Update-VercelEnv -Key "AUTOMATION_SERVICE_TOKEN" -Value $newAutomationToken -Envs $environments

# Aggiorna SUPABASE_SERVICE_ROLE_KEY
Update-VercelEnv -Key "SUPABASE_SERVICE_ROLE_KEY" -Value $newSupabaseKey -Envs $environments

Write-Host "✅ Aggiornamento completato!`n"
Write-Host "⚠️  IMPORTANTE: Le modifiche richiedono un nuovo deploy per essere attive."
Write-Host "   Esegui: npm run vercel:deploy`n"

