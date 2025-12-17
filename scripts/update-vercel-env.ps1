# Script per aggiornare variabili ambiente su Vercel
# Utilizzo: .\scripts\update-vercel-env.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔄 Aggiornamento variabili ambiente su Vercel...`n"

# Nuovi valori da .env.local
$newEncryptionKey = "REDACTED_ENCRYPTION_KEY"
$newAutomationToken = "REDACTED_AUTOMATION_TOKEN"
$newSupabaseKey = "REDACTED_SUPABASE_SECRET_KEY"

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

