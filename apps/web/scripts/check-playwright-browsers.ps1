# Script per verificare lo stato dei browser Playwright senza check online
# Evita il crash di "npx playwright install --dry-run"

Write-Host "Verifica browser Playwright installati..." -ForegroundColor Cyan
Write-Host ""

$browsers = @(
    @{ Name = "Chromium"; Path = "$env:LOCALAPPDATA\ms-playwright\chromium-1200" },
    @{ Name = "Chromium Headless Shell"; Path = "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1200" },
    @{ Name = "Firefox"; Path = "$env:LOCALAPPDATA\ms-playwright\firefox-1497" },
    @{ Name = "WebKit"; Path = "$env:LOCALAPPDATA\ms-playwright\webkit-2227" },
    @{ Name = "FFmpeg"; Path = "$env:LOCALAPPDATA\ms-playwright\ffmpeg-1011" }
)

$allInstalled = $true
$installedCount = 0

foreach ($browser in $browsers) {
    $exists = Test-Path $browser.Path -ErrorAction SilentlyContinue
    
    if ($exists) {
        $size = (Get-Item $browser.Path -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        $sizeMB = if ($size) { [math]::Round($size / 1MB, 2) } else { 0 }
        $sizeText = "$sizeMB MB"
        Write-Host "[OK] $($browser.Name): INSTALLATO ($sizeText)" -ForegroundColor Green
        $installedCount++
    } else {
        Write-Host "[NO] $($browser.Name): NON installato" -ForegroundColor Red
        $allInstalled = $false
    }
}

Write-Host ""
Write-Host "Riepilogo: $installedCount / $($browsers.Count) browser installati" -ForegroundColor Cyan

if ($allInstalled) {
    Write-Host ""
    Write-Host "Tutti i browser sono installati!" -ForegroundColor Green
    Write-Host "Puoi eseguire i test con: npm run test:e2e" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host ""
    Write-Host "Alcuni browser mancano. Per installarli:" -ForegroundColor Yellow
    Write-Host "   npx playwright install" -ForegroundColor White
    Write-Host ""
    Write-Host "   Oppure solo Chromium (piu veloce):" -ForegroundColor Yellow
    Write-Host "   npx playwright install chromium" -ForegroundColor White
    exit 1
}

