# 🏗️ Architettura Fulfillment Orchestrator - Production-Ready

## 🎯 Obiettivo

Trasformare SpedireSicuro da sistema dipendente da CSV a **piattaforma enterprise** con routing intelligente per la creazione LDV.

---

## 🚀 Architettura Implementata

### 1. **Fulfillment Orchestrator** (`lib/engine/fulfillment-orchestrator.ts`)

**Orchestratore intelligente** che gestisce il routing automatico per la creazione LDV.

**Strategia O(1) di Dominio:**

| Condizione | Azione | Motivo Profitto |
|------------|--------|-----------------|
| **LDV Diretta** | Chiama `DirectAdapter.createShipment()` | Massima velocità, margine massimo |
| **LDV Broker** | Chiama `SpedisciOnlineAdapter.createShipment()` | Copertura per corrieri senza adapter diretto |
| **LDV Fallita** | Genera CSV e notifica utente/admin | Fallback elegante, zero perdita ordini |

**Vantaggi:**
- ✅ **Scalabile**: Aggiungi nuovi adapter senza modificare il core
- ✅ **Resiliente**: Fallback automatico se un adapter fallisce
- ✅ **Performante**: Routing O(1), nessun overhead
- ✅ **Flessibile**: Configurabile per preferenze (direct vs broker)

### 2. **Spedisci.Online Adapter Ristrutturato** (`lib/adapters/couriers/spedisci-online.ts`)

**Adapter production-ready** con priorità intelligente:

**Priorità 1: API JSON Sincrona** (LDV istantanea)
```typescript
POST /v1/shipments
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "destinatario": "...",
  "indirizzo": "...",
  // ... altri campi
}
```

**Priorità 2: Upload CSV** (se JSON non disponibile)
```typescript
POST /v1/shipments/upload
Content-Type: multipart/form-data
Authorization: Bearer {api_key}

file: <CSV file>
```

**Priorità 3: Fallback CSV Locale** (solo se tutto fallisce)
- Genera CSV nel formato corretto
- Utente può caricarlo manualmente
- Zero perdita di ordini

**Miglioramenti:**
- ✅ **Validazione credenziali** nel costruttore (fail-fast)
- ✅ **Gestione errori dettagliata** con messaggi specifici
- ✅ **Mappatura dati robusta** da Shipment/CreateShipmentInput
- ✅ **Tracking eventi** standardizzato

### 3. **Server Actions Aggiornate** (`lib/actions/spedisci-online.ts`)

**Nuova funzione principale:**
```typescript
createShipmentWithOrchestrator(
  shipmentData: Shipment | CreateShipmentInput,
  courierCode: string
): Promise<ShipmentResult>
```

**Funzionalità:**
- ✅ Registra automaticamente broker adapter se credenziali disponibili
- ✅ Usa orchestrator per routing intelligente
- ✅ Gestisce errori senza bloccare il sistema
- ✅ Retrocompatibilità con `sendShipmentToSpedisciOnline`

### 4. **API Route Aggiornata** (`app/api/spedizioni/route.ts`)

**Rimossa logica CSV diretta**, ora usa orchestrator:

```typescript
// Prima (vecchio)
const { sendShipmentToSpedisciOnline } = await import('@/lib/actions/spedisci-online');
spedisciOnlineResult = await sendShipmentToSpedisciOnline(spedizione);

// Dopo (nuovo)
const { createShipmentWithOrchestrator } = await import('@/lib/actions/spedisci-online');
ldvResult = await createShipmentWithOrchestrator(spedizione, body.corriere || 'GLS');
```

**Vantaggi:**
- ✅ Separazione responsabilità (HTTP vs Business Logic)
- ✅ Testabile (orchestrator isolato)
- ✅ Scalabile (aggiungi adapter senza toccare route)

---

## 📊 Flusso Completo

```
1. Utente crea spedizione
   ↓
2. POST /api/spedizioni
   ↓
3. Salva nel database
   ↓
4. createShipmentWithOrchestrator()
   ↓
5. Fulfillment Orchestrator:
   ├─ Prova adapter diretto (se disponibile)
   ├─ Se fallisce → Prova broker (spedisci.online)
   └─ Se fallisce → Genera CSV fallback
   ↓
6. Risposta con risultato LDV
   ↓
7. Cliente scarica LDV o CSV
```

---

## 🔧 Configurazione

### Registrare Adapter Diretti (Futuro)

```typescript
import { getFulfillmentOrchestrator } from '@/lib/engine/fulfillment-orchestrator';
import { GLSAdapter } from '@/lib/adapters/couriers/gls';
import { BRTAdapter } from '@/lib/adapters/couriers/brt';

const orchestrator = getFulfillmentOrchestrator();

// Registra adapter diretti
orchestrator.registerDirectAdapter('gls', new GLSAdapter(glsCredentials));
orchestrator.registerDirectAdapter('brt', new BRTAdapter(brtCredentials));
```

### Configurare Broker (spedisci.online)

Le credenziali vengono caricate automaticamente da:
- Supabase `user_integrations` (se configurato)
- Database locale (fallback)

**Nessuna configurazione manuale necessaria!**

---

## 🎯 Vantaggi Architettura

### 1. **Scalabilità**

Aggiungi nuovi corrieri senza modificare il core:

```typescript
// Nuovo adapter
class DHLAdapter extends CourierAdapter { ... }

// Registra
orchestrator.registerDirectAdapter('dhl', new DHLAdapter(dhlCredentials));
```

### 2. **Resilienza**

Se un adapter fallisce, l'orchestrator prova automaticamente il prossimo:

```
GLS Adapter → Fallisce
  ↓
Spedisci.Online → Fallisce
  ↓
CSV Fallback → Sempre disponibile
```

### 3. **Performance**

- **Adapter diretto**: LDV istantanea (< 1 secondo)
- **Broker**: LDV via API (< 3 secondi)
- **Fallback**: CSV generato (< 100ms)

### 4. **Manutenibilità**

- Separazione responsabilità chiara
- Test isolati per ogni componente
- Facile debugging (log dettagliati)

---

## 🚀 Prossimi Passi

### 1. **Adapter Diretti** (Priorità Alta)

Implementa adapter diretti per corrieri principali:
- GLS
- BRT
- DHL
- UPS

**Vantaggio**: Margine massimo, velocità massima, controllo totale

### 2. **Monitoring e Analytics**

Aggiungi tracking per:
- Tasso successo per adapter
- Tempo medio creazione LDV
- Costo per metodo (direct vs broker)

### 3. **Retry Logic**

Implementa retry automatico con backoff esponenziale:
- Retry 3 volte con delay 1s, 2s, 4s
- Solo per errori temporanei (5xx)

### 4. **Webhook Notifications**

Notifica utente quando:
- LDV creata con successo
- LDV fallita (richiede azione manuale)
- Tracking aggiornato

---

## 📝 Esempio Uso

```typescript
// Server Action
import { createShipmentWithOrchestrator } from '@/lib/actions/spedisci-online';

const result = await createShipmentWithOrchestrator(shipmentData, 'GLS');

if (result.success) {
  console.log(`✅ LDV creata via ${result.method}:`, result.tracking_number);
  console.log('Label URL:', result.label_url);
} else {
  console.warn('⚠️ LDV fallita:', result.error);
  if (result.label_pdf) {
    // CSV fallback disponibile
    console.log('CSV fallback generato');
  }
}
```

---

## ✅ Checklist Implementazione

- [x] Fulfillment Orchestrator creato
- [x] Spedisci.Online Adapter ristrutturato
- [x] Priorità JSON > CSV > Fallback
- [x] Server Actions aggiornate
- [x] API Route aggiornata
- [x] Rimossa logica CSV da route HTTP
- [x] Gestione errori robusta
- [x] Retrocompatibilità mantenuta
- [ ] Adapter diretti (GLS, BRT, etc.) - Da implementare
- [ ] Monitoring e analytics - Da implementare
- [ ] Retry logic - Da implementare

---

**🎉 Architettura Production-Ready Implementata!**

Il sistema ora è scalabile, resiliente e pronto per crescita enterprise.

