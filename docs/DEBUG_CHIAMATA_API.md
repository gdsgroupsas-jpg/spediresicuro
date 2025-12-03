# 🔍 DEBUG: Perché la LDV non chiama le API?

## 📋 PROBLEMA

La LDV viene creata sempre localmente, non chiama le API reali di Spedisci.Online.

---

## 🔍 COME CONTROLLARE I LOG SU VERCEL

### 1. Vai su Vercel Dashboard

1. Apri https://vercel.com/dashboard
2. Seleziona il tuo progetto
3. Vai su **"Deployments"**
4. Clicca sull'ultimo deployment
5. Vai su **"Functions"** o **"Logs"**

### 2. Filtra i Log

Cerca questi messaggi nei log:

```
🚀 [ORCHESTRATOR] createShipmentWithOrchestrator chiamato
✅ [ORCHESTRATOR] Utente autenticato
✅ [SPEDISCI.ONLINE] Broker adapter registrato
🔍 [ORCHESTRATOR] Controllo broker adapter
✅ [ORCHESTRATOR] Broker adapter disponibile
🚀 [SPEDISCI.ONLINE] Inizio creazione spedizione
🌐 [SPEDISCI.ONLINE] Tentativo chiamata API JSON
```

---

## 🔍 CHECKLIST DIAGNOSTICA

### ✅ Passo 1: Verifica che la Funzione venga Chiamata

Cerca nei log:
```
🚀 [ORCHESTRATOR] createShipmentWithOrchestrator chiamato
```

**Se NON vedi questo messaggio**:
- ❌ La funzione non viene chiamata
- **Causa**: Il codice non è stato deployato o c'è un errore prima

**Soluzione**: Verifica che il deploy sia completato

---

### ✅ Passo 2: Verifica Autenticazione

Cerca nei log:
```
✅ [ORCHESTRATOR] Utente autenticato: admin@spediresicuro.it
```

**Se vedi**:
```
⚠️ [ORCHESTRATOR] Non autenticato
```
- ❌ Problema di autenticazione

---

### ✅ Passo 3: Verifica Broker Adapter Registrato

Cerca nei log:
```
✅ [SPEDISCI.ONLINE] Broker adapter registrato tramite configurazione DEFAULT
✅ [SPEDISCI.ONLINE] Contratti configurati: [lista contratti]
```

**Se vedi**:
```
⚠️ Spedisci.Online non configurato
```
- ❌ La configurazione non è nel database o non è attiva

**Soluzione**:
1. Vai su `/dashboard/integrazioni`
2. Verifica che Spedisci.Online sia configurato
3. Verifica che sia attivo (`is_active = true`)
4. Verifica che ci sia almeno un contratto nella tabella

---

### ✅ Passo 4: Verifica che il Broker Sia Usato

Cerca nei log:
```
🔍 [ORCHESTRATOR] Controllo broker adapter...
✅ [ORCHESTRATOR] Broker adapter disponibile, uso Spedisci.Online
📦 [ORCHESTRATOR] Chiamo broker adapter con corriere: GLS
```

**Se vedi**:
```
⚠️ [ORCHESTRATOR] Broker adapter NON disponibile
```
- ❌ Il broker non è stato registrato correttamente

**Possibili cause**:
- Configurazione non trovata nel DB
- Errore durante la registrazione
- Configurazione non è default

---

### ✅ Passo 5: Verifica Chiamata API

Cerca nei log:
```
🚀 [SPEDISCI.ONLINE] Inizio creazione spedizione...
🌐 [SPEDISCI.ONLINE] Tentativo chiamata API JSON a: https://...
📡 [SPEDISCI.ONLINE] Chiamata fetch a: https://...
```

**Se vedi**:
```
✅ [SPEDISCI.ONLINE] Chiamata API JSON riuscita!
```
- ✅ La chiamata funziona!

**Se vedi**:
```
❌ [SPEDISCI.ONLINE] Creazione JSON fallita: [errore]
```
- ❌ La chiamata API sta fallendo

**Controlla**:
- URL corretto (BASE_URL)
- API Key valida
- Payload corretto
- Codice contratto presente

---

### ✅ Passo 6: Verifica Codice Contratto

Cerca nei log:
```
🔍 [SPEDISCI.ONLINE] Cerco codice contratto per corriere: GLS
🔍 [SPEDISCI.ONLINE] Codice contratto trovato: gls-NN6-STANDARD-(TR-VE)
```

**Se vedi**:
```
🔍 [SPEDISCI.ONLINE] Codice contratto trovato: NESSUNO
⚠️ [SPEDISCI.ONLINE] Nessun codice contratto trovato per corriere: GLS
```
- ❌ Il mapping contratto non funziona

**Possibili cause**:
- Contract mapping non configurato correttamente
- Nome corriere non corrisponde
- Formato contract_mapping errato

**Soluzione**:
1. Vai su `/dashboard/integrazioni`
2. Verifica i contratti nella tabella
3. Verifica che il nome corriere corrisponda esattamente

---

### ✅ Passo 7: Verifica Payload

Cerca nei log:
```
📦 [SPEDISCI.ONLINE] Payload preparato: { destinatario: "...", codice_contratto: "..." }
📡 [SPEDISCI.ONLINE] Codice contratto nel payload: gls-NN6-STANDARD-(TR-VE)
```

**Se vedi**:
```
📡 [SPEDISCI.ONLINE] Codice contratto nel payload: MANCANTE
```
- ❌ Il codice contratto non viene incluso nel payload

---

## 🐛 PROBLEMI COMUNI

### Problema 1: "Broker adapter NON disponibile"

**Causa**: La configurazione non viene trovata

**Soluzione**:
1. Verifica che esista una configurazione in `courier_configs`
2. Verifica che `is_active = true`
3. Verifica che `provider_id = 'spedisci_online'`

**Query SQL per verificare**:
```sql
SELECT * FROM courier_configs 
WHERE provider_id = 'spedisci_online' 
AND is_active = true;
```

---

### Problema 2: "Nessun codice contratto trovato"

**Causa**: Il contract_mapping non contiene il corriere selezionato

**Soluzione**:
1. Vai su `/dashboard/integrazioni`
2. Aggiungi il contratto con:
   - Codice: `gls-NN6-STANDARD-(TR-VE)`
   - Corriere: `Gls` (esattamente così, con maiuscola/minuscola)
3. Salva

**Verifica formato contract_mapping**:
```json
{
  "gls-NN6-STANDARD-(TR-VE)": "Gls",
  "postedeliverybusiness-Solution-and-Shipment": "PosteDeliveryBusiness"
}
```

---

### Problema 3: "Chiamata API fallisce"

**Controlla**:
- URL endpoint corretto (deve finire con `/api/v2/`)
- API Key valida
- Base URL corretto (es: `https://tuodominio.spedisci.online`)

**Log da controllare**:
```
❌ [SPEDISCI.ONLINE] Errore risposta API: [dettagli errore]
```

---

## 📝 ESEMPIO LOG COMPLETO (SUCCESSO)

```
🚀 [ORCHESTRATOR] createShipmentWithOrchestrator chiamato { courierCode: 'GLS' }
✅ [ORCHESTRATOR] Utente autenticato: admin@spediresicuro.it
✅ [SPEDISCI.ONLINE] Broker adapter registrato tramite configurazione DEFAULT
✅ [SPEDISCI.ONLINE] Contratti configurati: ['gls-NN6-STANDARD-(TR-VE)', ...]
🔍 [ORCHESTRATOR] Controllo broker adapter... { allowBroker: true, hasBrokerAdapter: true }
✅ [ORCHESTRATOR] Broker adapter disponibile, uso Spedisci.Online
📦 [ORCHESTRATOR] Chiamo broker adapter con corriere: GLS
🚀 [SPEDISCI.ONLINE] Inizio creazione spedizione...
🔍 [SPEDISCI.ONLINE] Cerco codice contratto per corriere: GLS
🔍 [SPEDISCI.ONLINE] Codice contratto trovato: gls-NN6-STANDARD-(TR-VE)
📦 [SPEDISCI.ONLINE] Payload preparato: { codice_contratto: 'gls-NN6-STANDARD-(TR-VE)' }
🌐 [SPEDISCI.ONLINE] Tentativo chiamata API JSON a: https://...
📡 [SPEDISCI.ONLINE] Chiamata fetch a: https://...
📡 [SPEDISCI.ONLINE] Risposta ricevuta: { status: 200, ok: true }
✅ [SPEDISCI.ONLINE] Chiamata API JSON riuscita!
✅ [ORCHESTRATOR] Broker adapter ha restituito: { has_tracking: true }
✅ LDV creata (broker): ABC123XYZ
```

---

## 🔧 COME RISOLVERE

1. **Controlla i log** seguendo la checklist sopra
2. **Identifica il problema** dal messaggio di errore
3. **Applica la soluzione** corrispondente
4. **Riprova** a creare una spedizione
5. **Controlla di nuovo i log** per verificare che funzioni

---

**Ultimo aggiornamento**: 3 Dicembre 2025


