# 🔍 Investigazione: Duplicati Corrieri nel Preventivatore

## Problema Segnalato

Nel preventivatore compaiono **due corrieri con etichetta "Default"**:

- **Postedeliverybusiness** (Default) - €6.20
- **Poste Italiane** (Default) - €6.20

Entrambi hanno lo stesso costo fornitore e la stessa etichetta "Default".

---

## 🔎 Analisi del Flusso

### 1. Come vengono recuperati i corrieri

**Funzione:** `getAvailableCouriersForUser(userId)` in `lib/db/price-lists.ts`

**Logica:**

1. Recupera configurazioni con 3 priorità:
   - **Priorità 1:** Configurazioni personali (`owner_user_id = userId`)
   - **Priorità 2:** Configurazione assegnata (`assigned_config_id`)
   - **Priorità 3:** Configurazioni default globali (`is_default = true`, `owner_user_id = NULL`)

2. Estrae corrieri da `contract_mapping` di tutte le configurazioni
3. Usa **Map con chiave composita:** `courierName::contractCode::providerId`
4. **Deduplicazione:** Se esiste già una entry con la stessa chiave, mantiene la prima (priorità personali > assegnate > default)

### 2. Come viene determinato il `contractCode`

**In `getAvailableCouriersForUser`:**

- `contractCode` viene preso direttamente dalla chiave del `contract_mapping`
- Se non esiste, rimane `undefined`

**In `/api/quotes/db/route.ts` (riga 201-203):**

```typescript
contractCode: courier.contractCode || `${courier.courierName.toLowerCase()}-default`;
```

- Se `contractCode` è vuoto/null, viene generato come `{courierName}-default`

### 3. Come viene mostrato "Default" nell'UI

**In `intelligent-quote-comparator.tsx` (riga 1573-1580):**

```typescript
const formatContractCode = (code: string) => {
  if (!code) return 'Standard';
  return code
    .replace(/^(gls|postedeliverybusiness|brt|sda|ups|dhl)-/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .substring(0, 25);
};
```

- Se `contractCode` è vuoto → mostra "Standard"
- Se `contractCode` contiene "default" → dopo il replace mostra "Default"

---

## 🎯 Possibili Cause del Problema

### **Ipotesi 1: Due configurazioni diverse con stesso corriere**

**Scenario:**

- Configurazione **personale** del reseller: `PosteDeliveryBusiness` con `contractCode = "postedeliverybusiness-default"`
- Configurazione **default globale**: `PosteDeliveryBusiness` con `contractCode = ""` o diverso

**Risultato:**

- Due entry nella Map perché chiavi diverse: `PosteDeliveryBusiness::postedeliverybusiness-default::provider1` vs `PosteDeliveryBusiness::::provider2`
- Entrambe vengono mostrate nel preventivatore
- Entrambe vengono formattate come "Default" nell'UI

### **Ipotesi 2: Due provider diversi con stesso corriere**

**Scenario:**

- Provider A: `PosteDeliveryBusiness` con `contractCode = "default"`
- Provider B: `PosteDeliveryBusiness` con `contractCode = "default"`

**Risultato:**

- Due entry nella Map perché `providerId` diversi
- Entrambe vengono mostrate

### **Ipotesi 3: Mapping duplicato nel contract_mapping**

**Scenario:**

- Una configurazione ha due entry nel `contract_mapping`:
  - `"postedeliverybusiness-default": "PosteDeliveryBusiness"`
  - `"": "PosteDeliveryBusiness"` (chiave vuota)

**Risultato:**

- Due entry nella Map
- Entrambe vengono mostrate

---

## 🔧 Script di Investigazione

**File:** `scripts/investigate-duplicate-couriers.sql`

**Cosa fa:**

1. Mostra info utente reseller
2. Lista configurazioni personali
3. Lista configurazione assegnata
4. Lista configurazioni default globali
5. Lista listini personalizzati attivi
6. Analizza tutti i corrieri che verrebbero mostrati
7. Identifica duplicati potenziali

**Uso:**

```bash
# Sostituisci l'email del reseller nello script
psql -h localhost -U postgres -d spediresicuro -f scripts/investigate-duplicate-couriers.sql
```

---

## 📋 Prossimi Passi

1. **Eseguire lo script SQL** per vedere cosa c'è nel database
2. **Verificare i log** del preventivatore per vedere cosa viene passato
3. **Identificare la causa** specifica (configurazioni duplicate, provider diversi, ecc.)
4. **Implementare fix** basato sulla causa identificata

---

## 💡 Possibili Soluzioni

### **Soluzione 1: Deduplicazione per displayName**

Se due corrieri hanno lo stesso `displayName` ma `contractCode` diversi, mostrare solo uno (quello con priorità più alta).

### **Soluzione 2: Filtro per listino personalizzato attivo**

Se il reseller ha un listino personalizzato attivo per un corriere specifico, mostrare solo quel corriere (già implementato, ma potrebbe non funzionare se ci sono duplicati).

### **Soluzione 3: Unificazione contractCode**

Se due configurazioni hanno lo stesso corriere ma `contractCode` diversi (o vuoti), unificare usando quello della configurazione con priorità più alta.

---

## 📝 Note

- La deduplicazione attuale usa `courierName::contractCode::providerId`, quindi se uno di questi è diverso, vengono mostrati entrambi
- Il problema potrebbe essere anche nel mapping dei nomi: "PosteDeliveryBusiness" vs "Poste Italiane" potrebbero essere lo stesso corriere con nomi diversi
