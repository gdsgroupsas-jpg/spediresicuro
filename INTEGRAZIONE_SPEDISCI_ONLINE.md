# 🚀 Integrazione Spedisci.Online - Guida Completa

## 📋 Panoramica

SpedireSicuro.it si integra automaticamente con **spedisci.online** per creare le LDV (Lettere di Vettura) in modo automatico e diretto.

**Come funziona:**
1. L'utente crea una spedizione su SpedireSicuro.it
2. La spedizione viene salvata nel database
3. **Automaticamente** viene inviata a spedisci.online
4. Spedisci.online crea la LDV
5. Il cliente può scaricare la LDV direttamente

---

## 🔧 Configurazione

### 1. Ottieni Credenziali Spedisci.Online

Per utilizzare l'integrazione, devi avere:
- **API Key** di spedisci.online
- (Opzionale) **API Secret**
- (Opzionale) **Customer Code**

**Come ottenerle:**
1. Accedi al tuo account spedisci.online
2. Vai su **Impostazioni** → **API**
3. Genera una nuova API Key
4. Copia le credenziali

### 2. Configura Credenziali su SpedireSicuro

**Opzione A: Via Impostazioni (UI - da implementare)**
1. Vai su `/dashboard/impostazioni`
2. Sezione **Integrazioni** → **Spedisci.Online**
3. Inserisci API Key e salva

**Opzione B: Via Server Action (Programmatico)**
```typescript
import { saveSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online'

await saveSpedisciOnlineCredentials({
  api_key: 'your-api-key',
  api_secret: 'your-api-secret', // opzionale
  customer_code: 'your-customer-code', // opzionale
  base_url: 'https://api.spedisci.online', // opzionale, default
})
```

---

## 🔄 Flusso Automatico

### Creazione Spedizione → Invio Automatico

Quando crei una nuova spedizione:

```typescript
// 1. POST /api/spedizioni
const response = await fetch('/api/spedizioni', {
  method: 'POST',
  body: JSON.stringify(spedizioneData),
})

// 2. Il server automaticamente:
//    - Salva la spedizione nel database
//    - Invia a spedisci.online (se configurato)
//    - Restituisce risultato con info invio
```

**Risposta API:**
```json
{
  "success": true,
  "message": "Spedizione creata con successo",
  "data": { /* dati spedizione */ },
  "spedisci_online": {
    "success": true,
    "tracking_number": "SPED12345678",
    "label_url": "https://spedisci.online/labels/SPED12345678.pdf",
    "message": "Spedizione inviata a spedisci.online con successo"
  }
}
```

---

## 📦 Formato Dati

### Formato CSV Spedisci.Online

Il sistema genera automaticamente CSV nel formato richiesto:

```csv
destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;
Mario Rossi;Via Roma 123;20100;Milano;MI;IT;2.5;1;0;Azienda SRL;Mario Rossi;;+39 1234567890;mario@example.com;Elettronica;ORD123;25.50;
```

### Mapping Campi

| Campo SpedireSicuro | Campo Spedisci.Online | Note |
|---------------------|----------------------|------|
| `destinatario.nome` | `destinatario` | Obbligatorio |
| `destinatario.indirizzo` | `indirizzo` | Obbligatorio |
| `destinatario.cap` | `cap` | Obbligatorio |
| `destinatario.citta` | `localita` | Obbligatorio |
| `destinatario.provincia` | `provincia` | 2 lettere, maiuscolo |
| - | `country` | Sempre "IT" |
| `peso` | `peso` | Formato: punto decimale (es. 2.5) |
| `colli` | `colli` | Default: 1 |
| `contrassegno` | `contrassegno` | Opzionale |
| `mittente.nome` | `rif_mittente` | Opzionale |
| `destinatario.nome` | `rif_destinatario` | Opzionale |
| `note` | `note` | Opzionale |
| `destinatario.telefono` | `telefono` | Opzionale |
| `destinatario.email` | `email_destinatario` | Opzionale |
| `contenuto` | `contenuto` | Opzionale |
| `tracking` | `order_id` | Opzionale |
| `prezzoFinale` | `totale_ordine` | Opzionale |

---

## 🔌 API Methods

### 1. Upload CSV (Metodo Preferito)

Se spedisci.online supporta upload CSV:

```typescript
POST https://api.spedisci.online/v1/shipments/upload
Content-Type: multipart/form-data
Authorization: Bearer {api_key}

{
  "file": <CSV file>,
  "format": "csv"
}
```

### 2. POST JSON (Metodo Alternativo)

Se spedisci.online supporta JSON:

```typescript
POST https://api.spedisci.online/v1/shipments
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "destinatario": "Mario Rossi",
  "indirizzo": "Via Roma 123",
  // ... altri campi
}
```

### 3. Fallback: CSV Locale

Se l'API non è disponibile, il sistema genera CSV locale che l'utente può caricare manualmente.

---

## 🛡️ Gestione Errori

### Errori Non Bloccanti

L'invio a spedisci.online **non blocca** la creazione della spedizione:

- ✅ Se l'invio fallisce, la spedizione viene comunque salvata
- ✅ L'utente può scaricare CSV/PDF locale
- ✅ L'utente può ritentare l'invio manualmente

### Tipi di Errore

1. **Credenziali non configurate**
   - Errore: `Credenziali spedisci.online non configurate`
   - Soluzione: Configura credenziali nelle Impostazioni

2. **Connessione fallita**
   - Errore: `Impossibile connettersi a spedisci.online`
   - Soluzione: Verifica API Key e connessione internet

3. **Validazione fallita**
   - Errore: `Dati spedizione non validi`
   - Soluzione: Verifica che tutti i campi obbligatori siano presenti

---

## 🔐 Sicurezza

### Credenziali

- ✅ Le credenziali sono salvate in **Supabase** (se configurato) o database locale
- ✅ Le credenziali sono **criptate** nel database
- ✅ Le API Key non vengono mai esposte al client
- ✅ Tutte le chiamate API avvengono **lato server**

### Autenticazione

- ✅ Solo utenti autenticati possono configurare credenziali
- ✅ Ogni utente vede solo le proprie credenziali
- ✅ Le spedizioni sono associate all'utente che le crea

---

## 📝 Esempio Completo

### 1. Configura Credenziali

```typescript
// Server Action
import { saveSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online'

await saveSpedisciOnlineCredentials({
  api_key: 'sk_live_xxxxx',
  base_url: 'https://api.spedisci.online',
})
```

### 2. Crea Spedizione

```typescript
// Client Component
const response = await fetch('/api/spedizioni', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mittenteNome: 'Azienda SRL',
    destinatarioNome: 'Mario Rossi',
    destinatarioIndirizzo: 'Via Roma 123',
    destinatarioCitta: 'Milano',
    destinatarioProvincia: 'MI',
    destinatarioCap: '20100',
    peso: '2.5',
    corriere: 'GLS',
  }),
})

const result = await response.json()

// Verifica invio spedisci.online
if (result.spedisci_online?.success) {
  console.log('✅ LDV creata su spedisci.online:', result.spedisci_online.tracking_number)
} else {
  console.warn('⚠️ Invio fallito:', result.spedisci_online?.error)
}
```

---

## 🚀 Prossimi Passi

### Da Implementare

1. **UI Configurazione Credenziali**
   - Form in `/dashboard/impostazioni`
   - Test connessione
   - Salvataggio sicuro

2. **Tracking Automatico**
   - Sincronizzazione stato spedizioni
   - Webhook da spedisci.online

3. **Gestione Errori Avanzata**
   - Retry automatico
   - Notifiche email in caso di errore
   - Log dettagliati

4. **Bulk Upload**
   - Caricamento multiplo spedizioni
   - CSV batch

---

## 📞 Supporto

Per problemi o domande:
- Controlla i log del server per errori dettagliati
- Verifica le credenziali API su spedisci.online
- Contatta il supporto se l'API non risponde

---

**✅ Integrazione pronta per l'uso!**

