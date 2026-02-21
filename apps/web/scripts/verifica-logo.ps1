# Script PowerShell per verificare se i file logo esistono

Write-Host "Verifica File Logo SpedireSicuro" -ForegroundColor Cyan
Write-Host ""

$logoPath = "public\brand\logo"
$faviconPath = "public\brand\favicon"

# Verifica cartelle
Write-Host "Verifica cartelle..." -ForegroundColor Yellow
if (Test-Path $logoPath) {
    Write-Host "OK Cartella logo esiste" -ForegroundColor Green
} else {
    Write-Host "ERRORE: Cartella logo NON esiste!" -ForegroundColor Red
    Write-Host "   Crea: $logoPath" -ForegroundColor Yellow
}

if (Test-Path $faviconPath) {
    Write-Host "OK Cartella favicon esiste" -ForegroundColor Green
} else {
    Write-Host "ERRORE: Cartella favicon NON esiste!" -ForegroundColor Red
    Write-Host "   Crea: $faviconPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Verifica file logo..." -ForegroundColor Yellow

# File logo richiesti
$logoFiles = @(
    "logo-horizontal.png",
    "logo-icon.png",
    "logo-stacked.png",
    "logo-black.png",
    "logo-white.png"
)

$missingLogos = @()
foreach ($file in $logoFiles) {
    $fullPath = Join-Path $logoPath $file
    if (Test-Path $fullPath) {
        $size = (Get-Item $fullPath).Length / 1KB
        Write-Host "✅ $file ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - MANCANTE!" -ForegroundColor Red
        $missingLogos += $file
    }
}

Write-Host ""
Write-Host "Verifica file favicon..." -ForegroundColor Yellow

# File favicon richiesti
$faviconFiles = @(
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png"
)

$missingFavicons = @()
foreach ($file in $faviconFiles) {
    $fullPath = Join-Path $faviconPath $file
    if (Test-Path $fullPath) {
        $size = (Get-Item $fullPath).Length / 1KB
        Write-Host "✅ $file ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - MANCANTE!" -ForegroundColor Red
        $missingFavicons += $file
    }
}

Write-Host ""
Write-Host "RIEPILOGO" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan

if ($missingLogos.Count -eq 0 -and $missingFavicons.Count -eq 0) {
    Write-Host "SUCCESSO: TUTTI I FILE SONO PRESENTI!" -ForegroundColor Green
    Write-Host "   Il logo dovrebbe apparire correttamente nel sito." -ForegroundColor Green
} else {
    Write-Host "ATTENZIONE: FILE MANCANTI:" -ForegroundColor Yellow
    if ($missingLogos.Count -gt 0) {
        Write-Host "   Logo:" -ForegroundColor Yellow
        foreach ($file in $missingLogos) {
            Write-Host "     - $file" -ForegroundColor Red
        }
    }
    if ($missingFavicons.Count -gt 0) {
        Write-Host "   Favicon:" -ForegroundColor Yellow
        foreach ($file in $missingFavicons) {
            Write-Host "     - $file" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "Leggi ESTRAI_LOGO.md per istruzioni dettagliate" -ForegroundColor Cyan
}

Write-Host ""

