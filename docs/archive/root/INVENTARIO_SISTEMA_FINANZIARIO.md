# 📊 INVENTARIO SISTEMA FINANZIARIO - SpedireSicuro.it

**Data Analisi:** 2025-01  
**Repo:** gdsgroupsas-jpg/spediresicuro  
**Branch:** master

---

## 🔷 BLOCCO A: MIGRATIONS SUPABASE (Focus Finance)

| Migration                             | Descrizione                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `019_reseller_system_and_wallet.sql`  | Sistema wallet: tabella `wallet_transactions`, campo `wallet_balance` su `users`, funzioni `add_wallet_credit`/`deduct_wallet_credit`, RLS policies per reseller |
| `025_add_invoices_system.sql`         | Sistema fatturazione completo: tabelle `invoices` e `invoice_items`, trigger calcolo totali e generazione numero progressivo, RLS policies                       |
| `027_wallet_topups.sql`               | Pagamenti: tabelle `top_up_requests` (bonifici AI) e `payment_transactions` (XPay), bucket storage `receipts`, RLS policies                                      |
| `020_advanced_price_lists_system.sql` | Estende listini prezzi con margini default (`default_margin_percent`, `default_margin_fixed`), campo `price_list_id` su shipments                                |
| `001_complete_schema.sql`             | Schema base: tabelle `price_lists`, `price_list_entries`, `shipments` con campi `base_price`, `final_price`, `margin_percent`, `cost_price`                      |
| `023_diagnostics_events.sql`          | Tabella diagnostica/audit: `diagnostics_events` per logging eventi finanziari (opzionale)                                                                        |
| `013_security_audit_logs.sql`         | Tabella `audit_logs` per audit generale (non specifica finance ma rilevante)                                                                                     |

---

## 🔷 BLOCCO B: TABELLE/COLONNE FINANCE

### Tabelle Principali

#### 1. `invoices` (Fatture)

**Colonne principali:**

- `id`, `user_id`, `invoice_number`, `invoice_date`, `due_date`
- `status` (enum: draft, issued, paid, overdue, cancelled, refunded)
- `subtotal`, `tax_amount`, `total`, `currency`, `amount_paid`
- `recipient_name`, `recipient_vat_number`, `recipient_sdi_code`, `recipient_pec`, `recipient_address`, `recipient_city`, `recipient_province`, `recipient_zip`, `recipient_country`
- `pdf_url`, `notes`, `internal_notes`
- `created_by`, `created_at`, `updated_at`

#### 2. `invoice_items` (Righe Fattura)

**Colonne principali:**

- `id`, `invoice_id`, `shipment_id` (opzionale)
- `description`, `quantity`, `unit_price`, `tax_rate`, `total`
- `created_at`

#### 3. `wallet_transactions` (Transazioni Wallet)

**Colonne principali:**

- `id`, `user_id`, `amount` (positivo/negativo)
- `type` (deposit, feature_purchase, shipment_cost, admin_gift, refund, recharge_request, self_recharge, admin_deduction)
- `description`, `reference_id`, `reference_type`
- `created_by`, `created_at`

#### 4. `users` (Campo Wallet)

**Colonna finance:**

- `wallet_balance` (DECIMAL(10,2), DEFAULT 0, CHECK >= 0)

#### 5. `payment_transactions` (Transazioni Pagamento XPay/Bonifico)

**Colonne principali:**

- `id`, `user_id`
- `amount_credit`, `amount_fee`, `amount_total`
- `provider` (intesa, stripe, paypal)
- `provider_tx_id`, `status` (pending, authorized, success, failed, cancelled)
- `metadata` (JSONB), `created_at`, `updated_at`

#### 6. `top_up_requests` (Richieste Ricarica Bonifico)

**Colonne principali:**

- `id`, `user_id`, `amount`
- `file_url`, `extracted_data` (JSONB), `ai_confidence`
- `status` (pending, approved, rejected, manual_review)
- `admin_notes`, `created_at`, `updated_at`

#### 7. `price_lists` (Listini Prezzi)

**Colonne finance:**

- `id`, `courier_id`, `name`, `version`, `status`
- `valid_from`, `valid_until`
- `default_margin_percent`, `default_margin_fixed` (migration 020)

#### 8. `price_list_entries` (Righe Listino)

**Colonne finance:**

- `id`, `price_list_id`
- `base_price`, `fuel_surcharge_percent`, `island_surcharge`, `ztl_surcharge`, `cash_on_delivery_surcharge`, `insurance_rate_percent`

#### 9. `shipments` (Campi Finance)

**Colonne finance:**

- `base_price`, `final_price`, `margin_percent`, `cost_price`
- `cash_on_delivery`, `cod_status`
- `price_list_id` (migration 020, per audit)

#### 10. `diagnostics_events` (Audit/Diagnostica)

**Colonne rilevanti:**

- `id`, `type`, `severity`, `context` (JSONB), `user_id`, `created_at`

---

## 🔷 BLOCCO C: ENDPOINTS/ACTIONS TROVATI

### Server Actions - Fatture

| File                      | Funzione                | Cosa Fa                                                                 |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `app/actions/invoices.ts` | `createInvoice()`       | Crea bozza fattura con items, inserisce in `invoices` e `invoice_items` |
| `app/actions/invoices.ts` | `issueInvoice()`        | Emette fattura (draft → issued), trigger genera numero progressivo      |
| `app/actions/invoices.ts` | `updateInvoiceStatus()` | Aggiorna stato fattura (es. paid, overdue)                              |
| `app/actions/invoices.ts` | `getInvoices()`         | Recupera fatture per admin (con join users)                             |
| `app/actions/invoices.ts` | `getUserInvoices()`     | Recupera fatture dell'utente corrente                                   |
| `app/actions/invoices.ts` | `getInvoiceById()`      | Recupera singola fattura con items e dati utente                        |

### Server Actions - Wallet

| File                        | Funzione                      | Cosa Fa                                                                                                |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `app/actions/wallet.ts`     | `initiateCardRecharge()`      | Inizia ricarica XPay: calcola fee, crea `payment_transactions`, genera URL XPay                        |
| `app/actions/wallet.ts`     | `uploadBankTransferReceipt()` | Upload ricevuta bonifico: salva file in storage `receipts`, crea `top_up_requests`                     |
| `app/actions/wallet.ts`     | `rechargeMyWallet()`          | **DEPRECATA** - Ritorna errore, forzato uso nuovi metodi                                               |
| `actions/wallet.ts`         | `rechargeMyWallet()`          | Ricarica wallet utente corrente (admin diretta, user crea richiesta)                                   |
| `actions/wallet.ts`         | `getMyWalletTransactions()`   | Recupera transazioni wallet utente corrente                                                            |
| `actions/super-admin.ts`    | `manageWallet()`              | Gestione wallet (superadmin): aggiunge/rimuove credito, usa `add_wallet_credit`/`deduct_wallet_credit` |
| `actions/admin-reseller.ts` | `manageSubUserWallet()`       | Ricarica wallet sub-user (reseller): solo ricariche positive, usa `add_wallet_credit`                  |

### Server Actions - Fiscal/KPI

| File                       | Funzione                 | Cosa Fa                                                                           |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `app/actions/fiscal.ts`    | `getMyFiscalData()`      | Wrapper per `getFiscalContext()`, recupera dati fiscali utente                    |
| `lib/agent/fiscal-data.ts` | `getFiscalContext()`     | Costruisce contesto fiscale: spedizioni, COD, scadenze, aggregati margini/revenue |
| `lib/agent/fiscal-data.ts` | `getShipmentsByPeriod()` | Query spedizioni filtrata per ruolo (superadmin/reseller/user) con campi finance  |
| `lib/agent/fiscal-data.ts` | `getPendingCOD()`        | Recupera contrassegni non pagati filtrati per ruolo                               |
| `lib/agent/fiscal-data.ts` | `getFiscalDeadlines()`   | Calendario scadenze fiscali statiche (F24, LIPE, dichiarazioni)                   |

### Funzioni SQL (RPC)

| Funzione                    | File Migration                       | Cosa Fa                                                                                   |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `add_wallet_credit()`       | `019_reseller_system_and_wallet.sql` | Aggiunge credito: crea `wallet_transactions`, trigger aggiorna `wallet_balance`           |
| `deduct_wallet_credit()`    | `019_reseller_system_and_wallet.sql` | Scala credito: verifica balance, crea transazione negativa                                |
| `update_invoice_totals()`   | `025_add_invoices_system.sql`        | Trigger: ricalcola `subtotal`, `tax_amount`, `total` su `invoices` quando cambiano items  |
| `generate_invoice_number()` | `025_add_invoices_system.sql`        | Trigger: genera numero progressivo `YYYY-XXXX` quando status passa a `issued`             |
| `update_wallet_balance()`   | `019_reseller_system_and_wallet.sql` | Trigger: aggiorna `wallet_balance` su `users` quando viene inserita `wallet_transactions` |

### API Routes (NON TROVATE)

| Endpoint                   | Stato                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `/api/webhook/payment`     | **NON TROVATO**                                                                     |
| `/api/payment/callback`    | **NON TROVATO**                                                                     |
| `/api/wallet/transactions` | **TROVATO** (presumibilmente in `app/api/wallet/transactions/route.ts` - non letto) |

### Librerie Payment

| File                          | Classe/Funzione                     | Cosa Fa                                                     |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `lib/payments/intesa-xpay.ts` | `IntesaXPay.calculateFee()`         | Calcola commissione XPay (1.5% + 0.25€)                     |
| `lib/payments/intesa-xpay.ts` | `IntesaXPay.createPaymentSession()` | Genera URL e campi form per redirect XPay, calcola MAC SHA1 |

### Calcolo Margini/KPI

| File                              | Funzione                             | Cosa Fa                                                                        |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `lib/agent/orchestrator/nodes.ts` | `calculateMargins()`                 | Calcola margine percentuale su prezzo base (default 20%)                       |
| `lib/db/price-lists-advanced.ts`  | `calculatePriceWithRule()`           | Calcola prezzo con regole listino: base + surcharges + margine (percent/fixed) |
| `lib/ai/tools.ts`                 | Tool `analyze_financial_performance` | Analizza performance finanziaria: revenue, cost, margin, confronto periodi     |
| `lib/ai/pricing-engine.ts`        | `calculateOptimalPrice()`            | Calcola prezzi ottimali per corrieri con margine applicato                     |
| `lib/ai/anne-superadmin-tools.ts` | `anneGetDashboardKPIs()`             | Dashboard KPI superadmin: stats spedizioni, revenue mensile, conteggi          |

---

## 🔷 BLOCCO D: RLS POLICIES

### Tabella: `invoices`

| Policy                   | Ruolo                                 | Permesso                                                   |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------- |
| `invoices_select_policy` | `admin`, `superadmin`, `service_role` | SELECT: vedono tutto                                       |
| `invoices_select_policy` | `user`                                | SELECT: vedono solo proprie (`user_id = auth.uid()`)       |
| `invoices_select_policy` | `reseller`                            | SELECT: vedono fatture sub-users (via `is_reseller` check) |
| `invoices_modify_policy` | `admin`, `superadmin`, `service_role` | INSERT/UPDATE/DELETE: solo admin/system                    |

### Tabella: `invoice_items`

| Policy                        | Ruolo                       | Permesso                                     |
| ----------------------------- | --------------------------- | -------------------------------------------- |
| `invoice_items_select_policy` | Stessa logica di `invoices` | SELECT: basato su accesso alla fattura padre |

### Tabella: `wallet_transactions`

| Policy                       | Ruolo          | Permesso                                                    |
| ---------------------------- | -------------- | ----------------------------------------------------------- |
| `wallet_transactions_select` | `superadmin`   | SELECT: vedono tutto                                        |
| `wallet_transactions_select` | `user`         | SELECT: vedono solo proprie (`user_id = auth.uid()`)        |
| `wallet_transactions_select` | `reseller`     | SELECT: vedono transazioni sub-users (via `is_sub_user_of`) |
| `wallet_transactions_insert` | `service_role` | INSERT: solo server actions (bypass RLS)                    |

### Tabella: `payment_transactions`

| Policy                                    | Ruolo  | Permesso                                      |
| ----------------------------------------- | ------ | --------------------------------------------- |
| `Users can view own payment transactions` | `user` | SELECT: solo proprie (`auth.uid() = user_id`) |

### Tabella: `top_up_requests`

| Policy                               | Ruolo  | Permesso                                      |
| ------------------------------------ | ------ | --------------------------------------------- |
| `Users can view own top-up requests` | `user` | SELECT: solo proprie (`auth.uid() = user_id`) |
| `Users can create top-up requests`   | `user` | INSERT: solo proprie (`auth.uid() = user_id`) |

### Tabella: `diagnostics_events`

| Policy                             | Ruolo | Permesso                                       |
| ---------------------------------- | ----- | ---------------------------------------------- |
| `diagnostics_events_select_public` | Tutti | SELECT: lettura pubblica (per dashboard admin) |

### Storage: `receipts` (bucket)

| Policy                        | Ruolo  | Permesso                                                   |
| ----------------------------- | ------ | ---------------------------------------------------------- |
| `Users can upload receipts`   | `user` | INSERT: solo nella propria cartella (`auth.uid() = owner`) |
| `Users can read own receipts` | `user` | SELECT: solo propri file (`auth.uid() = owner`)            |

---

## 🔷 BLOCCO E: TODO "BUCHI" (Max 10)

| #   | Descrizione                                                  | Severità | Dettagli                                                                                                                                                            |
| --- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Webhook XPay mancante**                                    | **HIGH** | Nessun endpoint `/api/webhook/payment` o `/api/payment/callback` trovato. XPay richiede callback per aggiornare `payment_transactions.status` e accreditare wallet. |
| 2   | **Analisi AI bonifici non implementata**                     | **HIGH** | `uploadBankTransferReceipt()` crea `top_up_requests` ma non chiama analisi AI (Gemini Vision). Campo `ai_confidence` resta 0, `extracted_data` vuoto.               |
| 3   | **Approvazione automatica bonifici mancante**                | **MED**  | Nessuna logica per approvare automaticamente `top_up_requests` con `ai_confidence > threshold`. Admin deve approvare manualmente.                                   |
| 4   | **Collegamento invoice-payment mancante**                    | **MED**  | Nessuna tabella `payments` o foreign key da `invoices` a `payment_transactions`. Impossibile tracciare quale pagamento ha saldato quale fattura.                    |
| 5   | **Trigger aggiornamento `amount_paid` su invoices mancante** | **MED**  | Campo `amount_paid` su `invoices` non viene aggiornato automaticamente quando viene registrato un pagamento.                                                        |
| 6   | **PDF fatture non generato**                                 | **MED**  | Campo `pdf_url` su `invoices` esiste ma nessuna funzione/server action per generare PDF fattura.                                                                    |
| 7   | **Calcolo margini su spedizioni inconsistente**              | **LOW**  | `calculateMargins()` usa margine fisso 20%, mentre `price-lists-advanced.ts` usa margini da listino. Potenziale inconsistenza.                                      |
| 8   | **RLS policy per admin su `top_up_requests` mancante**       | **MED**  | Admin non può vedere/approvare `top_up_requests` via RLS. Devono usare `service_role` bypass.                                                                       |
| 9   | **Dashboard finanza usa dati mock**                          | **LOW**  | `app/dashboard/finanza/page.tsx` carica dati reali ma alcuni KPI (projection, roi, tax_risk) sono ancora mock/hardcoded.                                            |
| 10  | **Nessun report export fatture**                             | **LOW**  | Nessuna funzione per esportare fatture in CSV/Excel o generare report periodici per contabilità.                                                                    |

---

## 📝 NOTE FINALI

- **Sistema Wallet:** Funzionale con ricariche XPay e bonifici (parziale). Manca webhook per completare ciclo XPay.
- **Sistema Fatturazione:** Struttura completa ma manca generazione PDF e collegamento pagamenti.
- **KPI/Finance Dashboard:** Parzialmente implementato, alcuni dati mock.
- **RLS:** Implementato correttamente per invoices/wallet, manca per `top_up_requests` (admin access).

---

**Fine Report**
