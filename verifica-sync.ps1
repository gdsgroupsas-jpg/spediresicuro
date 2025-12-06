# Script per verificare sincronizzazione e salvare output
$outputFile = "verifica-sincronizzazione-output.txt"

Write-Output "=== VERIFICA SINCRONIZZAZIONE GIT ===" | Tee-Object -FilePath $outputFile
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Set-Location "c:\spediresicuro-master\spediresicuro"

Write-Output "--- 1. REPOSITORY REMOTO ---" | Tee-Object -FilePath $outputFile -Append
git remote -v 2>&1 | Tee-Object -FilePath $outputFile -Append
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 2. FETCH REMOTO ---" | Tee-Object -FilePath $outputFile -Append
git fetch origin 2>&1 | Tee-Object -FilePath $outputFile -Append
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 3. STATO LOCALE ---" | Tee-Object -FilePath $outputFile -Append
git status -sb 2>&1 | Tee-Object -FilePath $outputFile -Append
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 4. ULTIMO COMMIT LOCALE ---" | Tee-Object -FilePath $outputFile -Append
git log --oneline -1 2>&1 | Tee-Object -FilePath $outputFile -Append
$localHash = git rev-parse HEAD 2>&1
Write-Output "Hash locale: $localHash" | Tee-Object -FilePath $outputFile -Append
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 5. ULTIMO COMMIT REMOTO ---" | Tee-Object -FilePath $outputFile -Append
git log origin/master --oneline -1 2>&1 | Tee-Object -FilePath $outputFile -Append
$remoteHash = git rev-parse origin/master 2>&1
Write-Output "Hash remoto: $remoteHash" | Tee-Object -FilePath $outputFile -Append
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 6. COMMIT REMOTI DA SCARICARE ---" | Tee-Object -FilePath $outputFile -Append
$remoteAhead = git log HEAD..origin/master --oneline 2>&1
if ($remoteAhead -and $remoteAhead -notmatch "fatal" -and $remoteAhead.Trim() -ne "") {
    Write-Output "Ci sono commit remoti da scaricare:" | Tee-Object -FilePath $outputFile -Append
    Write-Output $remoteAhead | Tee-Object -FilePath $outputFile -Append
} else {
    Write-Output "Nessun commit remoto da scaricare" | Tee-Object -FilePath $outputFile -Append
}
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 7. COMMIT LOCALI DA CARICARE ---" | Tee-Object -FilePath $outputFile -Append
$localAhead = git log origin/master..HEAD --oneline 2>&1
if ($localAhead -and $localAhead -notmatch "fatal" -and $localAhead.Trim() -ne "") {
    Write-Output "Ci sono commit locali da caricare:" | Tee-Object -FilePath $outputFile -Append
    Write-Output $localAhead | Tee-Object -FilePath $outputFile -Append
} else {
    Write-Output "Nessun commit locale da caricare" | Tee-Object -FilePath $outputFile -Append
}
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "--- 8. CONFRONTO HASH ---" | Tee-Object -FilePath $outputFile -Append
if ($localHash -eq $remoteHash) {
    Write-Output "✅ REPOSITORY SINCRONIZZATO!" | Tee-Object -FilePath $outputFile -Append
} else {
    Write-Output "⚠️ Repository NON sincronizzato!" | Tee-Object -FilePath $outputFile -Append
}
Write-Output "" | Tee-Object -FilePath $outputFile -Append

Write-Output "=== FINE VERIFICA ===" | Tee-Object -FilePath $outputFile -Append
Write-Output ""
Write-Output "Output salvato in: $outputFile" -ForegroundColor Green

