# 🚀 Comandi per Commit e Push

**Esegui questi comandi nel terminale:**

---

## ✅ Step 1: Verifica Account Git

```bash
git config user.name
```

**Deve essere:** `gdsgroupsas-jpg`

Se non lo è, correggi:
```bash
git config user.name "gdsgroupsas-jpg"
git config user.email "tua-email@esempio.com"
```

---

## ✅ Step 2: Aggiungi Tutte le Modifiche

```bash
git add .
```

---

## ✅ Step 3: Crea Commit

```bash
git commit -m "feat: integrazione funzionalità Claude - OCR Upload, Filtri avanzati, Export multiplo

- Integrato OCR Upload nella pagina nuova spedizione con toggle AI Import
- Aggiunto filtro corriere nella lista spedizioni
- Implementato export multiplo (CSV, XLSX, PDF) usando ExportService
- Migliorato mock OCR con dati più vari e realistici
- Fix Tesseract.js per server-side (usa mock in API routes)
- Fix import dinamico per jspdf e xlsx
- Aggiunta gestione errori migliorata"
```

---

## ✅ Step 4: Push su GitHub

```bash
git push origin master
```

---

## 🎯 Dopo il Push

1. **Vercel deploy automatico:**
   - Vercel rileverà il push
   - Farà deploy automatico su `spediresicuro.it`
   - Tempo: ~2-3 minuti

2. **Test in produzione:**
   - Vai su `https://www.spediresicuro.it`
   - Prova OCR Upload
   - Prova filtri avanzati
   - Prova export multiplo

---

## 💡 Perché in Produzione Funziona Meglio?

- ✅ **Ambiente ottimizzato** - Vercel ha configurazioni migliori
- ✅ **Cache migliore** - Performance migliori
- ✅ **CDN** - File serviti più velocemente
- ✅ **Build ottimizzato** - Codice minificato e ottimizzato

---

**Esegui i comandi e dimmi quando hai fatto il push!** 🚀


