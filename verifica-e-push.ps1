cd d:\spediresicuro-master

$output = @()

$output += "=== VERIFICA STATO ATTUALE ==="
$output += ""
$output += "Ultimo commit locale:"
$output += (git log --oneline -1)
$output += ""
$output += "Ultimo commit remoto:"
$output += (git log --oneline -1 origin/master)
$output += ""
$output += "File non tracciati:"
$output += (git status --porcelain)
$output += ""
$output += "=== AGGIUNTA FILE ==="
git add -f components/homepage/dynamic/*.tsx components/homepage/dynamic/index.ts app/page.tsx
$output += "File aggiunti"
$output += ""
$output += "=== STATUS DOPO ADD ==="
$output += (git status --short)
$output += ""
$output += "=== COMMIT ==="
git commit -m "feat: Homepage dinamica con animazioni Framer Motion"
$lastCommit = git log --oneline -1
$output += "Commit creato: $lastCommit"
$output += ""
$output += "=== PUSH ==="
$pushOutput = git push origin master 2>&1 | Out-String
$output += $pushOutput
$output += ""
$output += "=== VERIFICA FINALE ==="
$output += "Commit locale:"
$output += (git log --oneline -1)
$output += "Commit remoto:"
$output += (git log --oneline -1 origin/master)

$output | Out-File -FilePath "git-verifica.txt" -Encoding UTF8
Write-Host "Output salvato in git-verifica.txt"
