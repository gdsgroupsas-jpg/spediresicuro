# Posta — Sistema Email Integrato

**Data:** 31 Gennaio 2026
**Status:** Attivo
**Accesso:** Solo Superadmin

---

## Panoramica

Sezione "Posta" nel dashboard che permette ai superadmin di inviare e ricevere email tramite gli indirizzi @spediresicuro.it, utilizzando Resend come provider.

## Architettura

```
Email in entrata:
  Mittente → @spediresicuro.it → Resend Inbound → Webhook POST → DB emails

Email in uscita:
  Dashboard Componi → POST /api/email/send → Resend API → Destinatario
                                            → DB emails (folder: sent)
```

## Componenti

### Database — Tabella `emails`

| Campo               | Tipo    | Note                                     |
| ------------------- | ------- | ---------------------------------------- |
| id                  | UUID    | PK                                       |
| message_id          | TEXT    | ID Resend                                |
| direction           | TEXT    | `inbound` / `outbound`                   |
| from_address        | TEXT    | Mittente                                 |
| to_address          | TEXT[]  | Destinatari                              |
| cc, bcc             | TEXT[]  | Opzionali                                |
| subject             | TEXT    | Oggetto                                  |
| body_html           | TEXT    | Corpo HTML                               |
| body_text           | TEXT    | Corpo plain text                         |
| reply_to_message_id | UUID    | FK a emails.id                           |
| attachments         | JSONB   | Array allegati                           |
| status              | TEXT    | `received` / `sent` / `draft` / `failed` |
| read                | BOOLEAN | Letto/non letto                          |
| starred             | BOOLEAN | Segnato con stella                       |
| folder              | TEXT    | `inbox` / `sent` / `drafts` / `trash`    |
| raw_payload         | JSONB   | Payload webhook completo                 |

**RLS:** Solo `account_type = 'superadmin'` ha accesso.

**Migration:** `supabase/migrations/20260131120000_create_emails_table.sql`

### API Routes

| Metodo | Endpoint                             | Descrizione                                   |
| ------ | ------------------------------------ | --------------------------------------------- |
| POST   | `/api/webhooks/email-inbound`        | Webhook Resend (pubblico, no auth)            |
| GET    | `/api/email?folder=inbox&search=...` | Lista email con filtri                        |
| POST   | `/api/email/send`                    | Invia email via Resend                        |
| GET    | `/api/email/[id]`                    | Dettaglio email (auto-mark read)              |
| PATCH  | `/api/email/[id]`                    | Aggiorna read/starred/folder                  |
| DELETE | `/api/email/[id]`                    | Sposta in cestino (o elimina definitivamente) |

Tutte le route (tranne webhook) richiedono autenticazione superadmin.

### UI — `/dashboard/posta`

Layout a 3 colonne stile Gmail:

- **Sidebar sinistra:** Cartelle (Inbox, Inviati, Bozze, Cestino) con badge unread count, bottone "Componi"
- **Lista centrale:** Email con from/to, oggetto, preview, data, stella, indicatore non letto
- **Pannello destro:** Dettaglio email completo con HTML sanitizzato, Rispondi/Inoltra/Elimina

Composer modale con:

- Select "Da" tra 5 indirizzi @spediresicuro.it
- Campi A, CC, Oggetto, Messaggio
- Rispondi pre-popola con "Re:" e quota messaggio originale

### Navigazione

Voce "Posta" nella sezione "Comunicazioni" della sidebar, visibile solo a superadmin.

## Indirizzi Email Disponibili

- `noreply@spediresicuro.it`
- `amministrazione@spediresicuro.it`
- `commerciale@spediresicuro.it`
- `assistenza@spediresicuro.it`
- `info@spediresicuro.it`

## Configurazione Resend

### Webhook Inbound (già configurato)

- **Endpoint:** `https://spediresicuro.it/api/webhooks/email-inbound`
- **Event:** `email.received`
- **Status:** Attivo

### Limiti Free Tier

- 100 email/giorno invio
- 3.000 email/mese invio
- Inbound illimitato

## Env Variables Richieste

```
RESEND_API_KEY=re_xxxxxxxxx   # Già presente
```

Nessuna nuova variabile d'ambiente necessaria.
