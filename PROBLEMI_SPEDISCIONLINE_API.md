# Problemi Integrazione Spedisci.Online API

## 📋 Contesto
Stiamo integrando l'API di Spedisci.Online per la creazione automatica di LDV (Lettere di Vettura) tramite chiamate API JSON.

**Base URL configurato:** `https://ecommerceitalia.spedisci.online/api/v2`

## ❌ Problemi Attualmente Riscontrati

### 1. Errore 404 Not Found sull'endpoint API

**Sintomo:**
- La chiamata API restituisce sempre HTTP 404 Not Found
- L'API JSON fallisce e il sistema ricade su CSV upload (che fallisce anche)
- Alla fine viene generato un CSV locale come fallback

**Dettagli:**
```
📡 [SPEDISCI.ONLINE] Risposta ricevuta: { status: 404, statusText: 'Not Found', ok: false }
❌ [SPEDISCI.ONLINE] Errore risposta API: { message: '' }
```

**URL tentati:**
- ❌ `https://ecommerceitalia.spedisci.online/api/v2/shipments` → 404
- ❌ `https://ecommerceitalia.spedisci.online/api/v2/v1/shipments` → 404 (prossimo da testare)
- ❌ Upload CSV: `https://ecommerceitalia.spedisci.online/api/v2/v1/shipments/upload` → 404

**Log completo chiamata API:**
```
2025-12-03 14:31:42.292 [info] 🚀 [SPEDISCI.ONLINE] BASE_URL: https://ecommerceitalia.spedisci.online/api/v2
2025-12-03 14:31:42.292 [info] 🔍 [SPEDISCI.ONLINE] Codice contratto trovato: postedeliverybusiness-Solution-and-Shipment
2025-12-03 14:31:42.292 [info] 📡 [SPEDISCI.ONLINE] Chiamata fetch a: https://ecommerceitalia.spedisci.online/api/v2/shipments
2025-12-03 14:31:42.677 [info] 📡 [SPEDISCI.ONLINE] Risposta ricevuta: { status: 404, statusText: 'Not Found', ok: false }
```

**Payload inviato:**
```json
{
  "destinatario": "LUIGI VERDI",
  "indirizzo": "VIA MILANO 50",
  "cap": "20155",
  "localita": "MILANO",
  "provincia": "MI",
  "country": "IT",
  "peso": 1,
  "colli": 1,
  "contrassegno": "",
  "rif_mittente": "",
  "rif_destinatario": "LUIGI VERDI",
  "note": "PROVA",
  "telefono": "3276621781",
  "email_destinatario": "SIGORN@HOTMAIL.IT",
  "contenuto": "",
  "order_id": "",
  "totale_ordine": "",
  "codice_contratto": "postedeliverybusiness-Solution-and-Shipment"
}
```

**Headers inviati:**
```
Content-Type: application/json
Authorization: Bearer [API_KEY]
Accept: application/json
```

### 2. Codice Contratto - Mapping Configurato

**Situazione attuale:**
- ✅ Il sistema trova il codice contratto usando fallback (1 contratto unico disponibile)
- ⚠️ Codice contratto: `postedeliverybusiness-Solution-and-Shipment`
- ⚠️ Non corrisponde direttamente al corriere "SDA" ma viene usato come fallback

**Log:**
```
⚠️ Nessun match specifico trovato per sda, uso contratto unico disponibile: postedeliverybusiness-Solution-and-Shipment
🔍 [SPEDISCI.ONLINE] Codice contratto trovato: postedeliverybusiness-Solution-and-Shipment
```

### 3. Warning SQL - Colonna Ambigua (Non Bloccante)

**Sintomo:**
```
⚠️ Errore recupero config tramite RPC, provo query diretta: {
  code: '42702',
  message: 'column reference "id" is ambiguous'
}
```

**Stato:** ⚠️ Non bloccante - Il sistema usa query diretta come fallback e funziona

### 4. Warning User ID Mancante (Non Bloccante)

**Sintomo:**
```
⚠️ [SUPABASE] Nessun user_id trovato per email: admin@spediresicuro.it
```

**Stato:** ⚠️ Non bloccante - La spedizione viene salvata senza user_id (usa created_by_user_email)

## ✅ Problemi Già Risolti

### 1. URL con Doppio Slash
- ❌ Prima: `https://ecommerceitalia.spedisci.online/api/v2//v1/shipments`
- ✅ Risolto: Normalizzazione BASE_URL rimuovendo slash finale

### 2. Ricerca Codice Contratto
- ✅ Implementate 5 strategie di ricerca
- ✅ Fallback se c'è un solo contratto disponibile

## 🔧 Configurazione Attuale

### Base URL
```
BASE_URL: https://ecommerceitalia.spedisci.online/api/v2
```

### API Key
- ✅ Presente e configurata
- ✅ Autorization Bearer token incluso nelle chiamate

### Contract Mapping
```json
{
  "postedeliverybusiness-Solution-and-Shipment": "..."
}
```

### Codice Adapter
**File:** `lib/adapters/couriers/spedisci-online.ts`

**Metodo chiamata:**
```typescript
private async createShipmentJSON(payload: SpedisciOnlineShipmentPayload): Promise<SpedisciOnlineResponse> {
  let endpoint = '/v1/shipments';
  if (this.BASE_URL.includes('/api/v2')) {
    endpoint = '/v1/shipments'; // Mantiene /v1 quando BASE_URL contiene /api/v2
  }
  const url = `${this.BASE_URL}${endpoint}`;
  // Risultato: https://ecommerceitalia.spedisci.online/api/v2/v1/shipments
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.API_KEY}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
```

## 🤔 Domande da Risolvere

1. **Qual è l'endpoint corretto per Spedisci.Online?**
   - `/api/v2/shipments`?
   - `/api/v2/v1/shipments`?
   - `/v1/shipments`?
   - Altro?

2. **Il BASE_URL è corretto?**
   - Dovrebbe essere `https://ecommerceitalia.spedisci.online/api/v2`?
   - O solo `https://ecommerceitalia.spedisci.online`?

3. **Il formato del payload è corretto?**
   - I campi sono nel formato giusto?
   - Il codice contratto è nel formato corretto?

4. **Serve autenticazione diversa?**
   - L'API key è sufficiente?
   - Servono altri header o parametri?

5. **Il codice contratto è corretto?**
   - `postedeliverybusiness-Solution-and-Shipment` è valido?
   - Serve un formato diverso?

## 📚 Documentazione Richiesta

Avremmo bisogno di:
- ✅ Documentazione API ufficiale Spedisci.Online
- ✅ Esempi di chiamate API funzionanti
- ✅ Struttura corretta degli endpoint
- ✅ Formato payload richiesto
- ✅ Codici di errore e significato

## 🎯 Obiettivo

Creare LDV automaticamente tramite API JSON per:
- Corriere: SDA
- Formato: JSON sincrono (non CSV)
- Risultato atteso: Tracking number e label PDF

## 🔄 Fallback Attuale

Il sistema attualmente:
1. ❌ Tenta API JSON → 404
2. ❌ Tenta Upload CSV → 404
3. ✅ Genera CSV locale come fallback
4. ✅ La spedizione viene salvata nel database

**Risultato:** La spedizione viene creata ma senza integrazione reale con Spedisci.Online

## 💡 Note

- La configurazione è salvata nel database Supabase (tabella `courier_configs`)
- Il sistema usa un orchestrator per gestire adapter diretti vs broker
- Le credenziali sono criptate nel database
- L'integrazione funziona correttamente dal punto di vista tecnico, ma l'API risponde 404

---

**Data:** 2025-12-03
**Versione:** Ultima correzione endpoint API
**Status:** 🔴 Errore 404 - Endpoint non trovato







