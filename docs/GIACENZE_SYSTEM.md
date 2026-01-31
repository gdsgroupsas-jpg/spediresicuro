# Sistema Gestione Giacenze

## Panoramica

Le giacenze sono spedizioni bloccate presso i corrieri (destinatario assente, indirizzo errato, rifiutata, etc.). Il sistema le rileva automaticamente dal tracking, crea un record, e permette al cliente di scegliere un'azione di svincolo con addebito wallet trasparente.

## Architettura

### Database

- **Tabella `shipment_holds`**: lifecycle completo della giacenza (open → action_confirmed → resolved/expired)
- **Trigger `auto_create_shipment_hold`**: crea automaticamente un hold quando un `tracking_event` ha `status_normalized = 'in_giacenza'`
- **Trigger `auto_resolve_shipment_hold`**: chiude automaticamente un hold quando il tracking passa a `delivered`, `returned`, o `cancelled`
- **Funzione `expire_overdue_shipment_holds()`**: marca come expired i hold con deadline superata (chiamata da cron)

### Tracking Normalization

Pattern che mappano a `in_giacenza`:

- "giacenza", "in giacenza", "fermo deposito", "in deposito"
- "mancata consegna", "tentativo fallito", "non consegnabile"
- "destinatario assente" (ora mappa a giacenza, non più a exception)

Sia in TypeScript (`lib/services/tracking/tracking-service.ts`) che in SQL (`normalize_tracking_status()`).

### Pricing

I costi giacenza sono definiti per corriere nel `storage_config` di `supplier_price_list_configs`:

- **Formato chiave**: `{ riconsegna: { fixed, percent }, reso_mittente: { fixed, percent }, ... }`
- **Formato array**: `{ services: [...], dossier_opening_cost: N }`
- **Calcolo**: `costo_fisso + (percentuale × costo_spedizione / 100) + apertura_dossier`

### Azioni disponibili

| Azione                          | Descrizione                      |
| ------------------------------- | -------------------------------- |
| `riconsegna`                    | Nuovo tentativo stesso indirizzo |
| `riconsegna_nuovo_destinatario` | Consegna a indirizzo diverso     |
| `reso_mittente`                 | Restituzione al mittente         |
| `distruggere`                   | Distruzione della merce          |
| `ritiro_in_sede`                | Ritiro presso filiale corriere   |
| `consegna_parziale_rendi`       | Consegna parziale + reso         |
| `consegna_parziale_distruggi`   | Consegna parziale + distruzione  |

## API Routes

| Endpoint                     | Metodo | Descrizione                                |
| ---------------------------- | ------ | ------------------------------------------ |
| `/api/giacenze`              | GET    | Lista giacenze con filtri (status, search) |
| `/api/giacenze/[id]`         | GET    | Dettaglio singola giacenza                 |
| `/api/giacenze/[id]/actions` | GET    | Azioni disponibili con costi calcolati     |
| `/api/giacenze/[id]/actions` | POST   | Esegui azione con addebito wallet          |
| `/api/giacenze/stats`        | GET    | Conteggio giacenze aperte (per badge)      |
| `/api/cron/expire-holds`     | POST   | Cron: scadenza hold con deadline superata  |

## Flusso Operativo

```
1. Cron sync-tracking rileva stato "in giacenza" dal corriere
2. Trigger DB crea automaticamente record in shipment_holds
3. Badge rosso appare nel menu navigazione
4. Cliente apre /dashboard/giacenze
5. Vede lista giacenze con countdown giorni rimasti
6. Clicca "Gestisci" → vede azioni con costi dal listino
7. Sceglie azione → conferma → wallet addebitato
8. Hold passa a "action_confirmed"
9. Se tracking aggiorna a "delivered" → hold auto-risolta
```

## Sicurezza

- Le operazioni giacenza richiedono SEMPRE conferma umana (mai auto-proceed)
- Addebito wallet con idempotency key (previene doppie transazioni)
- RLS: utente vede solo le proprie giacenze
- Cron endpoint protetto da CRON_SECRET

## File Principali

- `supabase/migrations/20260201120000_shipment_holds.sql`
- `supabase/migrations/20260201130000_shipment_holds_auto_resolve.sql`
- `types/giacenze.ts`
- `lib/services/giacenze/giacenze-service.ts`
- `app/api/giacenze/` (4 route files)
- `app/api/cron/expire-holds/route.ts`
- `app/dashboard/giacenze/page.tsx`
- `hooks/useGiacenzeCount.ts`
