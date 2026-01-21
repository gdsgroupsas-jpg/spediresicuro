# 🗑️ Sistema Spedizioni Cancellate (Soft Delete)

> **Status:** ✅ Implementato (31 Dicembre 2025)  
> **Versione:** 0.3.0  
> **Feature:** Soft Delete con Audit Trail e Cancellazione Simultanea

---

## 📋 Panoramica

Il sistema di **Spedizioni Cancellate** implementa un meccanismo di **soft delete** completo che permette di:

1. **Cancellare simultaneamente** su SpedireSicuro.it e Spedisci.Online
2. **Tracciare chi ha cancellato** ogni spedizione (audit trail)
3. **Visualizzare le spedizioni cancellate** con filtri RBAC (Role-Based Access Control)
4. **Permettere ai reseller** di vedere le spedizioni cancellate dei propri user

---

## 🎯 Obiettivi Business

### Requisiti Implementati

- ✅ **Cancellazione simultanea**: Quando un utente cancella una spedizione, viene eliminata sia nel database locale che su Spedisci.Online (se configurato)
- ✅ **Audit trail completo**: Ogni cancellazione registra:
  - `deleted_at`: Timestamp della cancellazione
  - `deleted_by_user_id`: ID utente che ha cancellato
  - `deleted_by_user_email`: Email dell'utente che ha cancellato
  - `deleted_by_user_name`: Nome descrittivo (Admin/Reseller/User)
- ✅ **Visibilità reseller**: I reseller possono vedere le spedizioni cancellate dei propri sub-user
- ✅ **Interfaccia dedicata**: Pagina `/dashboard/spedizioni/cancellate` per visualizzare tutte le cancellazioni

---

## 🏗️ Architettura

### Database Schema

**Tabella:** `shipments`

**Campi aggiunti (Migration `050_add_deleted_by_user_email.sql`):**

```sql
deleted BOOLEAN DEFAULT FALSE,
deleted_at TIMESTAMPTZ,
deleted_by_user_id UUID REFERENCES users(id),
deleted_by_user_email TEXT,
deleted_by_user_name TEXT
```

**Indici per performance:**

```sql
CREATE INDEX idx_shipments_deleted ON shipments(deleted) WHERE deleted = true;
CREATE INDEX idx_shipments_deleted_at ON shipments(deleted_at) WHERE deleted = true;
CREATE INDEX idx_shipments_deleted_by_user_id ON shipments(deleted_by_user_id) WHERE deleted = true;
```

### API Endpoints

#### `DELETE /api/spedizioni?id={shipmentId}`

**Funzionalità:**

- Soft delete nel database locale
- Cancellazione simultanea su Spedisci.Online (se configurato)
- Popolamento campi audit trail

**Priorità configurazione Spedisci.Online:**

1. Configurazione del reseller che cancella (se è reseller)
2. Configurazione del proprietario della spedizione
3. Configurazione globale (`is_default = true`)

**Metodi di cancellazione su Spedisci.Online:**

- **Preferito**: `shipment_id_external` (se disponibile)
- **Fallback**: `tracking_number`

**Esempio risposta:**

```json
{
  "success": true,
  "message": "Spedizione eliminata con successo",
  "data": {
    "id": "8a18ad06-01b2-40e2-8791-7aa18c7e269e",
    "tracking_number": "3UW1LZ1549783",
    "deleted_by_user_id": "904dc243-e9da-408d-8c0b-5dbe2a48b739",
    "deleted_by_user_email": "testspediresicuro+postaexpress@gmail.com",
    "deleted_by_user_name": "Reseller (testspediresicuro+postaexpress@gmail.com)"
  }
}
```

#### `GET /api/spedizioni/cancellate`

**Funzionalità:**

- Recupera tutte le spedizioni cancellate con filtri RBAC
- Paginazione supportata (`page`, `limit`)

**Filtri RBAC:**

- **Admin/SuperAdmin**: Vede tutte le spedizioni cancellate
- **Reseller**: Vede le proprie + quelle dei suoi sub-user (via `parent_id`)
- **User normale**: Vede solo le proprie spedizioni cancellate

**Query Parameters:**

- `page` (default: 1): Numero pagina
- `limit` (default: 50): Elementi per pagina

**Esempio risposta:**

```json
{
  "success": true,
  "data": [
    {
      "id": "8a18ad06-01b2-40e2-8791-7aa18c7e269e",
      "tracking_number": "3UW1LZ1549783",
      "recipient_name": "Mario Rossi",
      "carrier": "GLS",
      "total_cost": 8.5,
      "created_at": "2025-01-01T10:00:00Z",
      "deleted_at": "2025-01-01T12:00:00Z",
      "deleted_by_user_email": "test@example.com",
      "deleted_by_user_name": "Reseller (test@example.com)"
    }
  ],
  "count": 25,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

---

## 🎨 Frontend

### Pagina: `/dashboard/spedizioni/cancellate`

**Componente:** `app/dashboard/spedizioni/cancellate/page.tsx`

**Funzionalità:**

- Tabella con tutte le spedizioni cancellate
- Colonne visualizzate:
  - Tracking / LDV
  - Destinatario
  - Corriere
  - Costo
  - Data creazione
  - Data cancellazione
  - Cancellata da (email)
- Ricerca per:
  - Tracking number
  - Mittente
  - Destinatario
  - Email cancellatore
- Paginazione
- Filtri RBAC automatici (gestiti dal backend)

**Navigazione:**

- Link nella sidebar: "Spedizioni Cancellate" (icona Trash2)
- Breadcrumb: Dashboard > Spedizioni > Spedizioni Cancellate

---

## 🔐 Sicurezza e RBAC

### Row Level Security (RLS)

Le spedizioni cancellate rispettano le stesse policy RLS delle spedizioni attive:

```sql
-- Users vedono solo le proprie spedizioni cancellate
-- Reseller vedono le proprie + quelle dei sub-user
-- Admin vedono tutte
```

### Relazione Reseller-User

**Campo utilizzato:** `parent_id` (tabella `users`)

**Query per reseller:**

```sql
-- Recupera tutti i sub-user del reseller
SELECT id FROM users WHERE parent_id = :reseller_user_id;

-- Filtra spedizioni cancellate
SELECT * FROM shipments
WHERE deleted = true
AND user_id IN (:reseller_id, :sub_user_id_1, :sub_user_id_2, ...);
```

---

## 📝 File Modificati/Creati

### Backend

1. **`app/api/spedizioni/route.ts`**
   - Migliorata logica `DELETE` per cancellazione simultanea
   - Aggiunto popolamento `deleted_by_user_email` e `deleted_by_user_name`
   - Priorità configurazione Spedisci.Online

2. **`app/api/spedizioni/cancellate/route.ts`** (NUOVO)
   - Endpoint `GET` per recuperare spedizioni cancellate
   - Implementazione filtri RBAC
   - Paginazione

### Frontend

3. **`app/dashboard/spedizioni/cancellate/page.tsx`** (NUOVO)
   - Pagina per visualizzare spedizioni cancellate
   - Tabella con ricerca e filtri
   - Paginazione

4. **`lib/config/navigationConfig.ts`**
   - Aggiunto link "Spedizioni Cancellate" nella sidebar

5. **`components/dashboard-nav.tsx`**
   - Aggiunto breadcrumb per `/dashboard/spedizioni/cancellate`

### Database

6. **`supabase/migrations/050_add_deleted_by_user_email.sql`** (NUOVO)
   - Aggiunge campi `deleted_by_user_email` e `deleted_by_user_name`
   - Crea indici per performance

---

## 🧪 Testing

### Test Manuali Consigliati

1. **Cancellazione come User normale:**
   - Cancella una spedizione
   - Verifica che `deleted_by_user_email` sia popolato
   - Verifica che appaia in `/dashboard/spedizioni/cancellate`

2. **Cancellazione come Reseller:**
   - Cancella una spedizione
   - Verifica che `deleted_by_user_name` contenga "Reseller"
   - Verifica che veda anche le spedizioni cancellate dei sub-user

3. **Cancellazione come Admin:**
   - Cancella una spedizione
   - Verifica che `deleted_by_user_name` contenga "Admin"
   - Verifica che veda tutte le spedizioni cancellate

4. **Cancellazione simultanea:**
   - Configura Spedisci.Online
   - Crea una spedizione
   - Cancella la spedizione
   - Verifica che sia cancellata anche su Spedisci.Online (se possibile)

---

## 🚀 Roadmap Futura

### Feature Potenziali

- [ ] **Ripristino spedizioni**: Funzionalità per "ripristinare" una spedizione cancellata
- [ ] **Export CSV**: Esportare lista spedizioni cancellate
- [ ] **Filtri avanzati**: Filtrare per data cancellazione, corriere, costo
- [ ] **Statistiche**: Dashboard con statistiche sulle cancellazioni
- [ ] **Notifiche**: Notificare il proprietario quando una spedizione viene cancellata da un admin/reseller

---

## 📚 Riferimenti

- **Migration:** `supabase/migrations/050_add_deleted_by_user_email.sql`
- **API Route:** `app/api/spedizioni/cancellate/route.ts`
- **Frontend Page:** `app/dashboard/spedizioni/cancellate/page.tsx`
- **Navigation Config:** `lib/config/navigationConfig.ts`

---

**Ultimo aggiornamento:** 31 Dicembre 2025  
**Versione:** 0.3.0  
**Status:** ✅ Implementato e testato

---

## 🔧 Fix e Miglioramenti (31 Dicembre 2025)

### Fix Cancellazione Spedisci.Online

**Problema**: L'`increment_id` estratto dal tracking number non corrispondeva all'`increment_id` reale della spedizione su Spedisci.Online, causando errori 404 durante la cancellazione.

**Soluzione**:

1. **Salvataggio `shipmentId` durante creazione**: Il `shipmentId` (increment_id) viene ora estratto dalla risposta API di Spedisci.Online e salvato come `shipment_id_external` nel database
2. **Estrazione corretta da tracking**: Se `shipment_id_external` non è disponibile, l'estrazione dal tracking ora cerca il numero alla fine (es: `3UW1LZ1549886` → `1549886`) invece di usare `parseInt()` che restituiva solo `3`
3. **Priorità corretta**: La cancellazione ora usa `shipment_id_external` (increment_id reale) se disponibile, altrimenti estrae dal tracking

**File modificati**:

- `lib/adapters/couriers/spedisci-online.ts`: Estrazione `shipmentId` dalla risposta API e correzione logica estrazione `increment_id`
- `lib/engine/fulfillment-orchestrator.ts`: Passaggio `shipmentId` nel risultato
- `app/api/spedizioni/route.ts`: Salvataggio `shipment_id_external` durante creazione

### Fix Nome File PDF

**Problema**: I file PDF scaricati avevano nomi come `LDV_3UW1LZ1549886.pdf` o `etichetta_3UW1LZ1549886_2025-12-31.pdf`.

**Soluzione**: Ora tutti i file PDF usano solo il tracking number come nome: `3UW1LZ1549886.pdf`

**File modificati**:

- `app/dashboard/spedizioni/nuova/page.tsx`: Nome file durante creazione
- `app/api/spedizioni/[id]/ldv/route.ts`: Nome file durante download da lista
- `lib/adapters/export/index.ts`: Nome file per fallback ExportService
