# 🧪 Istruzioni per Eseguire i Test E2E

## 📋 Comandi da Eseguire in VS Code Terminal

### 1. Verifica che il Server Next.js sia in Esecuzione

Apri un terminale in VS Code e verifica se il server è attivo:

```bash
# Verifica se il server è in esecuzione sulla porta 3000
netstat -ano | findstr :3000
```

**Se NON vedi output**, avvia il server:

```bash
npm run dev
```

**Aspetta** che vedi il messaggio:
```
✓ Ready in X seconds
```

### 2. Esegui i Test E2E

Apri un **NUOVO terminale** in VS Code (lascia il server in esecuzione nel primo terminale) e esegui:

#### Opzione A: Esegui TUTTI i test
```bash
npm run test:e2e
```

#### Opzione B: Esegui un singolo file di test
```bash
# Test validazione form
npx playwright test e2e/form-validation.spec.ts

# Test lista spedizioni
npx playwright test e2e/shipments-list.spec.ts

# Test dettaglio spedizione
npx playwright test e2e/shipment-detail.spec.ts

# Test happy path (già funzionante)
npx playwright test e2e/happy-path.spec.ts
```

#### Opzione C: Esegui con output dettagliato
```bash
npx playwright test --reporter=list
```

#### Opzione D: Esegui con UI interattiva (consigliato per debug)
```bash
npm run test:e2e:ui
```

### 3. Verifica Risultati

Dopo l'esecuzione, dovresti vedere:

```
Running 15 tests using 1 worker

  ✓ e2e/form-validation.spec.ts:7:5 › Validazione Form Nuova Spedizione › Pulsante submit disabilitato con form vuoto (5s)
  ✓ e2e/form-validation.spec.ts:7:5 › Validazione Form Nuova Spedizione › Errore: Nome mittente troppo corto (3s)
  ...
  
  15 passed (65s)
```

### 4. Se ci sono Errori

Se un test fallisce, Playwright creerà:
- **Screenshot** in `test-results/`
- **Video** in `test-results/` (se configurato)
- **Report HTML** in `playwright-report/`

Per vedere il report HTML:
```bash
npx playwright show-report
```

## 🔧 Troubleshooting

### Problema: "Server non raggiungibile"
**Soluzione:** Assicurati che `npm run dev` sia in esecuzione su `http://localhost:3000`

### Problema: "Test timeout"
**Soluzione:** Aumenta il timeout nel file `playwright.config.ts` o verifica che il server risponda

### Problema: "Elemento non trovato"
**Soluzione:** 
1. Verifica che la pagina sia completamente caricata
2. Controlla gli screenshot in `test-results/`
3. Usa `npm run test:e2e:ui` per vedere cosa succede

## 📊 Test Disponibili

1. ✅ `e2e/happy-path.spec.ts` - Creazione nuova spedizione (già testato)
2. ✅ `e2e/form-validation.spec.ts` - Validazione form (NUOVO)
3. ✅ `e2e/shipments-list.spec.ts` - Lista spedizioni (NUOVO)
4. ✅ `e2e/shipment-detail.spec.ts` - Dettaglio spedizione (NUOVO)

## 🎯 Comando Rapido (Copia e Incolla)

```bash
# Terminale 1: Avvia server
npm run dev

# Terminale 2: Esegui test
npm run test:e2e
```

---

**Nota:** Se usi VS Code, puoi aprire due terminali:
- **Terminale 1:** `npm run dev` (lascia in esecuzione)
- **Terminale 2:** `npm run test:e2e` (esegui i test)
