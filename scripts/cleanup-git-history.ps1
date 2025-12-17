#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Write-Host "== Repo root & branch =="
git rev-parse --show-toplevel
$branch = (git branch --show-current)
Write-Host "Current branch: $branch"

Write-Host "== Verify .env.railway exists in history (required) =="
git log --all --full-history -- .env.railway | Out-Host
$hits = (git log --all --full-history --name-only --pretty=format: -- .env.railway | Where-Object { $_ -ne '' } | Measure-Object).Count

if ($hits -eq 0) {
  Write-Host "No history hits for .env.railway. Aborting (no rewrite needed)."
  exit 0
}

Write-Host "== BACKUP (mandatory) =="
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "..\repo-backup-$ts.bundle"
git bundle create $backupFile --all
Write-Host "Backup created: $backupFile"

Write-Host "== Choose cleaner: BFG preferred, else git filter-repo =="

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (Test-Command "bfg") {
  Write-Host "Using BFG Repo-Cleaner..."
  bfg --delete-files .env.railway
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
} elseif (Test-Command "java") {
  if (Test-Path "bfg.jar") {
    Write-Host "Using BFG via local bfg.jar..."
    java -jar .\bfg.jar --delete-files .env.railway
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
  } else {
    Write-Host "ERROR: Java available but bfg.jar not found."
    exit 1
  }
} elseif (Test-Command "git-filter-repo") {
  Write-Host "Using git filter-repo..."
  git filter-repo --path .env.railway --invert-paths
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
} else {
  Write-Host "ERROR: Neither BFG nor git-filter-repo available."
  Write-Host "Install one of them:"
  Write-Host "  - BFG: https://rtyley.github.io/bfg-repo-cleaner/"
  Write-Host "  - git-filter-repo: https://github.com/newren/git-filter-repo"
  exit 1
}

Write-Host "== Post-cleanup verification (must be clean) =="
git log --all --full-history -- .env.railway | Out-Host
$hitsAfter = (git log --all --full-history --name-only --pretty=format: -- .env.railway | Where-Object { $_ -ne '' } | Measure-Object).Count
if ($hitsAfter -ne 0) {
  Write-Host "ERROR: .env.railway still found in history. Do not push. Investigate."
  exit 2
}
Write-Host "OK: .env.railway removed from history."

Write-Host "== Force push rewritten history (DESTRUCTIVE) =="
git push --force --all origin
git push --force --tags origin

Write-Host "DONE."

