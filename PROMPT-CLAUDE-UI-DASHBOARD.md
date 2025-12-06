# 🎯 PROMPT PER CLAUDE - Creazione Dashboard UI

## CONTESTO

Sto implementando un sistema Reseller (Rivenditore) con Wallet (Sistema Crediti) per la piattaforma SpedisiciSicuro.

**BACKEND COMPLETO:** Tutte le Server Actions e il database sono già pronti e funzionanti. Devo solo creare le interfacce utente (UI).

---

## TASK: Creare 2 Dashboard UI

### 1. Dashboard Super Admin
**Percorso:** `app/dashboard/super-admin/page.tsx`

**Funzionalità richieste:**

#### A) Tabella Utenti
- Lista tutti gli utenti con colonne:
  - Nome
  - Email
  - Tipo account (user/admin/superadmin)
  - Status Reseller (Sì/No badge)
  - Wallet Balance (€XX.XX)
  - Data creazione
  - Azioni (3 bottoni: Reseller toggle, Aggiungi credito, Gestisci feature)

#### B) Switch Reseller Mode
- Toggle switch per ogni utente
- Chiama `toggleResellerStatus(userId, isReseller)` da `actions/super-admin.ts`
- Mostra feedback (toast/success message)
- Aggiorna UI in tempo reale

#### C) Modale "Aggiungi Credito"
- Trigger: Bottone "Aggiungi Credito" nella tabella
- Campi:
  - Importo (number, obbligatorio, min 0.01)
  - Motivo (textarea, opzionale, default: "Ricarica manuale")
- Bottone "Aggiungi" → Chiama `manageWallet(userId, amount, reason)` da `actions/super-admin.ts`
- Mostra nuovo balance dopo successo

#### D) Pannello Features (Opzionale, può essere in modale separata)
- Lista feature disponibili (da tabella `killer_features`)
- Per ogni feature: bottone "Attiva" / "Attiva Gratis" (regalo)
- Chiama `grantFeature(userId, featureCode, isFree)` da `actions/super-admin.ts`

**Server Actions disponibili:**
- `getAllUsers()` → Lista utenti
- `toggleResellerStatus(userId, isReseller)` → Promuove/declassa Reseller
- `manageWallet(userId, amount, reason)` → Gestisce credito
- `grantFeature(userId, featureCode, isFree)` → Attiva feature

**Sicurezza:**
- Verifica `account_type === 'superadmin'` prima di renderizzare
- Se non Super Admin → Redirect a `/dashboard` con messaggio

---

### 2. Dashboard Reseller
**Percorso:** `app/dashboard/team/page.tsx`

**Funzionalità richieste:**

#### A) Card Statistiche (in alto)
- 3-4 card con:
  - Totale Sub-Users
  - Totale Spedizioni
  - Revenue Totale (€XX.XX)
  - Sub-Users Attivi (con almeno 1 spedizione)

#### B) Form "Crea Nuovo Cliente"
- Campi:
  - Email (obbligatorio, validazione email)
  - Nome (obbligatorio)
  - Password (opzionale, se vuota viene generata automaticamente)
  - Company Name (opzionale)
  - Phone (opzionale)
- Bottone "Crea Cliente"
- Chiama `createSubUser(data)` da `actions/admin-reseller.ts`
- Se password generata, mostra modale con password generata (da copiare)

#### C) Tabella Sub-Users
- Lista Sub-Users con colonne:
  - Nome
  - Email
  - Wallet Balance (€XX.XX)
  - Data creazione
  - Azioni (vedi dettagli, opzionale)

#### D) Tab Spedizioni Aggregate (Opzionale)
- Tab separata che mostra spedizioni di tutti i Sub-Users
- Chiama `getSubUsersShipments()` da `actions/admin-reseller.ts`

**Server Actions disponibili:**
- `getSubUsers()` → Lista Sub-Users
- `createSubUser(data)` → Crea nuovo Sub-User
- `getSubUsersStats()` → Statistiche aggregate
- `getSubUsersShipments()` → Spedizioni aggregate

**Sicurezza:**
- Verifica `is_reseller === true` prima di renderizzare
- Se non Reseller → Redirect a `/dashboard` con messaggio

---

## DESIGN GUIDELINES

### Stile
- Seguire design esistente di `app/dashboard/page.tsx`
- Usare Tailwind CSS
- Colori brand: `#FFD700` (gold), `#FF9500` (orange)
- Componenti shadcn/ui se disponibili
- Icone da `lucide-react`

### Layout
- Usare `DashboardNav` component per navigazione
- Card con gradient e shadow per statistiche
- Tabella responsive (scroll orizzontale su mobile)
- Modali per form (centrate, backdrop blur)

### Feedback Utente
- Toast/notifiche per azioni completate
- Loading states durante chiamate async
- Error handling con messaggi chiari
- Success messages dopo azioni

---

## FILE DA USARE COME RIFERIMENTO

### Dashboard esistente:
- `app/dashboard/page.tsx` - Esempio struttura dashboard
- `app/dashboard/spedizioni/page.tsx` - Esempio tabella con dati
- `components/dashboard-nav.tsx` - Componente navigazione

### Server Actions (già pronte):
- `actions/admin-reseller.ts` - Tutte le funzioni Reseller
- `actions/super-admin.ts` - Tutte le funzioni Super Admin

---

## STRUTTURA FILE

### Super Admin Dashboard
```
app/dashboard/super-admin/
  └── page.tsx  (pagina principale)
```

### Reseller Dashboard
```
app/dashboard/team/
  └── page.tsx  (pagina principale)
```

**OPPURE** (scegli uno):

```
app/dashboard/utenti/
  └── page.tsx  (pagina principale)
```

---

## VERIFICA AUTENTICAZIONE

### Per Super Admin:
```typescript
'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuperAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === 'loading') return
    
    const accountType = (session?.user as any)?.account_type
    if (accountType !== 'superadmin') {
      router.push('/dashboard?error=unauthorized')
      return
    }
  }, [session, status, router])
  
  // ... resto del codice
}
```

### Per Reseller:
```typescript
'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResellerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === 'loading') return
    
    const isReseller = (session?.user as any)?.is_reseller
    if (!isReseller) {
      router.push('/dashboard?error=unauthorized')
      return
    }
  }, [session, status, router])
  
  // ... resto del codice
}
```

---

## PRIORITÀ IMPLEMENTAZIONE

1. **PRIMA:** Dashboard Reseller (`/dashboard/team`)
   - Più semplice
   - Utile subito per testare creazione Sub-Users

2. **POI:** Dashboard Super Admin (`/dashboard/super-admin`)
   - Più complessa
   - Richiede più funzionalità

---

## NOTE TECNICHE

- Usare `'use client'` per componenti interattivi
- Server Actions già importabili da `@/actions/admin-reseller` e `@/actions/super-admin`
- Session disponibile via `useSession()` da `next-auth/react`
- Tutti i campi reseller/wallet sono già nella sessione

---

## ESEMPIO CHIAMATA SERVER ACTION

```typescript
'use client'

import { createSubUser } from '@/actions/admin-reseller'
import { useState } from 'react'

export default function CreateUserForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const formData = new FormData(e.currentTarget)
    const result = await createSubUser({
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      password: formData.get('password') as string || undefined,
    })
    
    if (result.success) {
      setMessage(result.message || 'Sub-User creato!')
      // Reset form o refresh lista
    } else {
      setMessage(result.error || 'Errore')
    }
    
    setLoading(false)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  )
}
```

---

## CHECKLIST FINALE

### Dashboard Reseller:
- [ ] Verifica autenticazione Reseller
- [ ] Card statistiche in alto
- [ ] Form crea Sub-User
- [ ] Tabella lista Sub-Users
- [ ] Loading states
- [ ] Error handling
- [ ] Success feedback

### Dashboard Super Admin:
- [ ] Verifica autenticazione Super Admin
- [ ] Tabella lista utenti
- [ ] Switch Reseller Mode
- [ ] Modale aggiungi credito
- [ ] Pannello gestione features (opzionale)
- [ ] Loading states
- [ ] Error handling
- [ ] Success feedback

---

**OBBIETTIVO:** Creare 2 dashboard complete, funzionanti e con design coerente al resto dell'applicazione.

**REFERENCE:** Usare `app/dashboard/page.tsx` come esempio di stile e struttura.
