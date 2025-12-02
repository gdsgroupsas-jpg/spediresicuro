# Implementazione GDPR - SpedireSicuro.it

## 📋 Riepilogo

Questa documentazione descrive l'implementazione delle funzionalità GDPR per la piattaforma SpedireSicuro.it.

## ✅ Componenti Implementati

### 1. Cookie Consent Manager

**File:** `components/legal/CookieBanner.tsx`

Banner per gestione consenso cookie granulare con tre categorie:
- **Necessari** (sempre attivi)
- **Analitici** (opzionali - es. Google Analytics)
- **Marketing** (opzionali - es. Facebook Pixel)

**Caratteristiche:**
- Salvataggio preferenze in `localStorage`
- Blocco automatico script di tracciamento se consenso non dato
- UI moderna e non invasiva
- Dialog personalizzazione con toggle per categoria

**Integrazione:**
Il banner è integrato nel layout principale (`app/layout.tsx`) e viene mostrato automaticamente al primo accesso.

### 2. Export Dati Utente (Diritto alla Portabilità)

**File:** `actions/privacy.ts` → `exportUserData()`

Permette all'utente di scaricare tutti i propri dati in formato JSON.

**Dati esportati:**
- Profilo utente completo
- Storico spedizioni
- Preventivi salvati
- Configurazioni e preferenze
- Statistiche

**Utilizzo:**
```typescript
const result = await exportUserData();
if (result.success) {
  // Scarica file JSON
  const blob = new Blob([result.data], { type: 'application/json' });
  // ... download logic
}
```

### 3. Cancellazione Account con Anonimizzazione (Diritto all'Oblio)

**File:** `actions/privacy.ts` → `requestAccountDeletion()`

⚠️ **IMPORTANTE:** Non possiamo fare DELETE brutale delle spedizioni per motivi fiscali/legali.

**Logica di anonimizzazione:**
1. **Profilo utente:**
   - Email → `deleted_[uuid]@void.com`
   - Nome → `Utente Eliminato`
   - Rimozione dati sensibili (password, telefono, P.IVA, ecc.)

2. **Spedizioni:**
   - Anonimizzazione campi PII (nomi, indirizzi, email, telefoni)
   - Mantenimento dati non personali (peso, dimensioni, prezzi, tracking) per obblighi fiscali

3. **Logout immediato** (gestito dal client)

**Sicurezza:**
- Richiede conferma esplicita: utente deve digitare "ELIMINA"
- Operazione irreversibile

### 4. Pagina Privacy & Dati Personali

**File:** `app/dashboard/profile/privacy/page.tsx`

Pagina nella dashboard utente con:
- Sezione export dati con pulsante download
- Sezione cancellazione account con conferma a doppio step
- Link alle pagine legali
- UI professionale e user-friendly

**Accesso:**
`/dashboard/profile/privacy`

### 5. Pagine Legali

Pagine statiche con contenuto placeholder strutturato:

- **Privacy Policy** (`app/privacy-policy/page.tsx`)
  - Sezioni: Titolare, Dati raccolti, Finalità, Base giuridica, Diritti utente, ecc.
  - Pronta per essere riempita con testi legali reali

- **Termini e Condizioni** (`app/terms-conditions/page.tsx`)
  - Sezioni: Accettazione, Servizio, Account, Prezzi, Responsabilità, ecc.

- **Cookie Policy** (`app/cookie-policy/page.tsx`)
  - Sezioni: Cosa sono i cookie, Tipi utilizzati, Gestione, Durata, ecc.

## 🔧 Configurazione Database

### Migration SQL

**File:** `supabase/migrations/009_gdpr_privacy_policies.sql`

Aggiunge:
- Policy RLS per UPDATE su `users` e `shipments`
- Funzione helper `can_anonymize_user()` per validazioni
- Funzione `anonymize_user_account()` per anonimizzazione (solo service role/admin)

**Esecuzione:**
```sql
-- Esegui la migration in Supabase SQL Editor
\i supabase/migrations/009_gdpr_privacy_policies.sql
```

**Nota:** Le operazioni di anonimizzazione usano `supabaseAdmin` (service role) che bypassa RLS, quindi le policy sono principalmente per documentazione e operazioni client-side.

## 📝 Utilizzo

### Per l'Utente

1. **Gestione Cookie:**
   - Al primo accesso, appare il banner cookie
   - Clicca "Personalizza" per gestire le preferenze
   - Le preferenze vengono salvate automaticamente

2. **Export Dati:**
   - Vai su `/dashboard/profile/privacy`
   - Clicca "Scarica i miei dati"
   - Il file JSON viene scaricato automaticamente

3. **Cancellazione Account:**
   - Vai su `/dashboard/profile/privacy`
   - Clicca "Elimina il mio account"
   - Digita "ELIMINA" per confermare
   - Verrai disconnesso automaticamente

### Per lo Sviluppatore

**Test Export:**
```typescript
import { exportUserData } from '@/actions/privacy';

const result = await exportUserData();
console.log(result);
```

**Test Anonimizzazione:**
```typescript
import { requestAccountDeletion } from '@/actions/privacy';

const result = await requestAccountDeletion('ELIMINA');
console.log(result);
```

## 🔒 Sicurezza

- ✅ Autenticazione richiesta per tutte le operazioni
- ✅ Validazione input (conferma cancellazione)
- ✅ Service role per operazioni sensibili (anonimizzazione)
- ✅ Anonimizzazione invece di DELETE (compliance fiscale)
- ✅ Logout automatico dopo cancellazione

## 📋 Checklist Compliance GDPR

- [x] Cookie Consent Manager granulare
- [x] Export dati utente (Art. 20 - Portabilità)
- [x] Cancellazione account con anonimizzazione (Art. 17 - Oblio)
- [x] Privacy Policy strutturata
- [x] Cookie Policy strutturata
- [x] Termini e Condizioni strutturati
- [x] Pagina gestione privacy nella dashboard
- [x] Policy RLS per sicurezza dati
- [x] Documentazione implementazione

## 🚀 Prossimi Passi

1. **Completare testi legali:**
   - Sostituire placeholder in Privacy Policy
   - Sostituire placeholder in Termini e Condizioni
   - Sostituire placeholder in Cookie Policy
   - Compilare dati titolare trattamento

2. **Test completi:**
   - Test export dati con utente reale
   - Test anonimizzazione account
   - Test cookie banner su diversi browser
   - Test RLS policies

3. **Ottimizzazioni:**
   - Aggiungere export in formato CSV (oltre a JSON)
   - Aggiungere storico modifiche consenso cookie
   - Aggiungere notifica email per cancellazione account

## 📞 Supporto

Per domande o problemi:
- Email: privacy@spediresicuro.it
- Documentazione: `/docs/GDPR_IMPLEMENTATION.md`

---

**Ultimo aggiornamento:** [DATA]
**Versione:** 1.0

