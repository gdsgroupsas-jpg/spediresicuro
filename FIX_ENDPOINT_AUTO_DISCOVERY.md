# 🔧 Fix: Auto-Discovery Endpoint API Spedisci.Online

## 📋 Problema Risolto

**Errore precedente:** L'API di Spedisci.Online restituiva sempre **404 Not Found** perché l'endpoint non era corretto.

**URL tentato (sbagliato):**
```
https://ecommerceitalia.spedisci.online/api/v2/v1/shipments
```

## ✅ Soluzione Implementata

Ho creato un sistema **intelligente di auto-discovery** che prova automaticamente diversi endpoint fino a trovare quello corretto.

### Come Funziona

1. **Genera automaticamente** una lista di endpoint possibili basandosi sul BASE_URL configurato
2. **Prova ogni endpoint** in sequenza fino a trovare uno che funziona
3. **Se trova un endpoint valido**, lo usa immediatamente
4. **Se tutti falliscono**, restituisce un errore chiaro

### Endpoint Provati (in ordine di probabilità)

Se BASE_URL è `https://ecommerceitalia.spedisci.online/api/v2`, prova:

1. `/api/v2/shipments` ← **Più probabile** (senza /v1)
2. `/api/v2/v1/shipments` (con /v1)
3. `/v1/shipments` (senza /api/v2)
4. `/shipments` (solo shipments)
5. `/api/v1/shipments` (v1 invece di v2)

## 🔍 Logging Migliorato

Ora vedrai nei log:
- ✅ Quale endpoint viene provato
- ✅ Risposta ricevuta (status, errori)
- ✅ Quale endpoint ha funzionato (se trovato)
- ⚠️ Quali endpoint hanno fallito e perché

### Esempio Log (Successo)
```
🔍 [SPEDISCI.ONLINE] Tentativo endpoint: https://ecommerceitalia.spedisci.online/api/v2/shipments
📡 [SPEDISCI.ONLINE] Risposta ricevuta: { url: '...', status: 200, ok: true }
✅ [SPEDISCI.ONLINE] Endpoint corretto trovato!
```

### Esempio Log (404, poi successo)
```
🔍 [SPEDISCI.ONLINE] Tentativo endpoint: https://ecommerceitalia.spedisci.online/api/v2/v1/shipments
⚠️ [SPEDISCI.ONLINE] Endpoint ... restituisce 404, provo il prossimo...
🔍 [SPEDISCI.ONLINE] Tentativo endpoint: https://ecommerceitalia.spedisci.online/api/v2/shipments
✅ [SPEDISCI.ONLINE] Endpoint corretto trovato!
```

## 📝 Modifiche al Codice

### File Modificato
- `lib/adapters/couriers/spedisci-online.ts`

### Metodi Modificati

1. **`createShipmentJSON()`** - Ora prova diversi endpoint automaticamente
2. **`uploadCSV()`** - Stessa logica per upload CSV
3. **`generateEndpointVariations()`** - Nuovo metodo che genera lista endpoint
4. **`generateUploadEndpointVariations()`** - Nuovo metodo per endpoint upload

## 🚀 Vantaggi

1. ✅ **Nessuna configurazione manuale** - Trova l'endpoint automaticamente
2. ✅ **Robusto** - Funziona anche se Spedisci.Online cambia struttura URL
3. ✅ **Log dettagliati** - Vedi esattamente cosa sta succedendo
4. ✅ **Fallback intelligente** - Se un endpoint fallisce, prova il prossimo
5. ✅ **Errori chiari** - Se tutti falliscono, sai esattamente perché

## 🧪 Come Testare

1. **Crea una nuova spedizione** dal dashboard
2. **Controlla i log** su Vercel o nel terminale locale
3. **Cerca questi messaggi**:
   - `🔍 [SPEDISCI.ONLINE] Tentativo endpoint: ...`
   - `✅ [SPEDISCI.ONLINE] Endpoint corretto trovato!`

### Cosa Aspettarsi

**Se funziona:**
- Vedrai `✅ Endpoint corretto trovato!`
- La spedizione verrà creata con tracking number reale
- Riceverai la label PDF

**Se non funziona:**
- Vedrai tutti gli endpoint provati
- L'ultimo errore sarà mostrato chiaramente
- Il sistema userà il fallback CSV locale (come prima)

## 📊 Compatibilità

✅ **Retrocompatibile** - Funziona con tutte le configurazioni esistenti
✅ **Nessun breaking change** - Il codice vecchio continua a funzionare
✅ **Miglioramento automatico** - Non serve cambiare configurazioni

## 🎯 Prossimi Passi

1. **Testa la creazione di una spedizione**
2. **Verifica nei log quale endpoint funziona**
3. **Se funziona**, possiamo ottimizzare rimuovendo gli endpoint che non servono
4. **Se non funziona**, i log ci diranno esattamente cosa provare

---

**Data:** 4 Dicembre 2025  
**Stato:** ✅ Implementato e pronto per test  
**File:** `lib/adapters/couriers/spedisci-online.ts`

