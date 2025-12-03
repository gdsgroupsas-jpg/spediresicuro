# Script per fix e push correzione errore sintassi
cd C:\spediresicuro-master\spediresicuro

Write-Host "🔄 Aggiungo file modificato..." -ForegroundColor Yellow
git add actions/configurations.ts

Write-Host "📝 Creo commit..." -ForegroundColor Yellow
git commit -m "fix: Corretto errore sintassi else duplicato in configurations.ts"

Write-Host "🚀 Eseguo push..." -ForegroundColor Yellow
git push

Write-Host "✅ Completato!" -ForegroundColor Green

