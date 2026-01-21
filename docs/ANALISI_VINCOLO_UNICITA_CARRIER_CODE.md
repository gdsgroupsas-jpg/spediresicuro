# 🔍 Analisi: Vincolo Unicità Carrier Code

## Domanda

**Il carrier_code è univoco per un dato config_id e contract_code in un listino personalizzato?**

---

## 📊 Situazione Attuale

### 1. **Struttura Database**

#### Tabella `price_lists`

- **Nessun vincolo UNIQUE** su (carrier_code, contract_code, courier_config_id)
- I valori sono salvati in `metadata` (JSONB) o `source_metadata` (JSONB)
- Campo `courier_id` (UUID) può essere presente ma non garantisce unicità

#### Tabella `supplier_price_list_config`

- **Vincolo UNIQUE**: `UNIQUE(price_list_id)` - solo un config per listino
- **Nessun vincolo** su (carrier_code, contract_code, courier_config_id) tra listini diversi
- Campi: `carrier_code`, `contract_code`, `courier_config_id` sono TEXT/UUID

### 2. **Validazione Applicativa**

#### Listini Fornitore (supplier)

✅ **ESISTE** validazione in `createSupplierPriceListAction` (righe 757-789):

- Verifica duplicati per (courier_config_id, carrier_code, contract_code) per lo stesso utente
- Errore: "Esiste già un listino per questa configurazione"

#### Listini Personalizzati (custom)

❌ **NON ESISTE** validazione esplicita di unicità

- La clonazione (`resellerCloneSupplierPriceListAction`) non verifica duplicati
- Un reseller può creare più listini personalizzati con stesso (config_id, carrier_code, contract_code)

### 3. **Derivazione Carrier Code**

Il `carrier_code` viene **auto-compilato** dal `contract_code`:

- Esempio: `"postedeliverybusiness-SDA---Express---H24+"` → `"postedeliverybusiness"`
- Logica: `LOWER(SPLIT_PART(contract_code, '-', 1))`

**Problema potenziale**: Se il contract_code cambia formato, il carrier_code potrebbe essere inconsistente.

---

## 🎯 Problemi Identificati

### **Problema 1: Duplicati nel Preventivatore**

- **Causa**: Un reseller può avere più listini personalizzati attivi con stesso (config_id, carrier_code, contract_code)
- **Effetto**: Nel preventivatore compaiono duplicati (es. "Poste Italiane" due volte)
- **Fix attuale**: Deduplicazione per `displayName` in `/api/quotes/db/route.ts`

### **Problema 2: Inconsistenza Carrier Code**

- **Causa**: Carrier code derivato da contract_code, ma non validato
- **Effetto**: Possibili mismatch se contract_code ha formato diverso
- **Esempio**: `"poste-SDA-Express"` vs `"Postedeliverybusiness-SDA---Express"` → carrier_code diversi

### **Problema 3: Nessuna Garanzia di Unicità**

- **Causa**: Nessun vincolo database né validazione applicativa per listini personalizzati
- **Effetto**: Possibili duplicati che causano confusione nell'UI

---

## 💡 Analisi: Un Vincolo Risolverebbe Tutti i Problemi?

### **Scenario 1: Vincolo UNIQUE su (courier_config_id, carrier_code, contract_code) per utente**

```sql
-- Ipotesi: Vincolo per listini personalizzati dello stesso utente
CREATE UNIQUE INDEX idx_price_lists_unique_custom_config
ON price_lists(created_by,
  (metadata->>'courier_config_id'),
  (metadata->>'carrier_code'),
  (metadata->>'contract_code'))
WHERE list_type = 'custom'
  AND metadata->>'courier_config_id' IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
  AND metadata->>'contract_code' IS NOT NULL;
```

**Pro:**

- ✅ Previene duplicati a livello database
- ✅ Garantisce unicità per utente
- ✅ Forza scelta consapevole (modifica esistente vs nuovo)

**Contro:**

- ❌ **NON risolve** il problema dei duplicati nel preventivatore se:
  - I listini hanno `courier_config_id` diversi ma stesso corriere
  - Il carrier_code è derivato in modo inconsistente
  - Ci sono listini senza metadata (solo `courier_id`)
- ❌ **Complica** la clonazione: se cloni un listino con stesso (config, carrier, contract), fallisce
- ❌ **Non gestisce** listini globali (`courier_id = NULL`)

### **Scenario 2: Vincolo UNIQUE su (courier_id, carrier_code, contract_code)**

```sql
-- Ipotesi: Vincolo basato su courier_id invece di config_id
CREATE UNIQUE INDEX idx_price_lists_unique_custom_courier
ON price_lists(created_by, courier_id,
  (metadata->>'carrier_code'),
  (metadata->>'contract_code'))
WHERE list_type = 'custom'
  AND courier_id IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
  AND metadata->>'contract_code' IS NOT NULL;
```

**Pro:**

- ✅ Più semplice (usa `courier_id` invece di `courier_config_id`)
- ✅ Gestisce meglio i listini senza config API

**Contro:**

- ❌ **NON risolve** se un reseller ha più config API per lo stesso corriere
- ❌ **NON gestisce** listini globali (`courier_id = NULL`)

### **Scenario 3: Validazione Applicativa (senza vincolo database)**

**Pro:**

- ✅ Più flessibile (puoi gestire eccezioni)
- ✅ Messaggi di errore più chiari
- ✅ Non blocca operazioni legittime

**Contro:**

- ❌ Non garantisce unicità a livello database
- ❌ Possibili race conditions in creazione concorrente

---

## 🔍 Problemi che un Vincolo NON Risolverebbe

### **1. Duplicati da Config Diverse**

Se un reseller ha:

- Config A: `courier_config_id = "config-1"`, `contract_code = "postedeliverybusiness-PDB-4"`
- Config B: `courier_config_id = "config-2"`, `contract_code = "postedeliverybusiness-Solution-and-Shipi"`

Un vincolo su (courier_config_id, carrier_code, contract_code) **permetterebbe** entrambi, ma nel preventivatore compaiono come duplicati perché hanno stesso `displayName` ("Poste Italiane").

**Fix necessario**: Deduplicazione per `displayName` (già implementata) + filtro per listino attivo.

### **2. Listini senza Metadata**

Se un listino personalizzato non ha `metadata.courier_config_id` o `metadata.contract_code`, il vincolo non si applica.

**Fix necessario**: Validazione che richiede questi campi per listini personalizzati.

### **3. Inconsistenza Carrier Code**

Se il `carrier_code` è derivato in modo inconsistente dal `contract_code`, un vincolo non aiuta.

**Fix necessario**: Validazione che garantisce `carrier_code = LOWER(SPLIT_PART(contract_code, '-', 1))`.

---

## 📋 Raccomandazioni

### **Approccio 1: Validazione Applicativa (CONSIGLIATO)**

1. **Aggiungere validazione in `resellerCloneSupplierPriceListAction`**:
   - Verifica se esiste già un listino personalizzato attivo con stesso (courier_config_id, carrier_code, contract_code)
   - Se sì, chiedi conferma o blocca

2. **Aggiungere validazione in creazione/modifica listino personalizzato**:
   - Verifica unicità per (created_by, courier_config_id, carrier_code, contract_code)
   - Messaggio chiaro: "Esiste già un listino personalizzato attivo per questa configurazione"

3. **Migliorare deduplicazione nel preventivatore**:
   - ✅ Già implementata per `displayName`
   - ✅ Già implementato filtro per listino attivo
   - ⚠️ Verificare che funzioni correttamente

### **Approccio 2: Vincolo Database (OPZIONALE, da valutare)**

Solo se vogliamo garantire unicità a livello database:

```sql
-- Vincolo parziale per listini personalizzati attivi
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_unique_custom_active
ON price_lists(
  created_by,
  (metadata->>'courier_config_id'),
  (metadata->>'carrier_code'),
  (metadata->>'contract_code')
)
WHERE list_type = 'custom'
  AND status = 'active'
  AND metadata->>'courier_config_id' IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
  AND metadata->>'contract_code' IS NOT NULL;
```

**⚠️ ATTENZIONE**: Questo vincolo:

- Blocca creazione di duplicati anche se uno è `draft`
- Richiede che tutti i listini personalizzati abbiano metadata completi
- Potrebbe complicare la clonazione

---

## 🎯 Conclusione

**Un vincolo di unicità NON risolverebbe tutti i problemi** perché:

1. ❌ Non risolve duplicati da config diverse (stesso corriere, config diverse)
2. ❌ Non risolve inconsistenza carrier_code se derivato male
3. ❌ Non gestisce listini senza metadata
4. ❌ Complica la clonazione (devi modificare invece di creare nuovo)

**La soluzione migliore è**:

1. ✅ Validazione applicativa (più flessibile)
2. ✅ Deduplicazione nel preventivatore (già implementata)
3. ✅ Validazione carrier_code derivato da contract_code
4. ✅ Messaggi chiari all'utente

---

## 📝 Prossimi Passi

1. **Eseguire script di verifica** per vedere situazione reale nel database
2. **Analizzare risultati** per capire se ci sono duplicati reali
3. **Decidere** se aggiungere validazione applicativa o vincolo database
4. **Implementare** solo dopo aver capito la situazione reale
