#!/usr/bin/env bash
set -euo pipefail

echo "== Repo root & branch =="
git rev-parse --show-toplevel
BRANCH="$(git branch --show-current || true)"
echo "Current branch: ${BRANCH:-unknown}"

echo "== Verify .env.railway exists in history (required) =="
HITS="$(git log --all --full-history --name-only --pretty=format: -- .env.railway | wc -l | tr -d ' ')"
git log --all --full-history -- .env.railway || true

if [ "$HITS" -eq 0 ]; then
  echo "No history hits for .env.railway. Aborting (no rewrite needed)."
  exit 0
fi

echo "== BACKUP (mandatory) =="
# Option 1: git bundle backup (portable)
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="../repo-backup-${TS}.bundle"
git bundle create "$BACKUP_FILE" --all
echo "Backup created: $BACKUP_FILE"

echo "== Choose cleaner: BFG preferred, else git filter-repo =="

if command -v bfg >/dev/null 2>&1; then
  echo "Using BFG Repo-Cleaner..."
  # BFG works best on a fresh clone; proceed anyway but warn.
  echo "NOTE: Best practice is to run BFG on a fresh mirror clone."
  bfg --delete-files .env.railway
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
elif command -v java >/dev/null 2>&1 && [ -f "./bfg.jar" ]; then
  echo "Using BFG via local bfg.jar..."
  java -jar ./bfg.jar --delete-files .env.railway
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
elif command -v git-filter-repo >/dev/null 2>&1; then
  echo "Using git filter-repo..."
  git filter-repo --path .env.railway --invert-paths
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
else
  echo "ERROR: Neither BFG nor git-filter-repo available."
  echo "Install one of them:"
  echo "  - BFG: https://rtyley.github.io/bfg-repo-cleaner/"
  echo "  - git-filter-repo: https://github.com/newren/git-filter-repo"
  exit 1
fi

echo "== Post-cleanup verification (must be clean) =="
git log --all --full-history -- .env.railway || true
HITS_AFTER="$(git log --all --full-history --name-only --pretty=format: -- .env.railway | wc -l | tr -d ' ')"
if [ "$HITS_AFTER" -ne 0 ]; then
  echo "ERROR: .env.railway still found in history. Do not push. Investigate."
  exit 2
fi
echo "OK: .env.railway removed from history."

echo "== Force push rewritten history (DESTRUCTIVE) =="
# Push all branches and tags
git push --force --all origin
git push --force --tags origin

echo "DONE."






