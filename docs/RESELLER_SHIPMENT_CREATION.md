# 📦 Creazione Spedizione per Reseller - Come Funziona

## 🎯 Risposte alle Domande

### 1. ✅ Un Reseller può spedire direttamente?

**SÌ, assolutamente!**

Tutti gli utenti (inclusi reseller) possono creare spedizioni direttamente tramite:
- **Pagina UI**: `/dashboard/spedizioni/nuova`
- **API**: `/api/shipments/create`

**Non c'è differenza** tra reseller e utente normale nella creazione spedizione.

---

### 2. 🎨 Se ha listini personali, vede lo stesso design?

**SÌ, design identico**, ma con logica di calcolo prezzo diversa.

#### Design UI:
- ✅ **Stessa pagina** (`/dashboard/spedizioni/nuova`)
- ✅ **Stesso form** (mittente, destinatario, peso, corriere)
- ✅ **Stessa interfaccia** (bottoni, validazione, preview)

#### Differenza: Calcolo Prezzo

**Per Reseller con Listini Personalizzati:**
```
Reseller clicka "GLS"
  ↓
Sistema chiama calculateBestPriceForReseller()
  ↓
Confronta 2 prezzi:
  1. Prezzo API Reseller (listino fornitore reseller)
  2. Prezzo API Master (listino personalizzato assegnato)
  ↓
Seleziona il MIGLIORE (più economico)
  ↓
Mostra prezzo finale + badge "API Reseller" o "API Master"
```

**Per Utente Normale con Listini:**
```
Utente clicka "GLS"
  ↓
Sistema chiama calculatePriceWithRules()
  ↓
Usa listino assegnato (se presente)
  ↓
Mostra prezzo finale
```

**Design visivo identico**, ma il prezzo viene calcolato in modo diverso.

---

### 3. ⚠️ Se NON ha listini impostati, come funziona?

**Sistema cerca listino in ordine di priorità:**

#### Priorità 1: Listino Assegnato Direttamente
```
Cerca: price_lists WHERE assigned_to_user_id = userId
Se trova → Usa questo
```

#### Priorità 2: Listino Assegnato tramite Assignment
```
Cerca: price_list_assignments WHERE user_id = userId
Se trova → Usa listino assegnato
```

#### Priorità 3: Listino Globale (Admin)
```
Cerca: price_lists WHERE is_global = true
Se trova → Usa questo
```

#### Priorità 4: Listino di Default
```
Cerca: price_lists WHERE priority = 'default'
Se trova → Usa questo
```

#### ⚠️ Se NON trova NESSUN listino:

**Cosa succede:**
1. **Per PREVENTIVI (quote):**
   - `calculatePriceWithRules()` ritorna `null`
   - UI mostra errore: "Impossibile calcolare preventivo. Verifica listino configurato."

2. **Per CREAZIONE SPEDIZIONE:**
   - Il sistema **NON usa listini** per calcolare prezzo
   - Usa **costo reale dal corriere API** (chiamata `/shipping/create`)
   - Il prezzo viene calcolato **direttamente dal corriere** quando crei la spedizione
   - **NON c'è margine applicato** se non c'è listino

**Esempio Pratico:**

```
Reseller SENZA listini:
  ↓
Click "Crea Spedizione"
  ↓
Sistema chiama API corriere (es. Spedisci.Online)
  ↓
Corriere risponde: "Costo reale: €8.50"
  ↓
Sistema addebita €8.50 al wallet reseller
  ↓
Nessun margine applicato (perché non c'è listino)
```

**⚠️ IMPORTANTE:** 
- Se non c'è listino, il reseller paga il **costo reale del corriere**
- **Nessun margine** viene applicato
- Il reseller **non guadagna** su quella spedizione

---

## 📊 Tabella Riepilogativa

| **Scenario** | **Design UI** | **Calcolo Prezzo** | **Margine** |
|-------------|---------------|-------------------|-------------|
| **Reseller CON listini personali** | ✅ Identico | `calculateBestPriceForReseller()` (confronta Reseller vs Master) | ✅ Applicato da listino |
| **Reseller SENZA listini** | ✅ Identico | Costo reale API corriere | ❌ Nessun margine |
| **Utente normale CON listini** | ✅ Identico | `calculatePriceWithRules()` (usa listino assegnato) | ✅ Applicato da listino |
| **Utente normale SENZA listini** | ✅ Identico | Costo reale API corriere | ❌ Nessun margine |

---

## 🔍 Dettagli Tecnici

### Funzione: `calculateBestPriceForReseller`

**Cosa fa:**
1. Verifica se utente è reseller
2. Calcola prezzo con listino fornitore reseller (API Reseller)
3. Calcola prezzo con listino personalizzato assegnato (API Master)
4. Confronta e seleziona il migliore
5. Ritorna prezzo + informazioni su quale API è stata usata

**Esempio Output:**
```json
{
  "bestPrice": {
    "finalPrice": 12.75,
    "basePrice": 8.50,
    "margin": 4.25
  },
  "apiSource": "master",  // o "reseller" o "default"
  "resellerPrice": { "finalPrice": 13.00 },
  "masterPrice": { "finalPrice": 12.75 },
  "priceDifference": 0.25
}
```

### Funzione: `getApplicablePriceList`

**Cosa fa:**
1. Cerca listino in ordine di priorità (4 livelli)
2. Ritorna primo listino trovato
3. Se non trova nulla → ritorna `null`

**Priorità:**
1. `assigned_to_user_id` (assegnato direttamente)
2. `price_list_assignments` (assegnato tramite tabella)
3. `is_global = true` (listino globale admin)
4. `priority = 'default'` (listino di default)

---

## ✅ Conclusione

### Risposte Finali:

1. **Reseller può spedire direttamente?** 
   - ✅ **SÌ**, esattamente come utente normale

2. **Vede stesso design con listini personali?**
   - ✅ **SÌ**, design identico
   - ⚠️ **MA** calcolo prezzo diverso (confronta Reseller vs Master)

3. **Come funziona senza listini?**
   - ⚠️ **Sistema cerca listino in 4 livelli** (assegnato → assignment → globale → default)
   - ❌ **Se non trova nulla:**
     - Preventivi → Errore "Listino non configurato"
     - Creazione spedizione → Usa costo reale corriere (nessun margine)

---

## 🎯 Raccomandazione

**Per Reseller:**
- ✅ **Sempre assegnare listini personali** per applicare margini
- ✅ **Configurare listini fornitore** (API Reseller) per confronto automatico
- ⚠️ **Senza listini**, il reseller paga costo reale senza margine

**Per Sistema:**
- ✅ Design unificato → Ottimo (stessa UX per tutti)
- ⚠️ Gestione "senza listini" → Potrebbe essere migliorata (mostrare warning invece di errore)
