# Script di test per endpoint diagnostics
# Esegui questo script mentre il server automation-service e in esecuzione

$serverUrl = "http://localhost:3000"
$healthEndpoint = "$serverUrl/health"
$diagnosticsEndpoint = "$serverUrl/api/diagnostics"

Write-Host "Test endpoint /api/diagnostics..." -ForegroundColor Cyan
Write-Host ""

# Verifica che il server sia in esecuzione
Write-Host "Verifica server in esecuzione..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-RestMethod -Uri $healthEndpoint -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "SUCCESSO: Server attivo - $($healthCheck.status)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERRORE: Server non raggiungibile su $serverUrl" -ForegroundColor Red
    Write-Host "   Assicurati che il server sia in esecuzione con: npm start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer d4t1_d14gn0st1c1_s3gr3t1_2025_x9z"
}

$body = @{
    type = "info"
    severity = "low"
    context = @{ 
        message = "Test Lazy Loading Riuscito"
        test = $true
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
} | ConvertTo-Json

Write-Host "Invio richiesta a /api/diagnostics..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $diagnosticsEndpoint -Method Post -Headers $headers -Body $body
    
    Write-Host "SUCCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Risposta:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
    
    if ($response.success) {
        Write-Host ""
        Write-Host "L'endpoint funziona correttamente!" -ForegroundColor Green
        
        if ($response.id) {
            Write-Host "ID Evento: $($response.id)" -ForegroundColor Cyan
        }
        
        if ($response.warning) {
            Write-Host ""
            Write-Host "WARNING: $($response.warning)" -ForegroundColor Yellow
            Write-Host "   (Il server funziona ma Supabase potrebbe non essere configurato)" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "Evento salvato nel database Supabase!" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "Risposta non di successo" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERRORE:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Dettagli errore:" -ForegroundColor Yellow
        try {
            $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorBody | ConvertTo-Json -Depth 3
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
        }
    }
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host ""
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
        
        if ($statusCode -eq 401) {
            Write-Host "Suggerimento: Verifica che il token DIAGNOSTICS_TOKEN sia corretto" -ForegroundColor Cyan
        } elseif ($statusCode -eq 429) {
            Write-Host "Suggerimento: Rate limit raggiunto. Attendi un minuto e riprova" -ForegroundColor Cyan
        }
    }
    
    Write-Host ""
    exit 1
}
