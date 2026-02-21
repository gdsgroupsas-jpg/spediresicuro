# Script per listare i test Playwright senza crashare
# Evita il problema di "npx playwright test --list" che si blocca

Write-Host "Elenco test Playwright..." -ForegroundColor Cyan
Write-Host ""

$testFiles = Get-ChildItem -Path "e2e" -Filter "*.spec.ts" -Recurse | Where-Object { $_.Name -notlike "*helper*" }

$totalTests = 0
$testList = @()

foreach ($file in $testFiles) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    
    if ($content) {
        # Estrai describe blocks
        $describeMatches = [regex]::Matches($content, "test\.describe\(['""]([^'""]+)['""]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        
        # Estrai test singoli (test('...'))
        $testMatches = [regex]::Matches($content, "test\(['""]([^'""]+)['""]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        
        $fileName = $file.Name
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
        
        if ($testMatches.Count -gt 0) {
            foreach ($match in $testMatches) {
                $testName = $match.Groups[1].Value
                $testList += [PSCustomObject]@{
                    File = $fileName
                    Path = $relativePath
                    Test = $testName
                }
                $totalTests++
            }
        } else {
            # Se non trova test singoli, cerca solo describe
            if ($describeMatches.Count -gt 0) {
                foreach ($match in $describeMatches) {
                    $describeName = $match.Groups[1].Value
                    $testList += [PSCustomObject]@{
                        File = $fileName
                        Path = $relativePath
                        Test = $describeName
                    }
                    $totalTests++
                }
            }
        }
    }
}

# Mostra i test
$count = 0
foreach ($item in $testList) {
    $count++
    Write-Host "[chromium] $($item.Path):$count $($item.Test)" -ForegroundColor White
    
    # Limita output se richiesto
    if ($args.Count -gt 0 -and $args[0] -eq "--limit") {
        $limit = if ($args.Count -gt 1) { [int]$args[1] } else { 10 }
        if ($count -ge $limit) {
            Write-Host ""
            Write-Host "... e altri $($totalTests - $limit) test" -ForegroundColor Gray
            break
        }
    }
}

Write-Host ""
Write-Host "Totale: $totalTests test in $($testFiles.Count) file" -ForegroundColor Cyan
Write-Host ""
Write-Host "Per eseguire i test:" -ForegroundColor Yellow
Write-Host "  npm run test:e2e" -ForegroundColor White
Write-Host ""
Write-Host "Per vedere tutti i test (senza limite):" -ForegroundColor Yellow
Write-Host "  powershell -File scripts/list-playwright-tests.ps1" -ForegroundColor White



