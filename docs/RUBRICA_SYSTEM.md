# Rubrica — Sistema Contatti

**Data:** 31 Gennaio 2026
**Status:** Attivo
**Accesso:** Solo Superadmin

---

## Panoramica

Sezione "Rubrica" nel dashboard per la gestione dei contatti aziendali. Integrata con la sezione Posta per autocomplete dei destinatari.

## Architettura

```
CRUD:
  UI /dashboard/rubrica → API /api/contacts → Supabase contacts table (RLS superadmin)

Autocomplete (Posta):
  Composer campo "A"/"CC" → GET /api/contacts/search?q=... → dropdown suggerimenti
```

## Database — Tabella `contacts`

| Campo      | Tipo   | Note                                      |
| ---------- | ------ | ----------------------------------------- |
| id         | UUID   | PK                                        |
| first_name | TEXT   | Obbligatorio, max 100 char                |
| last_name  | TEXT   | Obbligatorio, max 100 char                |
| email      | TEXT   | Obbligatorio, validato regex, unique (CI) |
| phone      | TEXT   | Opzionale, validato regex                 |
| company    | TEXT   | Opzionale, max 200 char                   |
| tags       | TEXT[] | Array tag, max 20 tag da 50 char          |
| notes      | TEXT   | Opzionale, max 2000 char                  |
| created_by | UUID   | FK auth.users, chi ha creato il contatto  |

**Sicurezza:**

- RLS: Solo `account_type = 'superadmin'` ha accesso
- CHECK constraints su tutti i campi (lunghezza, formato email, formato telefono)
- Unique index case-insensitive su email (`LOWER(email)`)
- Input sanitizzato server-side (trim, max length, regex validation)
- UUID validation su parametri path

**Performance:**

- GIN index per full-text search (nome, cognome, email, azienda)
- GIN index su tags per filtro
- B-tree index su last_name, company, created_at, created_by

**Migration:** `supabase/migrations/20260131140000_create_contacts_table.sql`

## API Routes

| Metodo | Endpoint                     | Descrizione                             |
| ------ | ---------------------------- | --------------------------------------- |
| GET    | `/api/contacts?search=&tag=` | Lista contatti con filtri e paginazione |
| POST   | `/api/contacts`              | Crea nuovo contatto                     |
| GET    | `/api/contacts/[id]`         | Dettaglio contatto                      |
| PATCH  | `/api/contacts/[id]`         | Aggiorna contatto (partial update)      |
| DELETE | `/api/contacts/[id]`         | Elimina contatto                        |
| GET    | `/api/contacts/search?q=`    | Autocomplete (lightweight, max 10)      |

Tutte le route richiedono autenticazione superadmin.

**Validazione server-side:**

- Email: regex RFC-like
- Telefono: regex internazionale
- Lunghezza campi: enforced sia DB (CHECK) che API (sanitize)
- Duplicate email: errore 409 con messaggio chiaro
- UUID path params: validati con regex

## UI — `/dashboard/rubrica`

- Tabella desktop con colonne: Nome, Email, Telefono, Azienda, Tag, Azioni
- Cards mobile responsive
- Ricerca con debounce 300ms
- Filtro per tag (click su badge)
- Dialog modale per creazione/modifica con validazione
- Conferma eliminazione con AlertDialog
- Esportazione CSV con BOM UTF-8
- Paginazione "Carica altri" (50 per pagina)
- Empty state contestuale

## Integrazione Posta

Il composer email in `/dashboard/posta` ha autocomplete sui campi "A" e "CC":

- Cerca contatti dopo 2+ caratteri (debounce 200ms)
- Mostra nome + email nel dropdown
- Supporta indirizzi multipli separati da virgola
- Cerca sull'ultimo segmento dopo l'ultima virgola

## Navigazione

Voce "Rubrica" nella sezione "Comunicazioni" della sidebar, visibile solo a superadmin, sotto "Posta".
