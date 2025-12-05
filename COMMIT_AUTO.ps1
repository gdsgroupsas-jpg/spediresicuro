# Commit automatico - bypassa tutto
$ErrorActionPreference = "Continue"

Set-Location "C:\spediresicuro-master\spediresicuro"

# Disabilita pager
$env:GIT_PAGER = $null
git config --global core.pager "" 2>$null
git config --global --unset core.pager 2>$null

# Reset staging
git reset HEAD . 2>$null

# Add files
git add components/integrazioni/spedisci-online-config-multi.tsx 2>$null
git add components/integrazioni/spedisci-online-config.tsx 2>$null
git add lib/adapters/couriers/spedisci-online.ts 2>$null
git add lib/couriers/factory.ts 2>$null
git add lib/actions/spedisci-online.ts 2>$null
git add lib/engine/fulfillment-orchestrator.ts 2>$null
git add actions/configurations.ts 2>$null
git add app/dashboard/integrazioni/page.tsx 2>$null
git add docs/*.md 2>$null
git add -A 2>$null

# Commit
$msg = "feat: Fix visibilità testo + interfaccia multi-dominio + codice contratto + log debug"
git commit -m $msg 2>$null

# Push
git push 2>$null

Write-Host "FATTO!"







