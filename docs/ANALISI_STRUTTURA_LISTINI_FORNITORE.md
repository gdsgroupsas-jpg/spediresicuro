# 🔍 Analisi: Struttura Listini Fornitore Multi-Config

## Scenario Reale

### **Configurazione API "Speed Go"**

Contract mapping contiene:

- `gls-5000` → "Gls"
- `gls-5000-ba` → "Gls"
- `gls-europa` → "Gls"
- `postedeliverybusiness-PDB-4` → "PosteDeliveryBusiness"

### **Configurazione API "Spedizioni Prime"**

Contract mapping contiene:

- `interno` → "Interno" (solo pochi CAP)
- `postedeliverybusiness-Solution-and-Shipi` → "PosteDeliveryBusiness" (versione 1)
- `postedeliverybusiness-Solution-and-Shipi-2` → "PosteDeliveryBusiness" (versione 2, nome diverso)
- `ups-internazionale` → "UPS"

### **Come Reseller**

- Avrà **8 listini fornitore** (uno per ogni contract code)
- Raggruppati per configurazione API
- Può usarli **tutti, alcuni, o nessuno** a seconda della convenienza

---

## 📊 Come il Sistema Gestisce Questa Struttura

### **1. Creazione Listini Fornitore**

#### Da Sincronizzazione API (`syncPriceListsFromSpedisciOnline`)

✅ **SALVA correttamente**:

- `metadata.courier_config_id` = ID configurazione API (es. "config-speedgo-id")
- `metadata.carrier_code` = codice corriere (es. "postedeliverybusiness")
- `metadata.contract_code` = codice contratto completo (es. "postedeliverybusiness-PDB-4")
- `courier_id` = UUID corriere dalla tabella `couriers` (se matcha)

**Esempio**:

```json
{
  "name": "Listino PosteDeliveryBusiness - Speed Go",
  "list_type": "supplier",
  "metadata": {
    "courier_config_id": "config-speedgo-uuid",
    "carrier_code": "postedeliverybusiness",
    "contract_code": "postedeliverybusiness-PDB-4",
    "synced_at": "2026-01-11T..."
  },
  "courier_id": "uuid-poste-italiane"
}
```

#### Da Creazione Manuale (`createSupplierPriceListAction`)

✅ **SALVA correttamente**:

- Stessi metadata della sincronizzazione
- Validazione unicità per (courier_config_id, carrier_code, contract_code) per utente

---

### **2. Clonazione in Listini Personalizzati**

#### Funzione `reseller_clone_supplier_price_list`

✅ **PRESERVA metadata**:

```sql
jsonb_build_object(
  'cloned_from', p_source_id,
  'cloned_at', NOW(),
  'cloned_by', v_caller_id,
  'margin_type', p_margin_type,
  'margin_value', p_margin_value
) || COALESCE(v_source_record.metadata, '{}'::jsonb)
```

**Problema identificato**: I metadata vengono **mergiati**, quindi:

- ✅ `courier_config_id` viene preservato
- ✅ `carrier_code` viene preservato
- ✅ `contract_code` viene preservato
- ⚠️ Ma vengono aggiunti `cloned_from`, `cloned_at`, `cloned_by`, `margin_type`, `margin_value`

**Risultato**: Il listino personalizzato **mantiene** l'identificazione della configurazione API originale.

---

### **3. Selezione Listini nel Preventivatore**

#### Logica Attuale (`calculateBestPriceForReseller`)

**PRIORITÀ 1**: Listini personalizzati attivi

```typescript
// Cerca listini personalizzati attivi
const { data: customPriceLists } = await supabaseAdmin
  .from('price_lists')
  .select('*')
  .eq('created_by', userId)
  .eq('list_type', 'custom')
  .eq('status', 'active');
```

**Problema**:

- ❌ **NON filtra** per `courier_config_id` o `contract_code`
- ❌ Se ci sono 2 listini personalizzati attivi con stesso `courier_id` ma `contract_code` diversi, usa il primo trovato
- ❌ **NON distingue** tra "postedeliverybusiness-PDB-4" (Speed Go) e "postedeliverybusiness-Solution-and-Shipi" (Spedizioni Prime)

#### Filtro Corrieri (`/api/quotes/db/route.ts`)

**Logica attuale**:

```typescript
// Filtra per courier_id dai listini attivi
const activeCourierIds = new Set(
  activeCustomPriceLists.map((pl) => pl.courier_id).filter((id) => id !== null)
);
```

**Problema**:

- ❌ Filtra solo per `courier_id`
- ❌ Se "PosteDeliveryBusiness" da Speed Go e "PosteDeliveryBusiness" da Spedizioni Prime hanno stesso `courier_id`, vengono entrambi considerati
- ❌ La deduplicazione per `displayName` nasconde la differenza

---

## 🎯 Problemi Identificati

### **Problema 1: Il Sistema NON Distingue tra Config Diverse**

**Scenario**:

- Listino A: `courier_config_id = "speedgo-id"`, `contract_code = "postedeliverybusiness-PDB-4"`
- Listino B: `courier_config_id = "spedizioni-prime-id"`, `contract_code = "postedeliverybusiness-Solution-and-Shipi"`

**Comportamento attuale**:

- Entrambi hanno `courier_id` = UUID "Poste Italiane"
- Entrambi hanno `displayName` = "Poste Italiane"
- Nel preventivatore: **solo 1 entry** (deduplicazione per displayName)
- **NON distingue** quale config usare

### **Problema 2: Il Reseller NON Può Scegliere Quale Config Usare**

**Scenario**:

- Reseller ha clonato:
  - Listino da Speed Go: "postedeliverybusiness-PDB-4" (prezzo migliore per alcune zone)
  - Listino da Spedizioni Prime: "postedeliverybusiness-Solution-and-Shipi" (prezzo migliore per altre zone)

**Comportamento attuale**:

- Se entrambi sono attivi, il sistema usa il primo trovato
- **NON può** scegliere quale usare in base alla destinazione
- **NON può** confrontare prezzi tra config diverse

### **Problema 3: Validazione Unicità Blocca Config Diverse**

**Validazione attuale** (`createSupplierPriceListAction`):

```typescript
// Verifica duplicati per (courier_config_id, carrier_code, contract_code)
if (
  metadata.courier_config_id === data.metadata?.courier_config_id &&
  metadata.carrier_code?.toLowerCase() === data.metadata?.carrier_code?.toLowerCase() &&
  metadata.contract_code?.toLowerCase() === data.metadata?.contract_code?.toLowerCase()
)
```

**Problema**:

- ✅ Funziona per listini fornitore (previene duplicati)
- ❌ Ma se un reseller clona listini da **config diverse** con stesso contract_code, la validazione NON si applica (perché sono listini personalizzati, non fornitore)

---

## 💡 Conclusione

### **Il Sistema NON Capisce Completamente Questa Struttura**

**Cosa funziona**:

- ✅ Listini fornitore vengono salvati con `courier_config_id` e `contract_code`
- ✅ Metadata vengono preservati durante la clonazione
- ✅ Validazione unicità per listini fornitore

**Cosa NON funziona**:

- ❌ Il preventivatore NON distingue tra listini da config diverse
- ❌ Il reseller NON può scegliere quale config usare
- ❌ La deduplicazione nasconde la differenza tra config diverse
- ❌ Non c'è logica per confrontare prezzi tra config diverse

---

## 🔧 Cosa Serve per Rendere il Sistema "Consapevole"

### **1. Distinguere Listini per Config nel Preventivatore**

**Opzione A**: Mostrare contract_code nell'UI

- Invece di solo "Poste Italiane (Default)"
- Mostrare: "Poste Italiane - PDB-4 (Speed Go)" vs "Poste Italiane - Solution (Spedizioni Prime)"

**Opzione B**: Permettere selezione config

- Il reseller può scegliere quale config usare per ogni corriere
- Il preventivatore mostra solo listini dalla config selezionata

### **2. Logica di Selezione Intelligente**

**Opzione A**: Confronto automatico

- Confronta prezzi tra tutte le config disponibili
- Seleziona automaticamente la migliore

**Opzione B**: Selezione manuale

- Il reseller configura quale config usare per ogni corriere
- Il preventivatore usa solo quella config

### **3. Filtro per Config nel Preventivatore**

**Modifica necessaria**:

```typescript
// Invece di filtrare solo per courier_id
// Filtra per (courier_id, courier_config_id) se configurato
// O mostra tutti i listini con contract_code diverso
```

---

## 📋 Risposta alla Domanda

**"Nel sistema è chiara sta cosa?"**

**NO, attualmente NON è completamente chiara** perché:

1. ❌ Il preventivatore NON distingue tra config diverse
2. ❌ La deduplicazione nasconde la differenza
3. ❌ Il reseller NON può scegliere quale config usare
4. ❌ Non c'è logica per gestire listini multipli dello stesso corriere da config diverse

**Ma**:

- ✅ I metadata vengono salvati correttamente
- ✅ La struttura è presente nel database
- ✅ Manca solo la logica di utilizzo nel preventivatore

---

## 🎯 Prossimi Passi

1. **Decidere comportamento desiderato**:
   - Il reseller vuole vedere TUTTI i listini disponibili (anche da config diverse)?
   - O vuole configurare quale config usare per ogni corriere?

2. **Modificare preventivatore**:
   - Mostrare contract_code o config name nell'UI
   - Permettere selezione config o confronto automatico

3. **Aggiungere logica selezione**:
   - Configurazione preferenze reseller
   - O confronto automatico prezzi
