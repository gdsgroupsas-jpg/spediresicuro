# Address Validation & Autocomplete - SpedireSicuro

## Overview

Sistema top-tier di validazione e autocomplete indirizzi ispirato a ShippyPro. Combina Google Places Autocomplete, dataset Poste Italiane, normalizzazione postale e classificazione residenziale/business per ridurre errori di spedizione e costi operativi.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Comprensione del flusso di creazione spedizione
- Familiarità con Google Places API (opzionale)
- Conoscenza del formato indirizzi italiani

## Quick Reference

| Sezione         | Pagina                                 | Link                                                     |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| Autocomplete    | docs/11-FEATURES/ADDRESS_VALIDATION.md | [Autocomplete](#google-places-autocomplete)              |
| Validazione CAP | docs/11-FEATURES/ADDRESS_VALIDATION.md | [Validazione CAP](#validazione-cap-citta-provincia)      |
| Normalizzazione | docs/11-FEATURES/ADDRESS_VALIDATION.md | [Normalizzazione](#normalizzazione-postale)              |
| Classificazione | docs/11-FEATURES/ADDRESS_VALIDATION.md | [Classificazione](#classificazione-residenzialebusiness) |
| Architettura    | docs/11-FEATURES/ADDRESS_VALIDATION.md | [Architettura](#architettura)                            |

## Content

### Architettura

```
[Form Spedizione / Preventivo]
  |
  v
[Google Places Autocomplete] ──> search-as-you-type (via + civico)
  |
  v
[Auto-fill] ──> città, CAP, provincia dal place selezionato
  |
  v
[Validazione CAP/Città] ──> dataset Poste Italiane (server-side, costo zero)
  |
  v
[Normalizzazione Postale] ──> abbreviazioni standard (Via→V., Piazza→P.zza)
  |
  v
[Classificazione] ──> residenziale / business / unknown
  |
  v
[Address Worker LangGraph] ──> integrato nel flusso conversazionale AI
  |
  v
[Label Creation]
```

### Google Places Autocomplete

**Cosa fa:** Search-as-you-type per indirizzi italiani completi (via + numero civico).

**Come funziona:**

1. Utente digita nel campo indirizzo (minimo 3 caratteri)
2. Debounce 300ms, poi chiamata a `/api/address/autocomplete`
3. API route interroga Google Places con session token
4. Risultati mostrati in dropdown
5. Al click, `/api/address/details` recupera dati strutturati
6. Auto-fill di città, CAP e provincia

**Session Token:** UUID generato al mount del componente. Raggruppa autocomplete + details in una sessione Google per billing optimization (1 sessione = 1 costo, non per keystroke).

**Caching:** Redis (Upstash) con TTL 24h per autocomplete e 7 giorni per details. Riduce chiamate API.

**Costi:**
| Volume mensile | Costo stimato |
|---------------|--------------|
| 0 - 10.000 | Gratis (free tier Google) |
| 10.000 - 20.000 | ~$150/mese |
| 50.000 | ~$680/mese |

**Graceful degradation:** Se Google Places non disponibile (no API key, errore rete), il campo funziona come input testo normale. L'utente scrive l'indirizzo manualmente.

### Validazione CAP/Città/Provincia

**Cosa fa:** Cross-check CAP, città e provincia usando il dataset Poste Italiane/ISTAT.

**Come funziona:**

- Dataset compilato in TypeScript Map (~200KB, tutti i capoluoghi italiani)
- Validazione CAP → provincia tramite prefisso
- Validazione CAP → città per capoluoghi noti
- Suggerimenti di correzione se mismatch

**API:** `POST /api/address/validate-cap`

```json
// Request
{ "cap": "20100", "city": "Milano", "province": "RM" }

// Response
{
  "success": true,
  "valid": false,
  "message": "Provincia per Milano dovrebbe essere MI",
  "suggestion": { "correctProvince": "MI" }
}
```

**Integrazione Address Worker:**
Dopo l'estrazione dell'indirizzo dal testo libero, l'Address Worker:

1. Chiama `validateAddress()` per cross-check
2. Auto-corregge con i suggerimenti se il mismatch e' chiaro
3. Chiede chiarimento all'utente se ambiguo

### Normalizzazione Postale

**Cosa fa:** Converte nomi vie in formato abbreviato standard Poste Italiane.

**Abbreviazioni:**
| Forma estesa | Abbreviazione |
|-------------|--------------|
| Via | V. |
| Piazza | P.zza |
| Piazzale | P.le |
| Corso | C.so |
| Viale | V.le |
| Largo | L.go |
| Vicolo | Vic. |
| Strada | Str. |
| Contrada | C.da |
| Localita' | Loc. |
| Frazione | Fraz. |
| Borgo | B.go |

**Estrazione numero civico:**
Separa via e numero civico per gestione corretta nei form corriere.

- "Via Roma 20" → `{ street: "Via Roma", number: "20" }`
- "Via Roma 20/A" → `{ street: "Via Roma", number: "20/A" }`
- "Via Roma 20 bis" → `{ street: "Via Roma", number: "20BIS" }`

### Classificazione Residenziale/Business

**Cosa fa:** Classifica l'indirizzo per ottimizzazione tariffe corriere.

**Euristica:**

- **Business (alta confidence):** P.IVA valida, forma societaria (SRL, SPA, SNC), keyword (Zona Industriale, c/o, magazzino)
- **Residential (media confidence):** Nessun indicatore business rilevato
- **Unknown (bassa confidence):** Indicatori deboli/ambigui

**Output:** `{ type: 'business' | 'residential' | 'unknown', confidence: 0-1, reasons: string[] }`

**Utilizzo:** Salvato nel `RecipientSchema.addressType` del shipment draft. Disponibile per:

- Selezione automatica servizio corriere appropriato
- Prevenzione surcharge residenziale
- Analytics sulla tipologia di clientela

## File Coinvolti

### Core

- `lib/address/italian-postal-data.ts` - Dataset postale + validazione
- `lib/address/classify-address.ts` - Classificazione residenziale/business
- `lib/address/normalize-it-address.ts` - Normalizzazione + estrazione civico
- `lib/address/places-cache.ts` - Cache Redis per Google Places
- `lib/address/shipment-draft.ts` - Schema Zod (addressType, companyName, vatNumber)

### Adapters

- `lib/adapters/google-places/base.ts` - Interfaccia astratta
- `lib/adapters/google-places/google.ts` - Implementazione Google reale
- `lib/adapters/google-places/mock.ts` - Mock per testing
- `lib/adapters/google-places/index.ts` - Factory

### API Routes

- `app/api/address/autocomplete/route.ts` - GET autocomplete
- `app/api/address/details/route.ts` - GET place details + cross-validation
- `app/api/address/validate-cap/route.ts` - POST validazione CAP/citta/provincia

### Frontend

- `components/ui/street-autocomplete.tsx` - Search-as-you-type indirizzo
- `components/ui/address-fields.tsx` - Integrazione con campi citta/CAP/provincia

### AI Integration

- `lib/agent/workers/address.ts` - Address Worker con validazione postale e classificazione

## Environment Variables

```
GOOGLE_PLACES_API_KEY=xxx   # oppure riusa GOOGLE_MAPS_API_KEY
```

Se non configurata, il sistema usa il mock adapter (per dev/test).

## Related Docs

- [Shipments](SHIPMENTS.md)
- [AI Agent Overview](../10-AI-AGENT/OVERVIEW.md)
- [Architecture](../2-ARCHITECTURE/)
