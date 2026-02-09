# FASE 5 - Dominio Email Custom Reseller

**Status:** COMPLETE
**Date:** 2026-02-12
**Commits:** `556a7ec` (implementazione), `70b4eb4` (hardening 10/10)

---

## Executive Summary

FASE 5 permette ai reseller di configurare un dominio email personalizzato (es. `@logisticamilano.it`) per inviare/ricevere email con il proprio brand, invece del default `@spediresicuro.it`.

Integrazione completa con Resend Domains API: registrazione dominio, verifica DNS, gestione indirizzi email, rimozione.

---

## Architettura

```
Reseller Owner (UI)
       |
       v
  /dashboard/workspace/email-domain
       |
       v
  API Routes (Next.js)
  ├── /api/workspaces/[id]/custom-domain          GET | POST | DELETE
  ├── /api/workspaces/[id]/custom-domain/verify    POST
  └── /api/workspaces/[id]/email-addresses         GET | POST | DELETE
       |
       v
  Domain Management Service (lib/email/domain-management-service.ts)
       |
       ├── Validazione (dominio, email, displayName)
       ├── Resend SDK (domains.create/get/verify/remove)
       └── Supabase (workspace_custom_domains, workspace_email_addresses)
```

---

## Database

### Tabella: `workspace_custom_domains`

| Colonna          | Tipo        | Note                                          |
| ---------------- | ----------- | --------------------------------------------- | ---------- | -------- |
| id               | UUID PK     | gen_random_uuid()                             |
| workspace_id     | UUID FK     | UNIQUE — max 1 dominio per workspace          |
| domain_name      | TEXT        | UNIQUE globale — no cross-workspace hijacking |
| resend_domain_id | TEXT        | ID dominio su Resend                          |
| status           | TEXT        | 'pending'                                     | 'verified' | 'failed' |
| dns_records      | JSONB       | Record DNS da Resend                          |
| region           | TEXT        | Default 'eu-west-1'                           |
| verified_at      | TIMESTAMPTZ | Data verifica                                 |
| created_at       | TIMESTAMPTZ |                                               |
| updated_at       | TIMESTAMPTZ | Trigger automatico                            |

### Migrations

1. `20260212100000_workspace_custom_domains.sql` — Crea tabella, RLS, trigger, index
2. `20260212110000_workspace_custom_domains_rls_with_check.sql` — Aggiunge WITH CHECK esplicito alla policy owner

### RLS Policies

| Policy                          | Scopo                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `ws_members_read_custom_domain` | SELECT per membri attivi del workspace                             |
| `ws_owner_manage_custom_domain` | ALL (INSERT/UPDATE/DELETE) per owner/admin, con USING + WITH CHECK |

---

## Service: domain-management-service.ts

### Funzioni principali

| Funzione                                                        | Scopo                                                |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `registerCustomDomain(wsId, domain)`                            | Registra su Resend + salva DB                        |
| `getWorkspaceCustomDomain(wsId)`                                | Lettura DB (no call Resend)                          |
| `verifyCustomDomain(wsId)`                                      | Trigger verifica DNS + aggiorna status               |
| `removeCustomDomain(wsId)`                                      | Rimuove da Resend + invalida indirizzi + cancella DB |
| `addEmailAddressOnDomain(wsId, email, displayName, isPrimary?)` | Crea indirizzo su dominio verificato                 |
| `removeEmailAddress(wsId, addressId)`                           | Rimuove indirizzo (blocca se ultimo primary)         |

### Funzioni di validazione

| Funzione                      | Regole                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `validateDomainName(domain)`  | Regex RFC, max 253 chars, blocklist (28 domini)                  |
| `validateEmailAddress(email)` | RFC regex, max 254 chars, local part non vuota                   |
| `validateDisplayName(name)`   | No `<>`, no control chars, max 100 chars (anti header-injection) |

### Blocklist domini

`spediresicuro.it`, `gmail.com`, `outlook.com`, `yahoo.com`, `hotmail.com`, `live.com`, `icloud.com`, `protonmail.com`, `libero.it`, `virgilio.it`, `tiscali.it`, `aruba.it` e altri provider email gratuiti.

---

## API Routes

### `/api/workspaces/[id]/custom-domain`

| Metodo | Scopo                                | Auth              |
| ------ | ------------------------------------ | ----------------- |
| GET    | Info dominio + DNS records + status  | membership attiva |
| POST   | Registra dominio (`{ domainName }`)  | owner only        |
| DELETE | Rimuove dominio + invalida indirizzi | owner only        |

### `/api/workspaces/[id]/custom-domain/verify`

| Metodo | Scopo                                            | Auth       |
| ------ | ------------------------------------------------ | ---------- |
| POST   | Triggera verifica DNS, ritorna status aggiornato | owner only |

### `/api/workspaces/[id]/email-addresses`

| Metodo | Scopo                                                        | Auth              |
| ------ | ------------------------------------------------------------ | ----------------- |
| GET    | Lista indirizzi email                                        | membership attiva |
| POST   | Crea indirizzo (`{ emailAddress, displayName, isPrimary? }`) | owner only        |
| DELETE | Rimuove indirizzo (`?addressId=xxx`)                         | owner only        |

### Validazioni API (defense in depth)

Pre-check a livello route (prima del service):

- `domainName.length > 253` → 400
- `emailAddress.length > 254` → 400
- `displayName.length > 100` → 400

Validazione completa nel service (regex, blocklist, format).

---

## UI: /dashboard/workspace/email-domain

Pagina dedicata con 4 stati:

### Stato 1: Nessun dominio

- Empty state con icona Globe
- Info box vantaggi
- Input dominio + bottone "Registra Dominio"

### Stato 2: Dominio pendente

- Badge giallo "In attesa di verifica"
- Tabella DNS records (Tipo, Nome, Valore, Stato, Copia)
- Nota propagazione DNS (fino a 48h)
- Bottone "Verifica DNS"
- Bottone "Rimuovi dominio" (con conferma)

### Stato 3: Dominio verificato

- Badge verde "Verificato" + data
- Tabella DNS (checkmark verdi)
- Sezione "Indirizzi Email":
  - Lista con display name, email, badge primary, delete
  - Form: localpart + @dominio (auto), display name, primary toggle

### Stato 4: Verifica fallita

- Badge rosso "Verifica fallita"
- Records falliti evidenziati
- Bottone "Riprova verifica"

### Protezioni UI

- Cooldown 30s su bottoni Registra e Verifica (previene spam Resend API)
- Solo owner vede azioni di modifica (canManage = `hasPermission('settings:edit')`)

---

## Navigazione

Aggiunto in `lib/config/navigationConfig.ts` nel blocco reseller "Gestione Business":

```typescript
{
  id: 'email-domain',
  label: 'Dominio Email',
  href: '/dashboard/workspace/email-domain',
  icon: Globe,
  description: 'Configura dominio email personalizzato',
}
```

---

## Sicurezza

| Controllo           | Dettaglio                                           |
| ------------------- | --------------------------------------------------- |
| Auth                | getSafeAuth() + isSuperAdmin() + membership check   |
| Ruolo               | POST/DELETE solo owner; GET qualsiasi membro        |
| UUID validation     | isValidUUID() su tutti i parametri                  |
| Workspace isolation | workspace_id in ogni query                          |
| Domain hijacking    | UNIQUE globale su domain_name                       |
| Header injection    | Display name: no `<>`, no control chars             |
| Input length        | Dominio max 253, email max 254, displayName max 100 |
| Blocklist           | 28 domini bloccati (piattaforma + free email)       |
| RLS                 | WITH CHECK esplicito su policy FOR ALL              |
| Server-side only    | Tutte le chiamate Resend server-side                |
| Orphan tracking     | Log strutturato ORPHAN_DOMAIN per cleanup manuale   |
| Rate limit UI       | Cooldown 30s su registra/verifica                   |

---

## Test

### domain-management-service.test.ts (~35 test)

- `validateDomainName`: formato valido, invalido, vuoto, blocklist, troppo lungo
- `validateEmailAddress`: valido, vuoto, formato invalido, troppo lungo
- `validateDisplayName`: valido, vuoto, caratteri pericolosi, troppo lungo
- `registerCustomDomain`: successo, workspace ha gia dominio, dominio in uso, blocklist, invalido, errore Resend
- `verifyCustomDomain`: verified, failed, non trovato, aggiorna records
- `removeCustomDomain`: successo, invalida indirizzi, errore Resend
- `addEmailAddressOnDomain`: successo, dominio non verificato, email non match, isPrimary, email invalida, displayName pericoloso, displayName troppo lungo
- `removeEmailAddress`: successo, blocca ultimo primary, non trovato

### custom-domain-api.test.ts (~18 test)

- GET: dominio trovato, nessun dominio, 400 UUID, 401 no auth, 403 no member
- POST: successo, 403 non owner, 400 invalido, 400 dominio troppo lungo
- DELETE: successo, 403 non owner
- POST verify: successo + ritorna status
- POST email-addresses: successo, 403, email troppo lunga, displayName troppo lungo
- DELETE email-addresses: successo

**Totale test suite:** 2477 (tutti verdi)

---

## File

### Creati

| File                                                                             | Scopo                           |
| -------------------------------------------------------------------------------- | ------------------------------- |
| `supabase/migrations/20260212100000_workspace_custom_domains.sql`                | Tabella + RLS + trigger + index |
| `supabase/migrations/20260212110000_workspace_custom_domains_rls_with_check.sql` | RLS WITH CHECK                  |
| `lib/email/domain-management-service.ts`                                         | Business logic Resend Domains   |
| `app/api/workspaces/[workspaceId]/custom-domain/route.ts`                        | GET/POST/DELETE dominio         |
| `app/api/workspaces/[workspaceId]/custom-domain/verify/route.ts`                 | POST verifica DNS               |
| `app/dashboard/workspace/email-domain/page.tsx`                                  | UI configurazione               |
| `tests/unit/domain-management-service.test.ts`                                   | Test service                    |
| `tests/unit/custom-domain-api.test.ts`                                           | Test API                        |

### Modificati

| File                                                        | Modifica                                     |
| ----------------------------------------------------------- | -------------------------------------------- |
| `app/api/workspaces/[workspaceId]/email-addresses/route.ts` | Aggiunto POST + DELETE + pre-check lunghezza |
| `lib/config/navigationConfig.ts`                            | Aggiunto nav item "Dominio Email"            |

---

## Flusso Operativo Reseller

```
1. Reseller apre /dashboard/workspace/email-domain
2. Inserisce dominio (es. logisticamilano.it) → POST /custom-domain
3. Resend crea dominio → ritorna DNS records
4. Reseller configura DNS nel pannello del provider
5. Attende propagazione (fino a 48h)
6. Clicca "Verifica DNS" → POST /custom-domain/verify
7. Se verificato: crea indirizzi email (es. info@logisticamilano.it)
8. Email inviate da workspace usano indirizzo custom
```

---

## Variabili Ambiente

Nessuna nuova variabile necessaria. Riusa `RESEND_API_KEY` esistente tramite `getResend()` in `lib/email/resend.ts`.

---

**Document Version:** 1.0.0
**Date:** 2026-02-12
**Review Score:** 10/10
