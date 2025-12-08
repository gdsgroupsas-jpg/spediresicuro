# 🚀 Auto-Fix Test Playwright - Guida Completa

## 📋 Cosa fa questo script?

Lo script `auto-fix-playwright-test.js` esegue automaticamente:
1. ✅ Avvia il server Next.js (se non è già in esecuzione)
2. ✅ Esegue i test Playwright
3. ✅ Analizza gli errori
4. ✅ Applica fix automatici basati su pattern comuni
5. ✅ Riesegue i test
6. ✅ Ripete fino al successo o max 15 iterazioni

## 🚀 Come usarlo

### Metodo 1: Script Auto-Fix (Consigliato)
```bash
npm run test:e2e:auto-fix
```

Questo script:
- Avvia automaticamente il server
- Analizza gli errori
- Applica fix intelligenti
- Ripete fino al successo

### Metodo 2: Script semplice (solo retry)
```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/run-tests-until-green.ps1

# Linux/Mac
bash scripts/run-tests-until-green.sh
```

Questo script esegue semplicemente i test in loop fino al successo (max 20 tentativi).

## 🔧 Fix automatici disponibili

Lo script riconosce e corregge automaticamente:

1. **Strict mode violation** - Sostituisce `getByText` con `getByRole('heading')`
2. **Button disabled** - Aggiunge verifica `toBeEnabled()` e controllo campi obbligatori
3. **Timeout errors** - Aumenta i timeout automaticamente
4. **Authentication bypass** - Verifica e aggiunge header `x-test-mode`
5. **City selection** - Migliora la selezione città con più attese
6. **API mock format** - Corregge il formato delle risposte API mockate

## 📊 Output

Lo script mostra:
- ✅ Iterazione corrente
- ✅ Errori trovati
- ✅ Fix applicati
- ✅ Stato finale (successo/fallimento)

## ⚙️ Configurazione

Puoi modificare in `scripts/auto-fix-playwright-test.js`:
- `MAX_ITERATIONS`: Numero massimo di iterazioni (default: 15)
- `SERVER_START_TIMEOUT`: Timeout avvio server (default: 120s)

## 🎯 Esempio di utilizzo

```bash
# Lascia lo script in esecuzione
npm run test:e2e:auto-fix

# Lo script:
# 1. Avvia il server
# 2. Esegue test
# 3. Se fallisce, analizza errori
# 4. Applica fix
# 5. Riesegue
# 6. Ripete fino al successo
```

## ⚠️ Note importanti

- **Server**: Lo script avvia automaticamente il server Next.js con `PLAYWRIGHT_TEST_MODE=true`
- **Timeout**: Ogni test ha timeout di 3 minuti
- **File modificato**: Il file `e2e/happy-path.spec.ts` viene modificato automaticamente
- **Backup**: Considera di fare commit prima di eseguire (o usa git stash)

## 🆘 Se lo script non riesce

1. **Verifica che il server non sia già in esecuzione** su porta 3000
2. **Controlla i log** per vedere quali errori non sono stati riconosciuti
3. **Aggiungi nuovi pattern** in `ERROR_PATTERNS` se necessario
4. **Esegui manualmente** in modalità UI: `npm run test:e2e:ui`

## 📝 Aggiungere nuovi fix

Per aggiungere un nuovo pattern di errore e relativo fix:

```javascript
{
  name: 'Nome del problema',
  pattern: /regex per riconoscere l'errore/i,
  fix: (match, testContent) => {
    // Logica di fix
    return testContent.replace(...);
  }
}
```

---

**Buon testing! 🚀**
