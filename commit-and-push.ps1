# Script PowerShell per Commit e Push automatico
# Esegue tutti i comandi Git senza aprire editor

Write-Host "🚀 Inizio commit e push..." -ForegroundColor Green

# Verifica account Git
Write-Host "`n1. Verifica account Git..." -ForegroundColor Yellow
$userName = git config user.name
Write-Host "   Account attuale: $userName" -ForegroundColor Cyan

if ($userName -ne "gdsgroupsas-jpg") {
    Write-Host "   ⚠️ Account non corretto, correggo..." -ForegroundColor Yellow
    git config user.name "gdsgroupsas-jpg"
    Write-Host "   ✅ Account corretto" -ForegroundColor Green
}

# Aggiungi modifiche
Write-Host "`n2. Aggiungo modifiche..." -ForegroundColor Yellow
git add .
Write-Host "   ✅ Modifiche aggiunte" -ForegroundColor Green

# Commit con messaggio
Write-Host "`n3. Creo commit..." -ForegroundColor Yellow
$commitMessage = "feat: integrazione funzionalità Claude - OCR Upload, Filtri avanzati, Export multiplo

- Integrato OCR Upload nella pagina nuova spedizione con toggle AI Import
- Aggiunto filtro corriere nella lista spedizioni
- Implementato export multiplo (CSV, XLSX, PDF) usando ExportService
- Migliorato mock OCR con dati più vari e realistici
- Fix Tesseract.js per server-side (usa mock in API routes)
- Fix import dinamico per jspdf e xlsx
- Aggiunta gestione errori migliorata"

git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Commit creato" -ForegroundColor Green
} else {
    Write-Host "   ❌ Errore nel commit" -ForegroundColor Red
    exit 1
}

# Push
Write-Host "`n4. Push su GitHub..." -ForegroundColor Yellow
git push origin master
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Push completato!" -ForegroundColor Green
    Write-Host "`n🎉 Tutto fatto! Vercel farà deploy automatico in 2-3 minuti." -ForegroundColor Green
} else {
    Write-Host "   ❌ Errore nel push" -ForegroundColor Red
    Write-Host "   Verifica credenziali GitHub o connessione" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Completato!" -ForegroundColor Green

