# 🔍 PROMPT AUDIT: Problema Cambio Contratti Reseller Admin

## 📋 CONTESTO DEL PROBLEMA

**Scenario**: Un account **Reseller Admin** (`testspediresicuro+postaexpress@gmail.com`) ha:
- `is_reseller: true`
- `reseller_role: 'admin'`
- `account_type: 'user'`

**Problema**: Quando il reseller admin **modifica i contratti** nella configurazione Spedisci.Online tramite il Wizard o l'interfaccia, le modifiche **non vengono applicate** quando si crea una spedizione.

**Sintomi**:
1. Il contratto `postedeliverybusiness-SDA-Express-H24+` è presente nel `contract_mapping` del database
2. Il sistema trova il contratto correttamente nei log: `✅ Codice contratto trovato (match Poste generico)`
3. Ma l'API Spedisci.Online risponde: `404 - Codice contratto postedeliverybusiness-SDA-Express-H24+ non disponibile!`
4. Con GLS funziona (quindi il problema è specifico per Poste Italiane o per quel contratto)

## 🎯 OBIETTIVO

**NON modificare la logica esistente**. Solo:
1. **Identificare** dove e perché le modifiche ai contratti non vengono applicate
2. **Tracciare** il flusso completo: salvataggio → caricamento → utilizzo
3. **Verificare** se c'è cache, se la config viene ricaricata, se l'API key è corretta
4. **Fix mirato** solo al problema identificato, senza regressioni

## 🔬 AREE DA AUDITARE

### 1. FLUSSO SALVATAGGIO CONFIGURAZIONE

**File da verificare**:
- `actions/configurations.ts` → `savePersonalConfiguration()`
- `components/integrazioni/SpedisciOnlineWizard.tsx` → `testAndSave()`
- `components/integrazioni/courier-api-config.tsx` → `handleSave()`

**Domande da rispondere**:
- ✅ Il `contract_mapping` viene salvato correttamente nel database?
- ✅ L'API key viene criptata correttamente?
- ✅ L'`upsert` su `(owner_user_id, provider_id)` funziona?
- ✅ Dopo il salvataggio, la config viene ricaricata o c'è cache?

**Log da aggiungere**:
```typescript
console.log('💾 [SAVE] Contract mapping salvato:', contract_mapping)
console.log('💾 [SAVE] API key fingerprint:', apiKeyFingerprint)
console.log('💾 [SAVE] Config ID risultante:', result.id)
```

### 2. FLUSSO CARICAMENTO CONFIGURAZIONE

**File da verificare**:
- `lib/actions/spedisci-online.ts` → `createShipmentWithOrchestrator()`
- `lib/couriers/factory.ts` → `getCourierConfigForUser()`
- `lib/engine/fulfillment-orchestrator.ts` → `registerBrokerAdapter()`

**Domande da rispondere**:
- ✅ Quale configurazione viene caricata? (personale, default, assegnata)
- ✅ Viene ricaricata ad ogni richiesta o c'è cache?
- ✅ L'API key viene decriptata correttamente?
- ✅ Il `contract_mapping` viene letto correttamente?

**Log da aggiungere**:
```typescript
console.log('🔍 [LOAD] Config caricata:', { id, name, apiKeyFingerprint, contractMapping })
console.log('🔍 [LOAD] Priorità: personal > assigned > default')
console.log('🔍 [LOAD] API key decriptata:', apiKeyDecrypted ? 'SI' : 'NO')
```

### 3. FLUSSO RICERCA CONTRATTO

**File da verificare**:
- `lib/adapters/couriers/spedisci-online.ts` → `findContractCode()`
- `lib/adapters/couriers/spedisci-online.ts` → `createShipment()`

**Domande da rispondere**:
- ✅ Il `CONTRACT_MAPPING` viene passato correttamente all'adapter?
- ✅ La ricerca del contratto funziona correttamente?
- ✅ Il codice contratto trovato è quello corretto?
- ✅ L'API key usata per la chiamata è quella corretta?

**Log da aggiungere**:
```typescript
console.log('🔍 [CONTRACT] Mapping disponibile:', Object.keys(CONTRACT_MAPPING))
console.log('🔍 [CONTRACT] Corriere richiesto:', courier)
console.log('🔍 [CONTRACT] Codice trovato:', contractCode)
console.log('🔍 [CONTRACT] API key usata:', apiKeyFingerprint)
```

### 4. VERIFICA API KEY

**Problema sospetto**: I log mostrano:
- Database: API key criptata (219 caratteri, inizia con `gEzydC6vld2FdPJ4WixFkw==`)
- Sistema usa: API key con fingerprint `382bb56e` (60 caratteri)

**Domande da rispondere**:
- ✅ L'API key nel database è quella corretta?
- ✅ Viene decriptata correttamente?
- ✅ C'è una cache che usa un'API key vecchia?
- ✅ Il sistema usa la config sbagliata?

**Test da fare**:
1. Decriptare l'API key dal database e verificare che sia quella corretta
2. Verificare che il fingerprint corrisponda
3. Verificare se c'è una config vecchia ancora in uso

### 5. VERIFICA CONTRATTO SPEDISCI.ONLINE

**Problema sospetto**: Il contratto `postedeliverybusiness-SDA-Express-H24+` potrebbe:
- Non essere disponibile per quell'API key
- Essere stato rimosso da Spedisci.Online
- Appartenere a un account diverso

**Domande da rispondere**:
- ✅ Il contratto esiste realmente su Spedisci.Online per quell'API key?
- ✅ L'API key ha accesso a quel contratto?
- ✅ Il nome del corriere nel mapping è corretto? (`Pdb` vs `Posteitaliane Delivery Business`)

## 🧪 TEST DA ESEGUIRE

### Test 1: Verifica Salvataggio
```typescript
// 1. Modifica contratto tramite Wizard
// 2. Verifica nel database che contract_mapping sia aggiornato
// 3. Verifica che l'API key sia corretta
```

### Test 2: Verifica Caricamento
```typescript
// 1. Crea una spedizione
// 2. Verifica nei log quale config viene caricata
// 3. Verifica che contract_mapping sia quello corretto
// 4. Verifica che API key sia quella corretta
```

### Test 3: Verifica Contratto
```typescript
// 1. Testa con GLS (dovrebbe funzionare)
// 2. Testa con Poste Italiane (fallisce)
// 3. Confronta i log per capire la differenza
```

### Test 4: Verifica API Key
```typescript
// 1. Decripta API key dal database
// 2. Confronta con quella usata nei log
// 3. Verifica se corrispondono
```

## 📝 CHECKLIST AUDIT

- [ ] **Salvataggio**: Il `contract_mapping` viene salvato correttamente?
- [ ] **Caricamento**: La config viene ricaricata ad ogni richiesta?
- [ ] **API Key**: L'API key decriptata è quella corretta?
- [ ] **Contratto**: Il contratto esiste su Spedisci.Online?
- [ ] **Cache**: C'è una cache che usa dati vecchi?
- [ ] **Priorità**: Viene caricata la config corretta (personale vs default)?
- [ ] **Mapping**: Il nome corriere nel mapping è corretto?
- [ ] **Ricerca**: La ricerca del contratto funziona correttamente?

## 🚨 PUNTI CRITICI DA VERIFICARE

1. **Cache dell'Orchestrator**: L'orchestrator potrebbe avere una cache della config
2. **Priorità Config**: Potrebbe caricare una config default invece di quella personale
3. **API Key Vecchia**: Potrebbe usare un'API key vecchia da cache
4. **Contratto Non Disponibile**: Il contratto potrebbe non essere disponibile per quell'API key
5. **Mapping Errato**: Il nome corriere nel mapping potrebbe essere errato

## 📊 LOG DA AGGIUNGERE

Aggiungi questi log in punti strategici:

```typescript
// In savePersonalConfiguration
console.log('💾 [SAVE] Contract mapping:', JSON.stringify(contract_mapping))
console.log('💾 [SAVE] API key length:', api_key.length)
console.log('💾 [SAVE] Config ID:', result.id)

// In getCourierConfigForUser
console.log('🔍 [LOAD] User ID:', userId)
console.log('🔍 [LOAD] Provider ID:', providerId)
console.log('🔍 [LOAD] Config trovata:', { id, name, owner_user_id, is_default })

// In createShipmentWithOrchestrator
console.log('🚀 [ORCHESTRATOR] Config caricata:', { id, name, apiKeyFingerprint })
console.log('🚀 [ORCHESTRATOR] Contract mapping:', Object.keys(contractMapping))

// In findContractCode
console.log('🔍 [CONTRACT] Mapping keys:', Object.keys(CONTRACT_MAPPING))
console.log('🔍 [CONTRACT] Corriere richiesto:', courier)
console.log('🔍 [CONTRACT] Codice trovato:', contractCode)

// In createShipment (Spedisci.Online)
console.log('📡 [API] API key fingerprint:', apiKeyFingerprint)
console.log('📡 [API] Contract code:', contractCode)
console.log('📡 [API] Base URL:', baseUrl)
```

## 🎯 RISULTATO ATTESO

Dopo l'audit, devi avere:
1. **Identificato** esattamente dove si perde la modifica del contratto
2. **Tracciato** il flusso completo: salvataggio → caricamento → utilizzo
3. **Verificato** se c'è cache, se la config viene ricaricata, se l'API key è corretta
4. **Fix mirato** solo al problema identificato, senza regressioni

## ⚠️ REGOLE STRETTE

1. **NON modificare** la logica esistente di priorità config
2. **NON modificare** la logica di ricerca contratti
3. **NON modificare** la logica di salvataggio
4. **SOLO aggiungere** log per tracciare il problema
5. **SOLO fix mirato** al problema identificato
6. **TESTARE** che GLS funzioni ancora dopo il fix

## 🔧 FIX POSSIBILI (solo se identificato il problema)

1. **Se cache**: Forzare ricaricamento config ad ogni richiesta
2. **Se priorità**: Verificare che carichi config personale prima di default
3. **Se API key**: Verificare che usi quella corretta dal database
4. **Se contratto**: Verificare che il contratto esista per quell'API key
5. **Se mapping**: Verificare che il nome corriere sia corretto

---

**INIZIA L'AUDIT**: Aggiungi i log, esegui i test, identifica il problema, applica fix mirato.

