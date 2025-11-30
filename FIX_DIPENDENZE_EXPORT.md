# 🔧 Fix Dipendenze Export - Istruzioni

**Problema:** Moduli `jspdf` e `xlsx` non trovati a build time in Next.js

**Soluzione:** Modificato codice per usare import dinamico invece di `require.resolve`

---

## ✅ Modifiche Applicate

### 1. **lib/adapters/export/pdf.ts**
- ✅ Rimosso `require.resolve('jspdf')` da `isAvailable()`
- ✅ Sostituito `require('jspdf')` con `import('jspdf')` dinamico
- ✅ Gestione errori migliorata

### 2. **lib/adapters/export/xlsx.ts**
- ✅ Rimosso `require.resolve('xlsx')` da `isAvailable()`
- ✅ Sostituito `require('xlsx')` con `import('xlsx')` dinamico
- ✅ Gestione errori migliorata

---

## 📦 Installazione Dipendenze

**IMPORTANTE:** Le dipendenze devono essere installate:

```bash
npm install jspdf jspdf-autotable xlsx
```

Oppure se già nel `package.json`:

```bash
npm install
```

---

## 🧪 Test Dopo Fix

1. **Riavvia il server:**
   ```bash
   npm run dev
   ```

2. **Verifica che non ci siano errori di build**

3. **Testa export:**
   - Vai su `/dashboard/spedizioni`
   - Clicca "Esporta" → "Esporta PDF"
   - Verifica che funzioni

---

## ⚠️ Note

- Gli import dinamici vengono risolti a runtime, non a build time
- Se le librerie non sono installate, vedrai un errore chiaro a runtime
- Il codice ora è compatibile con Next.js 14

---

**Status:** ✅ **Fix applicato, installa le dipendenze e riavvia!**


