# Workspace Email Infrastructure (FASE 2)

**Commit:** `d7014c9`
**Completato:** 2026-02-09

## Obiettivo

Infrastruttura completa per email workspace-scoped: ogni workspace ha i propri indirizzi email,
le email sono isolate per workspace (RLS), invio/ricezione atomici tramite RPC PostgreSQL,
sanitizzazione HTML multi-pass, webhook Resend autenticato.

## Tabelle DB create

### `workspace_email_addresses`

Mapping 1:1 tra indirizzo email e workspace.

| Colonna            | Tipo        | Note                                      |
| ------------------ | ----------- | ----------------------------------------- |
| id                 | UUID PK     | gen_random_uuid()                         |
| workspace_id       | UUID FK     | workspaces(id) ON DELETE CASCADE          |
| email_address      | TEXT UNIQUE | Normalizzato a lowercase (trigger)        |
| display_name       | TEXT        | Nome visualizzato nel FROM                |
| is_primary         | BOOLEAN     | Partial unique index per workspace        |
| is_verified        | BOOLEAN     | Solo indirizzi verificati possono inviare |
| resend_domain_id   | TEXT        | ID dominio verificato in Resend           |
| domain_verified_at | TIMESTAMPTZ | Timestamp verifica DNS                    |

**Indici:**

- `UNIQUE(email_address)` — un indirizzo = un solo workspace
- Functional index `lower(email_address)` — lookup case-insensitive
- Partial unique `(workspace_id) WHERE is_primary = true` — un solo primario per workspace

### `workspace_announcements`

Bacheca broadcast per comunicazioni reseller → team/clienti.

| Colonna      | Tipo    | Note                                     |
| ------------ | ------- | ---------------------------------------- |
| id           | UUID PK | gen_random_uuid()                        |
| workspace_id | UUID FK | workspaces(id)                           |
| author_id    | UUID FK | auth.users(id)                           |
| title        | TEXT    | Titolo annuncio                          |
| body_html    | TEXT    | Corpo HTML sanitizzato                   |
| target       | TEXT    | CHECK: 'all', 'team', 'clients'          |
| priority     | TEXT    | CHECK: 'low', 'normal', 'high', 'urgent' |
| pinned       | BOOLEAN | Fissato in alto                          |
| channels     | TEXT[]  | Default: ['in_app']                      |
| read_by      | UUID[]  | Array utenti che hanno letto             |

### Modifica tabella `emails`

- Aggiunto `workspace_id UUID REFERENCES workspaces(id)`
- Indice `idx_emails_workspace_id`
- RLS separate: SELECT (tutti i membri) vs INSERT/UPDATE/DELETE (owner/admin/operator)

## RPC Functions (SECURITY DEFINER)

### `send_workspace_email`

Invio atomico: valida ownership mittente + `is_verified`, inserisce record, ritorna UUID.
Include check `auth.uid()` per membership (bypassato solo da service_role).

### `lookup_workspace_by_email`

Lookup workspace destinatario per routing inbound. REVOKE da public/anon (solo authenticated).

### `mark_announcement_read`

Aggiunta atomica con `array_append` e verifica membership.

## Service: `lib/email/workspace-email-service.ts`

### Funzioni esportate

| Funzione                              | Descrizione                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sanitizeEmailHtml(html)`             | Sanitizzazione multi-pass (4 pass): tag pericolosi, event handler, protocolli con entity decoding, recomposition |
| `validateSenderAddress(wsId, addrId)` | Verifica ownership indirizzo nel workspace                                                                       |
| `sendWorkspaceEmail(params)`          | Flusso completo: validate → rate limit → sanitize → RPC → Resend                                                 |
| `getWorkspaceEmailAddresses(wsId)`    | Lista indirizzi del workspace                                                                                    |
| `lookupWorkspaceByEmail(email)`       | Wrapper RPC per routing inbound                                                                                  |

### Rate Limiting

- Legge `daily_limit` da `outreach_channel_config` (default: 100/giorno)
- **Fail-closed**: dopo 3 errori consecutivi DB, blocca tutti gli invii
- Counter in-memory `rateLimitFailCount` con soglia 3

### Sanitizzazione HTML (4 pass)

1. **Tag pericolosi**: script, iframe, object, embed, form, style, link, meta, base, svg, math, applet
2. **Event handler**: `on*` attributes (onclick, onerror, onload, ecc.)
3. **Protocolli pericolosi**: javascript:, vbscript:, data: — con decodifica HTML entities per bloccare bypass
4. **Recomposition**: secondo pass tag per bloccare `<scr<script>ipt>` attacks

## Webhook Inbound (`app/api/webhooks/email-inbound/route.ts`)

### Sicurezza

- **Svix signature verification**: HMAC-SHA256, timestamp replay check (5min), multi-signature support
- **Payload limit**: 1MB max body, 50KB max raw_payload salvato in DB
- **Inbound HTML sanitization**: `sanitizeEmailHtml()` su body_html ricevuto
- **ID validation**: regex `[a-zA-Z0-9_-]` per resendEmailId (previene path traversal)
- **Error masking**: nessun errore DB esposto nella response

### Routing

1. Estrai indirizzi TO e CC
2. Per ogni indirizzo, `lookupWorkspaceByEmail()`
3. Primo match → `workspace_id` assegnato
4. Nessun match → `workspace_id = NULL` (visibile solo a superadmin)

## 17 Fix di Sicurezza (post-review)

| #   | Severita | Fix                                                |
| --- | -------- | -------------------------------------------------- |
| 1   | CRITICAL | RPC auth.uid() check + service_role bypass         |
| 2   | HIGH     | REVOKE lookup da public/anon                       |
| 3   | MEDIUM   | Functional index lower() + trigger normalize       |
| 4   | HIGH     | RLS emails separate per operazione                 |
| 5   | MEDIUM   | RPC mark_announcement_read atomica                 |
| 6   | LOW      | Partial unique index is_primary                    |
| 7   | CRITICAL | Sanitizzazione HTML multi-pass con entity decoding |
| 8   | HIGH     | Rate limit fail-closed (threshold=3)               |
| 9   | HIGH     | FROM address propagata a Resend                    |
| 10  | MEDIUM   | Errore generico per errori sconosciuti             |
| 11  | MEDIUM   | is_verified check in RPC SQL                       |
| 13  | CRITICAL | Webhook svix signature authentication              |
| 14  | CRITICAL | Sanitizza body_html inbound                        |
| 15  | MEDIUM   | Payload limit 1MB + raw_payload truncation 50KB    |
| 16  | LOW      | Error masking nella response                       |
| 17  | MEDIUM   | Validazione resendEmailId (regex)                  |
| 18  | LOW      | Rate limiting implicito via webhook auth           |

## Test

| File                                               | Test | Tipo     |
| -------------------------------------------------- | ---- | -------- |
| `tests/unit/workspace-email-service.test.ts`       | 31   | Unit     |
| `tests/security/email-workspace-isolation.test.ts` | 30   | Security |

**Totale: 61 test, tutti verdi.**

## File coinvolti

### Creati

- `supabase/migrations/20260211100000_workspace_email_infrastructure.sql`
- `lib/email/workspace-email-service.ts`
- `tests/unit/workspace-email-service.test.ts`
- `tests/security/email-workspace-isolation.test.ts`

### Modificati

- `app/api/webhooks/email-inbound/route.ts` (routing + sicurezza)
- `lib/email/resend.ts` (parametro `from` opzionale)

## Env Vars nuove

| Variabile               | Dove             | Descrizione                            |
| ----------------------- | ---------------- | -------------------------------------- |
| `RESEND_WEBHOOK_SECRET` | Vercel Dashboard | Secret per verifica firma svix webhook |
