# 🧪 PROMPT TESTING MANUALE - SUPERADMIN

## 🎯 OBIETTIVO

Eseguire test manuali completi per **Sprint 1, 2, 3** partendo dalla dashboard SuperAdmin con login già effettuato.

---

## ⚠️ REGOLE CRITICHE

### 1. **CREAZIONE SPEDIZIONI PER TEST**

- ✅ **PUOI** creare spedizioni reali durante i test (serve per testare il sistema)
- ✅ **OBBLIGATORIO:** Dopo ogni creazione spedizione, **CANCELLALA IMMEDIATAMENTE**
- ✅ **PROCEDURA CANCELLAZIONE:**
  1. Vai su `/dashboard/spedizioni`
  2. Trova la spedizione appena creata (usa filtro per tracking number o data)
  3. Clicca su "Cancella" o "Elimina"
  4. Conferma la cancellazione
  5. Verifica che la spedizione sia stata cancellata
- ⚠️ **SE LA CANCELLAZIONE NON FUNZIONA:** Segnala nel report, ma NON è bloccante (ci penserà l'utente)

### 2. **LOGIN PRECONFIGURATO**

- **Email:** `admin@spediresicuro.it`
- **Password:** `admin123`
- **Ruolo:** SuperAdmin
- ✅ Parti sempre dalla dashboard già loggato

### 3. **GESTIONE ERRORI**

- Se trovi un errore che **blocca il proseguimento**, **FERMATI IMMEDIATAMENTE**
- Segnala l'errore con:
  - Screenshot
  - Messaggio errore completo
  - Step che stavi eseguendo
  - Browser console errors (se presenti)

---

## 📋 CHECKLIST TEST - SUPERADMIN

### ✅ PRE-REQUISITI

- [ ] Login effettuato come `admin@spediresicuro.it`
- [ ] Verificato ruolo SuperAdmin (dovresti vedere sezione "Finanza Piattaforma" nel menu)
- [ ] Browser console aperta (F12) per vedere eventuali errori
- [ ] Network tab aperto per monitorare chiamate API

---

### 🧪 TEST 1: Financial Dashboard

**Obiettivo:** Verificare che la Financial Dashboard funzioni correttamente

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/super-admin/financial`
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**

2. **Stats Cards:**
   - [ ] Verifica che le 8 card statistiche siano visibili:
     - Spedizioni Totali
     - Ricavi Totali
     - Costi Provider
     - Margine Lordo
     - Margine Medio
     - Da Riconciliare
     - Margini Negativi
     - Ultimi 30 Giorni
   - [ ] Verifica che i valori siano numeri (non "NaN" o "undefined")
   - [ ] Se i valori sono 0, è OK (potrebbe non esserci ancora dati)

3. **Period Selector:**
   - [ ] Clicca sul dropdown "Period Selector"
   - [ ] Verifica che ci siano 5 opzioni:
     - Ultimi 7 giorni
     - Ultimi 30 giorni
     - Ultimi 90 giorni
     - Da inizio anno
     - Tutto il periodo
   - [ ] Seleziona ogni opzione e verifica che i dati si aggiornino
   - [ ] Controlla che non ci siano errori in console

4. **Export CSV:**
   - [ ] Clicca sul pulsante "Export CSV"
   - [ ] Verifica che si scarichi un file CSV
   - [ ] Apri il CSV e verifica che abbia colonne corrette:
     - Data, Tracking, Corriere, Email Cliente, Importo Addebitato, Costo Provider, Margine, Margine %, Stato Riconciliazione, Fonte Costo

5. **Tab Analytics:**
   - [ ] Clicca sul tab "Analytics"
   - [ ] Verifica che ci siano:
     - Grafico "Margini per Corriere" (se ci sono dati)
     - Tabella "Top Resellers" (se ci sono dati)
   - [ ] Se non ci sono dati, verifica che ci sia un messaggio "Nessun dato disponibile" (non errore)

**✅ CRITERIO DI SUCCESSO:**

- Tutte le sezioni caricano senza errori
- I dati sono visualizzati correttamente (anche se 0)
- Nessun errore in console browser

**❌ SE TROVI ERRORI:**

- FERMATI IMMEDIATAMENTE
- Fai screenshot
- Copia messaggio errore completo
- Segnala quale step ha fallito

---

### 🧪 TEST 2: Riconciliazione Table

**Obiettivo:** Verificare che la tabella di riconciliazione funzioni

**Steps:**

1. **Tab Riconciliazione:**
   - [ ] Clicca sul tab "Riconciliazione"
   - [ ] Verifica che la tabella sia visibile
   - [ ] Se ci sono dati, verifica colonne:
     - Tracking, Cliente, Billed, Costo, Margine, Stato, Azioni
   - [ ] Se non ci sono dati, verifica messaggio "Nessun dato disponibile"

2. **Filtri (se presenti):**
   - [ ] Verifica che i filtri funzionino (se presenti)
   - [ ] Testa filtro per stato (pending, matched, discrepancy)

3. **Azioni (se presenti dati):**
   - [ ] Se ci sono spedizioni con stato "pending", verifica che ci sia un pulsante "Riconcilia"
   - [ ] Puoi testare il pulsante "Riconcilia" (non crea chiamate API esterne, solo aggiorna stato)

**✅ CRITERIO DI SUCCESSO:**

- Tabella carica senza errori
- Dati visualizzati correttamente (anche se vuota)
- Nessun errore in console

---

### 🧪 TEST 3: Alerts Table

**Obiettivo:** Verificare che la tabella alert funzioni

**Steps:**

1. **Tab Alert:**
   - [ ] Clicca sul tab "Alert"
   - [ ] Verifica che la tabella sia visibile
   - [ ] Se ci sono alert, verifica colonne:
     - Data, Tipo, Severità, Messaggio, Tracking
   - [ ] Se non ci sono alert, verifica messaggio "Nessun alert"

2. **Severità:**
   - [ ] Se ci sono alert, verifica che le severità siano colorate correttamente:
     - Critical = rosso
     - Warning = giallo
     - Info = blu

**✅ CRITERIO DI SUCCESSO:**

- Tabella carica senza errori
- Alert visualizzati correttamente (anche se vuota)
- Nessun errore in console

---

### 🧪 TEST 4: Navigation e Quick Actions

**Obiettivo:** Verificare che la navigazione funzioni

**Steps:**

1. **Menu Navigazione:**
   - [ ] Verifica che nel menu laterale ci sia la sezione "Finanza Piattaforma"
   - [ ] Verifica che ci sia la voce "Financial Dashboard"
   - [ ] Clicca su "Financial Dashboard" → deve portare a `/dashboard/super-admin/financial`
   - [ ] Verifica che "Listini" sia in Amministrazione → porta a `/dashboard/listini`
   - [ ] Su `/dashboard/listini` verifica tab "Listini Master" (solo superadmin)

2. **Quick Actions (SuperAdmin Dashboard):**
   - [ ] Vai su `/dashboard/super-admin`
   - [ ] Verifica che ci siano 3 card "Quick Actions":
     - Financial Dashboard (verde)
     - Listini Master (blu)
     - Analytics (grigio, disabled)
   - [ ] Clicca su "Financial Dashboard" → deve portare alla financial dashboard
   - [ ] Clicca su "Listini Master" → deve portare ai listini master

**✅ CRITERIO DI SUCCESSO:**

- Tutti i link funzionano
- Navigazione fluida
- Nessun errore 404

---

### 🧪 TEST 5: Creazione Spedizione e Financial Tracking

**Obiettivo:** Verificare che il sistema tracci correttamente i costi quando si crea una spedizione

**Steps:**

1. **Preparazione:**
   - [ ] Vai su `/dashboard/spedizioni`
   - [ ] Clicca su "Nuova Spedizione" o "Crea Spedizione"
   - [ ] Prepara dati di test (usa indirizzi reali ma destinatario di test)

2. **Creazione Spedizione:**
   - [ ] Compila il form di creazione spedizione:
     - Mittente: usa dati validi
     - Destinatario: usa dati validi (puoi usare indirizzo di test)
     - Peso: 1-5 kg (valore normale)
     - Corriere: scegli un corriere disponibile
   - [ ] **IMPORTANTE:** Usa un tracking number di test o lascia che il sistema lo generi
   - [ ] Completa la creazione spedizione
   - [ ] **NOTA:** Annota il tracking number o ID spedizione per cancellarla dopo

3. **Verifica Financial Tracking:**
   - [ ] Vai su `/dashboard/super-admin/financial`
   - [ ] Verifica che la nuova spedizione appaia nei dati:
     - Controlla "Spedizioni Totali" (dovrebbe aumentare di 1)
     - Controlla "Ultimi 30 Giorni" (dovrebbe aumentare di 1)
   - [ ] Se la spedizione usa contratti piattaforma, verifica:
     - Tab "Riconciliazione": dovrebbe apparire una nuova riga
     - Stato dovrebbe essere "pending"
   - [ ] Se non appare subito, aspetta 2-3 secondi e ricarica la pagina

4. **CANCELLAZIONE SPEDIZIONE (OBBLIGATORIO):**
   - [ ] Torna su `/dashboard/spedizioni`
   - [ ] Trova la spedizione appena creata (usa il tracking number annotato o filtro per data)
   - [ ] Clicca su "Cancella" o "Elimina" o icona cestino
   - [ ] Conferma la cancellazione
   - [ ] Verifica che la spedizione sia stata cancellata (non deve più apparire nella lista)
   - [ ] **SE LA CANCELLAZIONE NON FUNZIONA:**
     - Segnala nel report finale
     - Annota tracking number o ID spedizione
     - **NON è bloccante** - l'utente ci penserà

**✅ CRITERIO DI SUCCESSO:**

- Spedizione creata con successo
- Financial tracking funziona (dati aggiornati)
- Spedizione cancellata con successo (o segnalata se non funziona)

**❌ SE TROVI ERRORI:**

- Se la creazione fallisce: FERMATI e segnala
- Se il tracking non funziona: segnala ma continua
- Se la cancellazione non funziona: segnala ma NON è bloccante

---

### 🧪 TEST 6: Security - RPC Permissions (READ-ONLY)

**Obiettivo:** Verificare che le funzioni RPC siano protette (solo verifica, NO modifiche)

**Steps:**

1. **Apri Supabase SQL Editor:**
   - [ ] Vai su Supabase Dashboard → SQL Editor
   - [ ] **IMPORTANTE:** Assicurati di essere loggato come utente normale (NON service_role)

2. **Test Permission Denied (dovrebbe FALLIRE):**
   - [ ] Esegui questa query (dovrebbe dare errore "permission denied"):

   ```sql
   SELECT record_platform_provider_cost(
     '00000000-0000-0000-0000-000000000000'::UUID,
     'TEST123',
     '00000000-0000-0000-0000-000000000000'::UUID,
     100.00,
     50.00,
     'platform',
     'brt',
     'standard',
     NULL,
     NULL,
     'estimate'
   );
   ```

   - [ ] **ATTESO:** Errore "permission denied" o "insufficient privileges"
   - [ ] **SE FUNZIONA:** ⚠️ **VULNERABILITÀ!** Segnala immediatamente

3. **Verifica Permessi (Query Read-Only):**
   - [ ] Esegui questa query per verificare i permessi:

   ```sql
   SELECT
     routine_name,
     grantee,
     privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name IN (
       'record_platform_provider_cost',
       'log_financial_event',
       'log_wallet_operation'
     )
     AND grantee = 'PUBLIC';
   ```

   - [ ] **ATTESO:** 0 righe (nessun permesso PUBLIC)
   - [ ] **SE CI SONO RIGHE:** ⚠️ **VULNERABILITÀ!** Segnala immediatamente

**✅ CRITERIO DI SUCCESSO:**

- Le chiamate RPC falliscono con "permission denied"
- Query di verifica mostra 0 permessi PUBLIC
- Nessuna vulnerabilità rilevata

**❌ SE TROVI VULNERABILITÀ:**

- FERMATI IMMEDIATAMENTE
- Fai screenshot
- Segnala che la Migration 095 non è stata applicata correttamente

---

## 📊 REPORT FINALE

Al termine dei test, compila questo report:

### ✅ Test Completati

- [ ] Test 1: Financial Dashboard
- [ ] Test 2: Riconciliazione Table
- [ ] Test 3: Alerts Table
- [ ] Test 4: Navigation e Quick Actions
- [ ] Test 5: Creazione Spedizione e Financial Tracking
- [ ] Test 6: Security - RPC Permissions

### ❌ Errori Trovati

- [ ] Nessun errore
- [ ] Errori trovati (descrivi sotto)

### 📝 Note

- **Errori critici (bloccanti):** [Descrivi se presenti]
- **Errori minori (non bloccanti):** [Descrivi se presenti]
- **Spedizioni non cancellate:** [Lista tracking number o ID se la cancellazione non ha funzionato]
- **Suggerimenti:** [Eventuali miglioramenti]

---

## 🚨 PROCEDURA IN CASO DI ERRORE

### Se trovi un errore che BLOCCA il proseguimento:

1. **FERMATI IMMEDIATAMENTE**
2. **Fai screenshot** dell'errore
3. **Copia messaggio errore completo** (dalla console browser o dalla pagina)
4. **Segnala:**
   - Quale test stavi eseguendo
   - Quale step ha fallito
   - Screenshot dell'errore
   - Messaggio errore completo
   - Browser e versione usata
5. **NON PROSEGUIRE** fino a che l'errore non è stato risolto

### Se trovi un errore NON bloccante:

1. **Continua** con gli altri test
2. **Segnala** l'errore nel report finale
3. **Descrivi** l'impatto (es. "funzionalità X non funziona ma non blocca il resto")

---

## ✅ DEFINITION OF DONE

I test sono completati con successo se:

- ✅ Tutti i 6 test sono stati eseguiti
- ✅ Nessun errore critico (bloccante) trovato
- ✅ Tutte le funzionalità principali funzionano
- ✅ Security test conferma che le RPC sono protette
- ✅ Report finale compilato

---

## 🎯 PROSSIMI STEP (DOPO SUPERADMIN)

Una volta completati i test SuperAdmin:

1. ✅ Report SuperAdmin completato
2. ⏳ Test Reseller (da fare dopo)
3. ⏳ Test BYOC (da fare dopo)

---

**IMPORTANTE:** Questo prompt è per test **SUPERADMIN SOLO**. Non testare funzionalità Reseller o BYOC in questa fase.
