# 🎯 Design: Selezione Corriere con Preventivi Real-Time

## 📊 Output Desiderato - Visualizzazione

### Tabella Output per Reseller

| **Corriere**       | **Contract Code**           | **Costo Fornitore** | **Prezzo Vendita** | **Margine** | **Stato**         |
| ------------------ | --------------------------- | ------------------- | ------------------ | ----------- | ----------------- |
| **GLS**            | `gls-express-2024`          | €8.50               | €12.75             | +50%        | ✅ Disponibile    |
| **Poste Italiane** | `postedelivery-SDA-Express` | €7.20               | €10.80             | +50%        | ✅ Disponibile    |
| **Poste Italiane** | `postedelivery-Standard`    | €5.80               | €8.70              | +50%        | ✅ Disponibile    |
| **UPS**            | `ups-standard-it`           | €15.00              | €22.50             | +50%        | ⏳ Caricamento... |
| **Interno**        | `interno-warehouse`         | €3.50               | €5.25              | +50%        | ✅ Disponibile    |

---

## 🎨 Layout UI - Diagramma

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TICKET DI SPEDIZIONE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 CORRIERE DISPONIBILI                                                │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │ │
│  │  │   GLS        │  │  Poste It.   │  │  Poste It.   │           │ │
│  │  │              │  │  (Express)   │  │  (Standard)  │           │ │
│  │  │  €8.50       │  │  €7.20       │  │  €5.80       │           │ │
│  │  │  → €12.75    │  │  → €10.80    │  │  → €8.70     │           │ │
│  │  │  [SELECTED]  │  │  [Available] │  │  [Available] │           │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │ │
│  │                                                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐                             │ │
│  │  │   UPS        │  │  Interno     │                             │ │
│  │  │              │  │              │                             │ │
│  │  │  ⏳ Loading  │  │  €3.50       │                             │ │
│  │  │  ...         │  │  → €5.25     │                             │ │
│  │  │              │  │  [Available] │                             │ │
│  │  └──────────────┘  └──────────────┘                             │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  📊 DETTAGLIO PREZZO (GLS selezionato)                            │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  Costo Fornitore:     €8.50                                       │ │
│  │  Margine (+50%):      €4.25                                       │ │
│  │  ─────────────────────────────                                    │ │
│  │  Prezzo Vendita:      €12.75                                       │ │
│  │                                                                   │ │
│  │  📋 Breakdown:                                                    │ │
│  │  • Base:              €6.00                                       │ │
│  │  • Peso (2kg):        €2.50                                       │ │
│  │  • Margine:           €4.25                                       │ │
│  │                                                                   │ │
│  │  📦 Contract: gls-express-2024                                    │ │
│  │  🔗 Provider: Spedisci.Online                                     │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Struttura Dati Output

### Oggetto Corriere con Preventivo

```typescript
interface CourierQuote {
  // Identificazione
  courierName: string; // "GLS", "Poste Italiane"
  displayName: string; // "GLS", "Poste Italiane"
  contractCode: string; // "gls-express-2024"
  providerId: string; // "spedisci_online"
  configId: string; // ID configurazione API

  // Prezzi
  providerCost: number; // €8.50 (da API real-time)
  sellingPrice: number; // €12.75 (da listino personale)
  margin: {
    amount: number; // €4.25
    percentage: number; // 50%
  };

  // Breakdown
  breakdown: {
    base: number; // €6.00
    weight: number; // €2.50
    surcharges: number; // €0.00
    margin: number; // €4.25
  };

  // Stato
  status: 'loading' | 'ready' | 'error' | 'unavailable';
  error?: string;

  // Metadata
  lastUpdated: Date;
  source: 'api_realtime' | 'cached' | 'estimated';
}
```

---

## 🔄 Flusso Interazione

```
1. UTENTE CLICCA SU BOTTONE CORRIERE
   ↓
2. SISTEMA MOSTRA LOADING STATE
   [Bottone mostra: "⏳ Caricamento..."]
   ↓
3. CHIAMATA API REAL-TIME
   POST /api/quotes/realtime
   {
     courierName: "GLS",
     contractCode: "gls-express-2024",
     weight: 2,
     destination: { zip: "80040", province: "NA" }
   }
   ↓
4. SISTEMA CALCOLA PREZZO VENDITA
   Usa calculatePriceWithRules() con listino personale
   ↓
5. AGGIORNA UI
   [Bottone mostra: "€8.50 → €12.75"]
   [Modulo affianco si apre con dettagli]
   ↓
6. UTENTE VEDE:
   - Costo fornitore (da API)
   - Prezzo vendita (da listino)
   - Margine calcolato
   - Breakdown completo
```

---

## 🎯 Esempio Output Completo

### Scenario: Reseller con 2 contratti Poste

```
┌────────────────────────────────────────────────────────────┐
│ CORRIERE DISPONIBILI (Raggruppati per Contract Code)      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  POSTE ITALIANE                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐   │
│  │ Contract: Express      │  │ Contract: Standard    │   │
│  │ Code: SDA-Express      │  │ Code: SDA-Standard    │   │
│  │                        │  │                        │   │
│  │ Fornitore: €7.20       │  │ Fornitore: €5.80      │   │
│  │ Vendita:   €10.80      │  │ Vendita:   €8.70      │   │
│  │ Margine:   +50%        │  │ Margine:   +50%        │   │
│  │                        │  │                        │   │
│  │ [SELEZIONA]            │  │ [SELEZIONA]            │   │
│  └────────────────────────┘  └────────────────────────┘   │
│                                                            │
│  GLS                                                        │
│  ┌────────────────────────┐                               │
│  │ Contract: Express      │                               │
│  │ Code: gls-express-2024 │                               │
│  │                        │                               │
│  │ Fornitore: €8.50       │                               │
│  │ Vendita:   €12.75      │                               │
│  │ Margine:   +50%        │                               │
│  │                        │                               │
│  │ [SELEZIONA]            │                               │
│  └────────────────────────┘                               │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 📊 DETTAGLIO: Poste Italiane (Express)                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Costo Fornitore (API Real-Time):                         │
│  ─────────────────────────────────                        │
│  Base:              €5.00                                  │
│  Peso (2kg):        €2.20                                  │
│  ─────────────────────────────────                        │
│  TOTALE:            €7.20                                  │
│                                                            │
│  Prezzo Vendita (Listino Personale):                      │
│  ─────────────────────────────────                        │
│  Costo Base:        €7.20                                  │
│  Margine (+50%):    €3.60                                  │
│  ─────────────────────────────────                        │
│  TOTALE:            €10.80                                 │
│                                                            │
│  📋 Configurazione:                                        │
│  • Contract: postedelivery-SDA---Express---H24+           │
│  • Provider: Spedisci.Online                               │
│  • Listino: Listino Reseller 2024                          │
│  • Aggiornato: 2 secondi fa                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## ✅ Requisiti Output

1. **Raggruppamento**: Corrieri con stesso nome ma contract code diversi → mostrati come card separate
2. **Real-Time**: Costo fornitore da API sincrona al click
3. **Listino Personale**: Prezzo vendita da listino reseller
4. **Visualizzazione**: Entrambi i prezzi visibili affianco al bottone
5. **Dettaglio**: Modulo affianco con breakdown completo
6. **Stati**: Loading, Ready, Error per ogni corriere
7. **Contract Code**: Visibile per identificare quale contratto viene usato
8. **Servizi Accessori**: Visualizzazione e calcolo dinamico di contrassegno, assicurazione, exchange

---

## 🔧 Servizi Accessori - Visualizzazione e Calcolo

### Tabella Output con Servizi Accessori

| **Corriere**             | **Base**        | **+ Contrassegno** | **+ Assicurazione** | **+ Exchange**     | **Totale** |
| ------------------------ | --------------- | ------------------ | ------------------- | ------------------ | ---------- |
| **GLS**                  | €8.50 → €12.75  | +€3.00 → +€4.50    | +€2.00 → +€3.00     | +€5.00 → +€7.50    | €23.75     |
| **Poste It. (Express)**  | €7.20 → €10.80  | +€2.50 → +€3.75    | +€1.50 → +€2.25     | ❌ Non disponibile | €16.80     |
| **Poste It. (Standard)** | €5.80 → €8.70   | +€2.00 → +€3.00    | +€1.00 → +€1.50     | ❌ Non disponibile | €13.20     |
| **UPS**                  | €15.00 → €22.50 | +€4.00 → +€6.00    | +€3.00 → +€4.50     | ❌ Non disponibile | €33.00     |
| **Interno**              | €3.50 → €5.25   | +€1.00 → +€1.50    | ❌ Non disponibile  | ❌ Non disponibile | €6.75      |

---

## 🎨 Layout UI con Servizi Accessori

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TICKET DI SPEDIZIONE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 CORRIERE DISPONIBILI                                                │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │   GLS                                        [SELECTED]      │ │ │
│  │  │   Contract: gls-express-2024                                  │ │ │
│  │  │                                                              │ │ │
│  │  │   Base:        €8.50  →  €12.75                             │ │ │
│  │  │   + COD:       €3.00  →  €4.50   [✓] Attivo                │ │ │
│  │  │   + Insurance: €2.00  →  €3.00   [✓] Attivo                │ │ │
│  │  │   + Exchange:  €5.00  →  €7.50   [ ] Disponibile            │ │ │
│  │  │   ─────────────────────────────────────────────             │ │ │
│  │  │   TOTALE:      €18.50  →  €27.75                            │ │ │
│  │  │                                                              │ │ │
│  │  │   🔧 Servizi Disponibili:                                   │ │ │
│  │  │   ☑ Contrassegno (€3.00)                                    │ │ │
│  │  │   ☑ Assicurazione (€2.00)                                   │ │ │
│  │  │   ☐ Exchange (€5.00) - Solo GLS                            │ │ │
│  │  │   ☐ Ritiro a domicilio (€8.00)                             │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │   Poste Italiane (Express)              [Available]         │ │ │
│  │  │   Contract: postedelivery-SDA-Express                       │ │ │
│  │  │                                                              │ │ │
│  │  │   Base:        €7.20  →  €10.80                            │ │ │
│  │  │   + COD:       €2.50  →  €3.75   [ ] Disponibile           │ │ │
│  │  │   + Insurance: €1.50  →  €2.25   [ ] Disponibile           │ │ │
│  │  │   + Exchange:  ❌ Non disponibile                           │ │ │
│  │  │   ─────────────────────────────────────────────             │ │ │
│  │  │   TOTALE:      €7.20  →  €10.80                             │ │ │
│  │  │                                                              │ │ │
│  │  │   🔧 Servizi Disponibili:                                   │ │ │
│  │  │   ☐ Contrassegno (€2.50)                                    │ │ │
│  │  │   ☐ Assicurazione (€1.50)                                   │ │ │
│  │  │   ❌ Exchange - Non disponibile per Poste                   │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  📊 DETTAGLIO PREZZO (GLS selezionato)                            │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  Costo Fornitore (API Real-Time):                                │ │
│  │  ─────────────────────────────────                                │ │
│  │  Base:              €8.50                                         │ │
│  │  Peso (2kg):        €0.00 (incluso)                               │ │
│  │  Contrassegno:      €3.00  [✓]                                    │ │
│  │  Assicurazione:     €2.00  [✓] (valore €500)                     │ │
│  │  Exchange:          €0.00  [ ] (non attivo)                      │ │
│  │  ─────────────────────────────────                                │ │
│  │  TOTALE FORNITORE:  €13.50                                        │ │
│  │                                                                   │ │
│  │  Prezzo Vendita (Listino Personale):                             │ │
│  │  ─────────────────────────────────                                │ │
│  │  Costo Base:        €13.50                                        │ │
│  │  Margine (+50%):     €6.75                                         │ │
│  │  ─────────────────────────────────                                │ │
│  │  TOTALE VENDITA:    €20.25                                        │ │
│  │                                                                   │ │
│  │  📋 Breakdown Servizi:                                           │ │
│  │  • Base:              €8.50 → €12.75                              │ │
│  │  • Contrassegno:      €3.00 → €4.50  (margine +50%)              │ │
│  │  • Assicurazione:     €2.00 → €3.00  (margine +50%)              │ │
│  │  • Exchange:          €0.00 → €0.00  (non attivo)                 │ │
│  │                                                                   │ │
│  │  📦 Configurazione:                                              │ │
│  │  • Contract: gls-express-2024                                     │ │
│  │  • Provider: Spedisci.Online                                      │ │
│  │  • Listino: Listino Reseller 2024                                 │ │
│  │  • Servizi attivi: Contrassegno, Assicurazione                   │ │
│  │  • Aggiornato: 2 secondi fa                                       │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flusso Interazione con Servizi Accessori

```
1. UTENTE CLICCA SU BOTTONE CORRIERE
   ↓
2. SISTEMA MOSTRA PREZZO BASE + SERVIZI DISPONIBILI
   [Bottone mostra: "€8.50 → €12.75"]
   [Lista servizi disponibili con prezzi]
   ↓
3. UTENTE ATTIVA SERVIZIO (es. Contrassegno)
   [Click su checkbox "Contrassegno (€3.00)"]
   ↓
4. SISTEMA RICALCOLA IN REAL-TIME
   POST /api/quotes/realtime
   {
     courierName: "GLS",
     contractCode: "gls-express-2024",
     weight: 2,
     destination: { zip: "80040", province: "NA" },
     options: {
       cashOnDelivery: true,      // ← NUOVO
       insurance: false,
       exchange: false
     }
   }
   ↓
5. API RESTITUISCE PREZZO AGGIORNATO
   {
     basePrice: 8.50,
     surcharges: 3.00,  // ← Contrassegno
     totalCost: 11.50
   }
   ↓
6. SISTEMA CALCOLA PREZZO VENDITA AGGIORNATO
   Usa calculatePriceWithRules() con servizi attivi
   ↓
7. AGGIORNA UI IN REAL-TIME
   [Bottone mostra: "€11.50 → €17.25"]
   [Checkbox contrassegno: ✓ Attivo]
   [Modulo affianco aggiornato con breakdown]
```

---

## 📋 Struttura Dati Aggiornata con Servizi

```typescript
interface CourierQuote {
  // ... campi esistenti ...

  // Servizi Accessori Disponibili
  availableServices: {
    cashOnDelivery: {
      available: boolean;
      providerCost: number; // €3.00
      sellingPrice: number; // €4.50 (con margine)
      description: string; // "Contrassegno"
    };
    insurance: {
      available: boolean;
      providerCost: number; // €2.00 (per €500 valore)
      sellingPrice: number; // €3.00
      description: string; // "Assicurazione"
      minValue?: number; // Valore minimo assicurabile
      maxValue?: number; // Valore massimo assicurabile
    };
    exchange: {
      available: boolean; // Solo per GLS
      providerCost: number; // €5.00
      sellingPrice: number; // €7.50
      description: string; // "Exchange (solo GLS)"
      courierSpecific: string[]; // ["GLS"]
    };
    homePickup: {
      available: boolean;
      providerCost: number; // €8.00
      sellingPrice: number; // €12.00
      description: string; // "Ritiro a domicilio"
    };
  };

  // Servizi Attivi (selezionati dall'utente)
  activeServices: {
    cashOnDelivery?: {
      enabled: boolean;
      amount?: number; // Importo contrassegno (se specificato)
    };
    insurance?: {
      enabled: boolean;
      declaredValue?: number; // Valore dichiarato
    };
    exchange?: {
      enabled: boolean;
    };
    homePickup?: {
      enabled: boolean;
    };
  };

  // Prezzi Aggiornati (con servizi)
  providerCost: number; // €13.50 (base + servizi)
  sellingPrice: number; // €20.25 (con margine)

  // Breakdown Aggiornato
  breakdown: {
    base: number; // €8.50
    weight: number; // €0.00
    services: {
      cashOnDelivery: number; // €3.00
      insurance: number; // €2.00
      exchange: number; // €0.00 (non attivo)
    };
    surcharges: number; // €5.00 (totale servizi)
    margin: number; // €6.75
  };
}
```

---

## 🎯 Esempio Output Completo con Servizi

### Scenario: GLS con Contrassegno + Assicurazione

```
┌────────────────────────────────────────────────────────────┐
│ 📦 GLS - Contract: gls-express-2024                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Prezzo Base:                                              │
│  ─────────────────────────────────                        │
│  Fornitore:     €8.50                                      │
│  Vendita:       €12.75                                     │
│                                                            │
│  Servizi Accessori:                                        │
│  ─────────────────────────────────                        │
│  ☑ Contrassegno                                            │
│     Fornitore:  €3.00                                      │
│     Vendita:    €4.50                                      │
│     Importo:    €100.00  [modificabile]                    │
│                                                            │
│  ☑ Assicurazione                                           │
│     Fornitore:  €2.00                                      │
│     Vendita:    €3.00                                      │
│     Valore:     €500.00  [modificabile]                    │
│                                                            │
│  ☐ Exchange (solo GLS)                                      │
│     Fornitore:  €5.00                                      │
│     Vendita:    €7.50                                      │
│     [ ] Attiva                                             │
│                                                            │
│  ☐ Ritiro a domicilio                                      │
│     Fornitore:  €8.00                                      │
│     Vendita:    €12.00                                     │
│     [ ] Attiva                                             │
│                                                            │
│  ─────────────────────────────────                        │
│  TOTALE FORNITORE:  €13.50                                 │
│  TOTALE VENDITA:    €20.25                                 │
│  Margine:           +50%                                    │
│                                                            │
│  📋 Breakdown Dettagliato:                                 │
│  • Base:              €8.50 → €12.75                        │
│  • Contrassegno:      €3.00 → €4.50                        │
│  • Assicurazione:     €2.00 → €3.00                        │
│  • Margine totale:    €6.75                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## ✅ Requisiti Servizi Accessori

1. **Disponibilità per Corriere**: Ogni corriere mostra solo servizi disponibili
2. **Prezzi Real-Time**: Costo fornitore e vendita aggiornati al toggle servizio
3. **Visualizzazione Chiara**: Checkbox con prezzi visibili, ❌ per non disponibili
4. **Breakdown Dettagliato**: Ogni servizio mostrato separatamente nel modulo affianco
5. **Validazione**: Controllo importi min/max per contrassegno e assicurazione
6. **Aggiornamento Dinamico**: Prezzi ricalcolati immediatamente al cambio servizio
7. **Margine Applicato**: Margine applicato anche ai servizi accessori
