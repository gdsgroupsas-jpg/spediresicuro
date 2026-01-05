# Analisi: Come Anne Calcola i Prezzi delle Spedizioni

## 📋 Domanda Chiave

**Se abbiamo sync completo dei listini, Anne può dire quanto costa una spedizione 26 kg a Roma con PDB (Poste Delivery Business) e dirci tutte le varie opzioni?**

**Cosa fa: chiamate API dirette o vede nel database dei listini sincronizzati?**

---

## 🔍 Analisi Completa del Flusso

### 1. Richiesta Utente → Anne

**Esempio**: "Quanto costa spedizione 26 kg a Roma con PDB?"

**Tool chiamato**: `calculate_price` (definito in `lib/ai/tools.ts`)

**Parametri**:
- `weight`: 26
- `destinationZip`: "00100" (Roma)
- `destinationProvince`: "RM"
- `serviceType`: "standard" (default)

---

### 2. Esecuzione Tool (`lib/ai/tools.ts` → `executeTool`)

**Flusso**:
```
executeTool('calculate_price', args) 
  → calculateOptimalPrice(pricingRequest)
    → calculatePrice(courierId, weight, zip, serviceType, options)
      → getActivePriceList(courierId)  ← QUERY DATABASE
        → calculatePriceFromList(priceList, weight, zip, serviceType, options)
```

---

### 3. **RISPOSTA CHIAVE: USA IL DATABASE, NON CHIAMATE API DIRETTE**

#### ✅ **Anne USA I LISTINI SINCRONIZZATI NEL DATABASE**

**Prova 1**: `lib/ai/pricing-engine.ts` (linea 72-107)
```typescript
export async function calculateOptimalPrice(request: PricingRequest) {
  // 1. Recupera corrieri dal DATABASE
  const { data: couriers } = await supabaseAdmin
    .from('couriers')
    .select('id, name, code')
    .eq('status', 'active');
  
  // 2. Per ogni corriere, calcola prezzo
  for (const courier of couriers) {
    const priceResult = await calculatePrice(
      courier.id,  // ← ID corriere dal DB
      request.weight,
      request.destinationZip,
      serviceType,
      options
    );
  }
}
```

**Prova 2**: `lib/db/price-lists.ts` (linea 203-219)
```typescript
export async function calculatePrice(
  courierId: string,  // ← ID corriere (UUID)
  weight: number,
  destinationZip: string,
  serviceType: string,
  options?: {...}
) {
  // QUERY DATABASE per listino attivo
  const priceList = await getActivePriceList(courierId);
  
  if (!priceList) {
    return null;  // ← Se non c'è listino, ritorna null
  }
  
  // Calcola usando listino dal DB
  const result = calculatePriceFromList(priceList, weight, zip, serviceType, options);
}
```

**Prova 3**: `lib/db/price-lists.ts` (linea 153-176)
```typescript
export async function getActivePriceList(courierId: string) {
  // QUERY DATABASE: cerca listino attivo per corriere
  const { data, error } = await supabase
    .from("price_lists")
    .select("*, entries:price_list_entries(*)")  // ← Include entries
    .eq("courier_id", courierId)  // ← Match per courier_id
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  return data as PriceList;  // ← Listino con entries dal DB
}
```

---

### 4. Come Viene Trovato il Prezzo Corretto

#### Step 1: Matching Corriere

**Problema**: L'utente dice "PDB" (Poste Delivery Business), ma nel database:
- Tabella `couriers` ha `id` (UUID) e `code` (es. "postedeliverybusiness")
- Tabella `price_lists` ha `courier_id` (UUID) che punta a `couriers.id`

**Soluzione**: `calculateOptimalPrice` itera su TUTTI i corrieri attivi e calcola per ognuno.

#### Step 2: Matching Entry nel Listino

**Funzione**: `calculatePriceFromList` in `lib/pricing/calculator.ts`

**Algoritmo**:
1. Cerca entry che matcha:
   - ✅ **Peso**: `weight >= entry.weight_from && weight <= entry.weight_to`
   - ✅ **Servizio**: `entry.service_type === serviceType`
   - ✅ **ZIP** (opzionale): Se `entry.zip_code_from` e `entry.zip_code_to` esistono, verifica range

2. **Esempio per 26 kg a Roma (00100)**:
   - Cerca entry con `weight_from <= 26 && weight_to >= 26`
   - Cerca entry con `zone_code` che matcha Roma (es. "IT-ITALIA" o "IT-STD")
   - Se trova match, usa `entry.base_price`

#### Step 3: Calcolo Sovrapprezzi

**Da `price_list_entries`**:
- ✅ **Fuel surcharge**: `basePrice * (fuel_surcharge_percent / 100)`
- ✅ **Island surcharge**: Se destinazione isola
- ✅ **ZTL surcharge**: Se destinazione ZTL
- ✅ **COD surcharge**: Se `options.cashOnDelivery === true` → `entry.cash_on_delivery_surcharge`
- ✅ **Insurance**: Se `options.insurance === true` → `declaredValue * (entry.insurance_rate_percent / 100)`

#### Step 4: Applicazione Margine

**Da `lib/ai/pricing-engine.ts` (linea 111)**:
```typescript
const marginPercent = 15; // Margine di ricarico standard
const margin = (priceResult.totalCost * marginPercent) / 100;
const finalPrice = priceResult.totalCost + margin;
```

---

### 5. **⚠️ PROBLEMA CRITICO: Configurazioni Manuali NON Applicate**

#### ❌ **Le Configurazioni Manuali NON Vengono Usate**

**Evidenza**:
1. `calculatePriceFromList` in `lib/pricing/calculator.ts` usa SOLO:
   - `entry.cash_on_delivery_surcharge` (da `price_list_entries`)
   - `entry.insurance_rate_percent` (da `price_list_entries`)

2. **NON** cerca in `supplier_price_list_config`:
   - ❌ `insurance_config` (max_value, fixed_price, percent)
   - ❌ `cod_config` (array di scaglioni)
   - ❌ `accessory_services_config` (servizi accessori)
   - ❌ `storage_config` (giacenze)
   - ❌ `pickup_config` (ritiro)

**Conseguenza**: 
- Le configurazioni manuali salvate nel dialog "Configura" **NON vengono applicate** nel calcolo prezzi
- Anne usa solo i dati sincronizzati da Spedisci.Online (che potrebbero essere incompleti)

---

### 6. Come Funziona il Matching Zone/Peso

#### Zone nel Database

**Dalla sync**: Le zone vengono salvate come `zone_code` in `price_list_entries`:
- `IT-ITALIA` (Italia standard)
- `IT-SARDEGNA`
- `IT-CALABRIA`
- `IT-SICILIA`
- `IT-LIVIGNO`
- `IT-ISOLE-MINORI`
- `EU-1`, `EU-2`, etc.

**Per Roma (00100)**:
- Match con `IT-ITALIA` o `IT-STD` (se mappato)

#### Peso 26 kg

**Dalla sync**: Le entries hanno `weight_from` e `weight_to`:
- Esempio: `weight_from: 20, weight_to: 30` → match per 26 kg
- Se non c'è match esatto, potrebbe non trovare prezzo

---

### 7. Esempio Concreto: 26 kg a Roma con PDB

#### Flusso Completo:

1. **Utente chiede**: "Quanto costa spedizione 26 kg a Roma con PDB?"

2. **Anne chiama tool**: `calculate_price({ weight: 26, destinationZip: "00100", destinationProvince: "RM" })`

3. **Sistema**:
   - Recupera tutti i corrieri attivi dal DB
   - Per ogni corriere (incluso PDB se presente):
     - Cerca listino fornitore: `price_lists WHERE courier_id = <pdb_id> AND list_type = 'supplier' AND status = 'active'`
     - Se trovato, carica entries: `price_list_entries WHERE price_list_id = <list_id>`
     - Cerca entry che matcha:
       - Peso: `26 >= weight_from AND 26 <= weight_to`
       - Zone: `zone_code = 'IT-ITALIA'` (o simile per Roma)
       - Servizio: `service_type = 'standard'`

4. **Calcolo**:
   - `basePrice = entry.base_price` (es. €15.50)
   - `fuelSurcharge = basePrice * (fuel_surcharge_percent / 100)` (es. €0.50)
   - `totalCost = basePrice + fuelSurcharge` (es. €16.00)
   - `margin = totalCost * 0.15` (es. €2.40)
   - `finalPrice = totalCost + margin` (es. €18.40)

5. **Risultato**: Anne risponde con prezzo finale e opzioni disponibili

---

### 8. **Cosa Manca (Configurazioni Manuali)**

#### ❌ **NON Integrato**:

1. **Assicurazione personalizzata**:
   - Config salvata in `supplier_price_list_config.insurance_config`
   - Ma calcolo usa solo `entry.insurance_rate_percent`
   - **Dovrebbe**: Controllare `insurance_config.max_value`, `fixed_price`, `percent`

2. **Contrassegni personalizzati**:
   - Config salvata in `supplier_price_list_config.cod_config` (array di scaglioni)
   - Ma calcolo usa solo `entry.cash_on_delivery_surcharge` (fisso)
   - **Dovrebbe**: Cercare scaglione corretto in `cod_config` basato su importo COD

3. **Servizi Accessori**:
   - Config salvata in `supplier_price_list_config.accessory_services_config`
   - Ma calcolo NON li considera
   - **Dovrebbe**: Aggiungere prezzo servizi accessori se richiesti

4. **Giacenze/Ritiro**:
   - Config salvata ma NON usata nel calcolo

---

### 9. **Risposta Diretta alla Domanda**

#### ✅ **Anne USA IL DATABASE, NON CHIAMATE API DIRETTE**

**Prove**:
1. ✅ `calculateOptimalPrice` recupera corrieri dal DB (`supabase.from('couriers')`)
2. ✅ `calculatePrice` recupera listino dal DB (`getActivePriceList`)
3. ✅ `calculatePriceFromList` calcola da entries nel DB
4. ✅ **ZERO chiamate API a Spedisci.Online** durante il calcolo prezzi

**Vantaggi**:
- ⚡ **Velocità**: Query DB locale vs chiamata API esterna
- 💰 **Costi**: Zero costi API per ogni preventivo
- 🔒 **Affidabilità**: Funziona anche se Spedisci.Online è down
- 📊 **Storico**: Prezzi sincronizzati rimangono disponibili

**Svantaggi**:
- ⚠️ **Dati potenzialmente obsoleti**: Se sync non eseguita di recente
- ⚠️ **Configurazioni manuali non applicate**: Bug da fixare

---

### 10. **Cosa Succede se Non C'è Listino Sincronizzato?**

**Scenario**: Utente chiede prezzo per PDB, ma non c'è listino sincronizzato nel DB.

**Risultato**:
- `getActivePriceList(courierId)` ritorna `null`
- `calculatePrice` ritorna `null`
- `calculateOptimalPrice` esclude quel corriere dai risultati
- Anne risponde: "Nessun corriere disponibile per questa destinazione" (o simile)

**NON** fa chiamata API diretta a Spedisci.Online per recuperare il prezzo.

---

### 11. **Opzioni Disponibili**

#### Opzioni Attualmente Supportate:

1. **Contrassegno (COD)**:
   - ✅ Supportato (usa `entry.cash_on_delivery_surcharge`)
   - ⚠️ Ma NON usa configurazione manuale (`cod_config`)

2. **Assicurazione**:
   - ✅ Supportato (usa `entry.insurance_rate_percent`)
   - ⚠️ Ma NON usa configurazione manuale (`insurance_config`)

3. **Servizi Accessori**:
   - ❌ **NON supportato** nel calcolo
   - ⚠️ Config salvata ma non applicata

4. **Ritiro**:
   - ❌ **NON supportato** nel calcolo
   - ⚠️ Config salvata ma non applicata

5. **Giacenze**:
   - ❌ **NON supportato** nel calcolo
   - ⚠️ Config salvata ma non applicata

---

### 12. **Riepilogo Tecnico**

#### Flusso Completo:

```
Utente: "Quanto costa 26 kg a Roma con PDB?"
  ↓
Anne Tool: calculate_price
  ↓
calculateOptimalPrice()
  ├─ Query DB: SELECT * FROM couriers WHERE status = 'active'
  ├─ Per ogni corriere:
  │   ├─ calculatePrice(courierId, 26, "00100", "standard")
  │   │   ├─ Query DB: SELECT * FROM price_lists 
  │   │   │   WHERE courier_id = <id> AND status = 'active'
  │   │   │   WITH entries:price_list_entries(*)
  │   │   ├─ calculatePriceFromList(priceList, 26, "00100", "standard")
  │   │   │   ├─ Find entry: weight 26kg, zone IT-ITALIA, service standard
  │   │   │   ├─ basePrice = entry.base_price
  │   │   │   ├─ surcharges = fuel + island + ztl + cod + insurance
  │   │   │   └─ totalCost = basePrice + surcharges
  │   │   └─ return { basePrice, surcharges, totalCost }
  │   ├─ margin = totalCost * 0.15
  │   └─ finalPrice = totalCost + margin
  └─ return results[] (ordinati per prezzo)
  ↓
Anne risponde con top 3 opzioni
```

#### Query Database Eseguite:

1. **Corrieri**: `SELECT * FROM couriers WHERE status = 'active'`
2. **Listino**: `SELECT *, entries:price_list_entries(*) FROM price_lists WHERE courier_id = ? AND status = 'active'`
3. **Matching entry**: Fatto in memoria (non query aggiuntiva)

**Totale**: 2 query DB per corriere (1 per corrieri, 1 per listino)

---

### 13. **Gap da Colmare**

#### ⚠️ **Configurazioni Manuali NON Integrate**

**File da modificare**: `lib/pricing/calculator.ts` o `lib/db/price-lists.ts`

**Cosa aggiungere**:
1. Recuperare `supplier_price_list_config` per il `price_list_id`
2. Applicare `insurance_config` invece di `entry.insurance_rate_percent`
3. Applicare `cod_config` (scaglioni) invece di `entry.cash_on_delivery_surcharge`
4. Aggiungere `accessory_services_config` se servizi richiesti
5. Aggiungere `pickup_config` se ritiro richiesto

**Priorità**: 🔴 **ALTA** - Le configurazioni manuali sono inutili se non applicate

---

### 14. **Conclusione**

#### ✅ **Risposta Diretta**:

**Anne USA IL DATABASE dei listini sincronizzati, NON fa chiamate API dirette.**

**Per 26 kg a Roma con PDB**:
1. ✅ Cerca listino PDB nel DB (`price_lists WHERE courier_id = <pdb_id>`)
2. ✅ Cerca entry che matcha peso 26kg e zona Roma
3. ✅ Calcola prezzo base + sovrapprezzi + margine
4. ✅ Restituisce risultato

**Opzioni disponibili**:
- ✅ Contrassegno (ma usa solo dati sync, non config manuale)
- ✅ Assicurazione (ma usa solo dati sync, non config manuale)
- ❌ Servizi accessori (config salvata ma non applicata)
- ❌ Ritiro (config salvata ma non applicata)

**Prossimo step**: Integrare configurazioni manuali nel calcolo prezzi.

