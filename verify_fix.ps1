# Verification Script - Windows PowerShell

$baseUrl = "http://localhost:3000"
$apiKey = "sk_live_TEST_KEY_REPLACE_ME" # ⚠️ REPLACE WITH REAL KEY

# 1. Test Valid API Key (Should return 200 or 400 with payload error, NOT 401)
Write-Host "1. Testing Valid API Key..." -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/api/quotes/realtime" -Method Post -Headers @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" } -Body '{ "weight": 1, "zip": "20100" }' -SkipHttpErrorCheck

if ($response.StatusCode -eq 401) {
    Write-Host "❌ FAILED: Still getting 401 Unauthorized with valid key" -ForegroundColor Red
} elseif ($response.StatusCode -eq 200) {
    Write-Host "✅ PASSED: Got 200 OK" -ForegroundColor Green
} else {
    Write-Host "⚠️ NOTE: Got $($response.StatusCode) (likely payload validation error, which means Auth passed)" -ForegroundColor Yellow
}

# 2. Test Spoofing (Should return 401)
Write-Host "2. Testing Header Spoofing (x-user-id)..." -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/api/quotes/realtime" -Method Post -Headers @{ "x-user-id" = "spoofed-id"; "Content-Type" = "application/json" } -Body '{ "weight": 1, "zip": "20100" }' -SkipHttpErrorCheck

if ($response.StatusCode -eq 401) {
    Write-Host "✅ PASSED: Spoofing blocked (401)" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: Spoofing NOT blocked (Got $($response.StatusCode))" -ForegroundColor Red
}
