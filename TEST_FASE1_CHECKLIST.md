# ✅ CHECKLIST TEST FASE 1: Creazione Manuale Listino Fornitore

## 🎯 Obiettivo
Verificare che la creazione manuale di listini fornitore funzioni correttamente con i nuovi campi metadata (courier_config_id, carrier_code, contract_code).

---

## 📋 PREPARAZIONE

### 1. Accesso
- [ ] Accedi come **Reseller** o **BYOC**
- [ ] Vai a: `/dashboard/reseller/listini-fornitore` (Reseller) o `/dashboard/byoc/listini-fornitore` (BYOC)
- [ ] Verifica che il pulsante "Crea Listino Fornitore" sia visibile

### 2. Verifica Configurazioni API
- [ ] Assicurati di avere almeno **1 configurazione Spedisci.Online attiva**
- [ ] Verifica che la configurazione abbia almeno **1 contract_code** nel `contract_mapping`

---

## 🧪 TEST CASE 1: Caricamento Form

### Step
1. [ ] Clicca su "Crea Listino Fornitore"
2. [ ] Verifica che il dialog si apra correttamente

### Verifiche
- [ ] Il campo **"Nome Listino"** è visibile
- [ ] Il campo **"Configurazione API"** è visibile e caricato
- [ ] Il campo **"Contract Code"** NON è visibile (appare solo dopo selezione configurazione)
- [ ] Il campo **"Carrier Code"** è visibile
- [ ] Il campo **"Corriere"** è visibile
- [ ] Il campo **"Versione"** è visibile (default: "1.0.0")
- [ ] Il campo **"Status"** è visibile (default: "Bozza")

---

## 🧪 TEST CASE 2: Selezione Configurazione API

### Step
1. [ ] Seleziona una **Configurazione API** dal dropdown
2. [ ] Osserva il comportamento del form

### Verifiche
- [ ] Il campo **"Contract Code"** appare dopo la selezione
- [ ] Il dropdown **"Contract Code"** è popolato con i contract codes della configurazione
- [ ] Il primo contract code è **auto-selezionato** (se disponibile)
- [ ] Il **"Carrier Code"** viene **auto-compilato** dal contract code selezionato
  - Esempio: se contract_code = "postedeliverybusiness-SDA---Express---H24+"
  - carrier_code dovrebbe essere = "postedeliverybusiness"

---

## 🧪 TEST CASE 3: Selezione Contract Code

### Step
1. [ ] Seleziona un **Contract Code** diverso dal dropdown
2. [ ] Osserva il comportamento del campo Carrier Code

### Verifiche
- [ ] Il **"Carrier Code"** viene **aggiornato automaticamente** con la prima parte del contract code
- [ ] Il valore è in **lowercase**
- [ ] Il campo è **editabile** (puoi modificarlo manualmente se necessario)

---

## 🧪 TEST CASE 4: Selezione Corriere

### Step
1. [ ] Seleziona un **Corriere** dal dropdown
2. [ ] Osserva il comportamento del campo Carrier Code

### Verifiche
- [ ] Se il Carrier Code è **vuoto**, viene auto-compilato dal nome corriere
- [ ] Se il Carrier Code è **già compilato**, non viene sovrascritto
- [ ] Il mapping corriere → carrier_code funziona:
  - "GLS" → "gls"
  - "Poste Italiane" → "postedeliverybusiness"
  - "PosteDeliveryBusiness" → "postedeliverybusiness"

---

## 🧪 TEST CASE 5: Creazione Listino (Successo)

### Step
1. [ ] Compila tutti i campi obbligatori:
   - Nome Listino: "Test Listino Fase 1"
   - Configurazione API: [seleziona una]
   - Contract Code: [auto-selezionato o seleziona manualmente]
   - Carrier Code: [auto-compilato o inserisci manualmente]
   - Corriere: [seleziona uno]
   - Versione: "1.0.0"
   - Status: "Bozza"
2. [ ] Clicca su "Crea Listino"

### Verifiche
- [ ] Il form mostra "Creazione..." durante il submit
- [ ] Appare un toast di **successo**: "Listino creato con successo"
- [ ] Il dialog si chiude automaticamente
- [ ] Il listino appare nella tabella dei listini
- [ ] Il listino ha status **"Bozza"**

### Verifica Database (Opzionale)
Esegui questa query per verificare i metadata salvati:
```sql
SELECT 
  id,
  name,
  status,
  metadata,
  source_metadata,
  created_at
FROM price_lists
WHERE name = 'Test Listino Fase 1'
ORDER BY created_at DESC
LIMIT 1;
```

Verifica che `metadata` contenga:
```json
{
  "courier_config_id": "[UUID della configurazione]",
  "carrier_code": "[codice corriere]",
  "contract_code": "[contract code selezionato]",
  "synced_at": "[timestamp ISO]"
}
```

---

## 🧪 TEST CASE 6: Validazione Duplicati

### Step
1. [ ] Crea un primo listino con:
   - Configurazione API: "Config A"
   - Carrier Code: "postedeliverybusiness"
   - Contract Code: "postedeliverybusiness-SDA---Express---H24+"
   - Nome: "Listino Test Duplicato 1"
2. [ ] Prova a creare un **secondo listino** con:
   - Stessa Configurazione API: "Config A"
   - Stesso Carrier Code: "postedeliverybusiness"
   - Stesso Contract Code: "postedeliverybusiness-SDA---Express---H24+"
   - Nome diverso: "Listino Test Duplicato 2"

### Verifiche
- [ ] Appare un toast di **errore**: "Esiste già un listino per questa configurazione (postedeliverybusiness/postedeliverybusiness-SDA---Express---H24+). Usa un nome diverso o modifica il listino esistente."
- [ ] Il listino **NON viene creato**
- [ ] Il form rimane aperto con i dati inseriti

### Test Case Alternativo (Diversi Contract Code)
1. [ ] Crea un listino con Contract Code: "postedeliverybusiness-SDA---Express---H24+"
2. [ ] Prova a creare un listino con Contract Code: "postedeliverybusiness-PDB-4" (stesso carrier, stesso config, contract diverso)

### Verifiche
- [ ] Il secondo listino **viene creato con successo** (non è un duplicato)
- [ ] Entrambi i listini esistono nella tabella

---

## 🧪 TEST CASE 7: Validazione Campi Obbligatori

### Test 7.1: Configurazione API mancante
1. [ ] Lascia vuoto "Configurazione API"
2. [ ] Compila tutti gli altri campi
3. [ ] Clicca "Crea Listino"

**Verifica**: Toast errore "Seleziona una configurazione API"

### Test 7.2: Contract Code mancante
1. [ ] Seleziona "Configurazione API"
2. [ ] Lascia vuoto "Contract Code" (se possibile)
3. [ ] Compila tutti gli altri campi
4. [ ] Clicca "Crea Listino"

**Verifica**: Toast errore "Seleziona un contract code"

### Test 7.3: Carrier Code mancante
1. [ ] Compila tutto tranne "Carrier Code"
2. [ ] Clicca "Crea Listino"

**Verifica**: Toast errore "Carrier code mancante"

### Test 7.4: Corriere mancante
1. [ ] Compila tutto tranne "Corriere"
2. [ ] Clicca "Crea Listino"

**Verifica**: Toast errore "Seleziona un corriere" (o validazione HTML)

---

## 🧪 TEST CASE 8: Modifica Listino Esistente

### Step
1. [ ] Clicca su un listino esistente nella tabella
2. [ ] Clicca "Modifica" (se disponibile)
3. [ ] Verifica i campi del form

### Verifiche
- [ ] I campi **Configurazione API**, **Contract Code**, **Carrier Code** sono **NON visibili** (solo in creazione)
- [ ] I campi standard (Nome, Versione, Status, Descrizione, Note) sono modificabili
- [ ] Le modifiche vengono salvate correttamente

---

## 🐛 BUG DA SEGNALARE

Se trovi problemi, segnala:
- [ ] Descrizione del problema
- [ ] Step per riprodurre
- [ ] Screenshot (se possibile)
- [ ] Console errors (F12 → Console)
- [ ] Network errors (F12 → Network)

---

## ✅ CRITERI DI SUCCESSO

La Fase 1 è considerata **completa e funzionante** se:
- ✅ Tutti i campi metadata vengono visualizzati correttamente
- ✅ L'auto-fill del carrier_code funziona da contract_code
- ✅ La validazione duplicati blocca correttamente
- ✅ I metadata vengono salvati nel database
- ✅ Il form è user-friendly e intuitivo
- ✅ Nessun errore in console durante l'uso

---

## 📝 NOTE

- Il server di sviluppo è avviato su `http://localhost:3000`
- Per verificare i metadata nel DB, usa Supabase Dashboard → SQL Editor
- I listini creati in test possono essere eliminati dopo il test
