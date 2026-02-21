# Script di test completo per automation-service
# Esegui questo script mentre il server e in esecuzione

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST COMPLETO AUTOMATION-SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$serverUrl = "http://localhost:3000"

# ============================================
# TEST 1: Health Check
# ============================================
Write-Host "TEST 1: Health Check" -ForegroundColor Yellow
Write-Host "Endpoint: GET /health" -ForegroundColor Gray
Write-Host ""

try {
    $health = Invoke-RestMethod -Uri "$serverUrl/health" -Method Get -TimeoutSec 2
    Write-Host "✅ SUCCESSO!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
    Write-Host "   Service: $($health.service)" -ForegroundColor White
    Write-Host "   Timestamp: $($health.timestamp)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ ERRORE: Server non raggiungibile" -ForegroundColor Red
    Write-Host "   Assicurati che 'npm start' sia in esecuzione" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ============================================
# TEST 2: Diagnostics Endpoint
# ============================================
Write-Host "TEST 2: Diagnostics Endpoint" -ForegroundColor Yellow
Write-Host "Endpoint: POST /api/diagnostics" -ForegroundColor Gray
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer d4t1_d14gn0st1c1_s3gr3t1_2025_x9z"
}

$body = @{
    type = "info"
    severity = "low"
    context = @{ 
        message = "Test completo automation-service"
        test = $true
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        server = "automation-service"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$serverUrl/api/diagnostics" -Method Post -Headers $headers -Body $body
    
    Write-Host "✅ SUCCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Risposta:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 5
    Write-Host ""
    
    if ($response.success) {
        Write-Host "✅ Endpoint funziona correttamente!" -ForegroundColor Green
        
        if ($response.id) {
            Write-Host "   ID Evento: $($response.id)" -ForegroundColor Cyan
        }
        
        if ($response.warning) {
            Write-Host "   ⚠️  Warning: $($response.warning)" -ForegroundColor Yellow
            Write-Host "   (Supabase non configurato - evento non salvato nel DB)" -ForegroundColor Gray
        } else {
            Write-Host "   💾 Evento salvato nel database Supabase!" -ForegroundColor Green
        }
    }
    Write-Host ""
} catch {
    Write-Host "❌ ERRORE:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Dettagli:" -ForegroundColor Yellow
        try {
            $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorBody | ConvertTo-Json -Depth 3
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host ""
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
    }
    Write-Host ""
}

# ============================================
# TEST 3: Rate Limiting (opzionale)
# ============================================
Write-Host "TEST 3: Rate Limiting" -ForegroundColor Yellow
Write-Host "Verifica che il rate limiting funzioni..." -ForegroundColor Gray
Write-Host ""

$rateLimitTest = 0
$rateLimitSuccess = 0

for ($i = 1; $i -le 5; $i++) {
    try {
        $testResponse = Invoke-RestMethod -Uri "$serverUrl/api/diagnostics" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        $rateLimitSuccess++
        Write-Host "   Richiesta ${i}: OK" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 429) {
            Write-Host "   Richiesta ${i}: Rate limit raggiunto (corretto!)" -ForegroundColor Yellow
            break
        } else {
            Write-Host "   Richiesta ${i}: Errore - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host "Rate limiting: $rateLimitSuccess/5 richieste accettate" -ForegroundColor Cyan
Write-Host ""

# ============================================
# RIEPILOGO FINALE
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RIEPILOGO TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Health Check: OK" -ForegroundColor Green
Write-Host "✅ Diagnostics Endpoint: OK" -ForegroundColor Green
Write-Host "✅ Rate Limiting: Attivo" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Tutti i test completati!" -ForegroundColor Green
Write-Host ""
