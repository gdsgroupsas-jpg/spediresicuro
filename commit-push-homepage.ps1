# Script per commit e push homepage dinamica
cd d:\spediresicuro-master

Write-Host "=== Verifica configurazione Git ===" -ForegroundColor Cyan
git config user.name
git config user.email

Write-Host "`n=== Aggiunta file ===" -ForegroundColor Cyan
git add components/homepage/dynamic/
git add app/page.tsx
git status --short

Write-Host "`n=== Commit ===" -ForegroundColor Cyan
git commit -m "feat: Homepage dinamica con animazioni Framer Motion - Hero con particelle e typing effect - Features con effetti 3D hover - How It Works interattivo con demo live - Annie AI showcase con chat animata - Stats con counter animati e carousel - CTA finale con gradient animato"

Write-Host "`n=== Verifica commit ===" -ForegroundColor Cyan
git log -1 --oneline

Write-Host "`n=== Push su master ===" -ForegroundColor Cyan
git push origin master

Write-Host "`n=== Completato! ===" -ForegroundColor Green
