# 🧪 PROMPT TESTING MANUALE - RESELLER

## 🎯 OBIETTIVO

Eseguire test manuali completi per **Sprint 1, 2, 3** partendo dalla dashboard Reseller con login già effettuato.

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

- **Email:** `testspediresicuro+postaexpress@gmail.com`
- **Password:** `Striano1382-`
- **Ruolo:** Reseller
- ✅ Parti sempre dalla dashboard già loggato

### 3. **GESTIONE ERRORI**

- Se trovi un errore che **blocca il proseguimento**, **FERMATI IMMEDIATAMENTE**
- Segnala l'errore con:
  - Screenshot
  - Messaggio errore completo
  - Step che stavi eseguendo
  - Browser console errors (se presenti)

### 4. **VERIFICA CONFIGURAZIONI API CORRIERE**

- ⚠️ **IMPORTANTE:** Prima di procedere con i test, verifica visivamente che le configurazioni API corriere siano presenti
- Se **VEDI** le configurazioni → **PROCEDI** con i test
- Se **NON VEDI** le configurazioni → **SEGNALA** nel report ma **NON BLOCCARE** (potrebbero essere configurate a livello superadmin)

---

## 📋 CHECKLIST TEST - RESELLER

### ✅ PRE-REQUISITI

- [ ] Login effettuato come `testspediresicuro+postaexpress@gmail.com`
- [ ] Verificato ruolo Reseller (dovresti vedere sezione "Reseller" nel menu)
- [ ] Browser console aperta (F12) per vedere eventuali errori
- [ ] Network tab aperto per monitorare chiamate API
- [ ] Dashboard principale caricata senza errori

---

### 🔍 TEST 0: Verifica Configurazioni API Corriere (CONTROLLO VISIVO)

**Obiettivo:** Verificare che le configurazioni API corriere siano visibili e operative

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/integrazioni`
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**

2. **Controllo Visivo Configurazioni:**
   - [ ] Verifica presenza di sezioni per configurazione corrieri:
     - [ ] Spedisci.Online (se presente)
     - [ ] Poste Italiane (se presente)
     - [ ] Altri corrieri configurati
   - [ ] Se vedi configurazioni esistenti:
     - [ ] Verifica che siano marcate come "Attive" o "Configurate"
     - [ ] Annota quali corrieri sono configurati
   - [ ] Se NON vedi configurazioni:
     - [ ] Segnala nel report: "Configurazioni API non visibili"
     - [ ] **NON BLOCCARE** - potrebbe essere normale se configurate a livello superadmin
     - [ ] Procedi con gli altri test

3. **Stato Configurazioni:**
   - [ ] Se ci sono badge o indicatori di stato, verifica:
     - [ ] "Attivo" / "Configurato" = verde
     - [ ] "Errore" / "Non configurato" = rosso/giallo
   - [ ] Annota lo stato nel report

**✅ CRITERIO DI SUCCESSO:**

- Pagina integrazioni carica senza errori
- Configurazioni visibili (o segnalato se non presenti)
- Nessun errore in console browser

**📝 NOTA NEL REPORT:**

- [ ] Configurazioni API: ✅ Visibili / ❌ Non visibili
- [ ] Corrieri configurati: [Lista corrieri se visibili]
- [ ] Stato: [Attivo/Errore/Non configurato]

---

### 🧪 TEST 1: Dashboard Clienti Reseller (Sprint 2)

**Obiettivo:** Verificare che la Dashboard Unificata Clienti funzioni correttamente

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/reseller/clienti`
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**

2. **Client Stats Cards:**
   - [ ] Verifica che le 4 card statistiche siano visibili:
     - [ ] Totale Clienti
     - [ ] Saldo Totale Wallet
     - [ ] Con Listino Assegnato
     - [ ] Spedizioni Totali
   - [ ] Verifica che i valori siano numeri (non "NaN" o "undefined")
   - [ ] Se i valori sono 0, è OK (potrebbe non esserci ancora clienti)

3. **Lista Clienti:**
   - [ ] Verifica che la lista clienti sia visibile
   - [ ] Se ci sono clienti, verifica:
     - [ ] Badge listino inline per ogni cliente
     - [ ] Wallet balance visibile
     - [ ] Numero spedizioni visibile
     - [ ] Fatturato totale visibile
   - [ ] Se non ci sono clienti, verifica messaggio "Nessun cliente" (non errore)

4. **Filtri e Ordinamento:**
   - [ ] Testa filtro per nome/email (campo di ricerca)
   - [ ] Testa filtro "Con/Senza listino" (dropdown)
   - [ ] Testa ordinamento per:
     - [ ] Data creazione
     - [ ] Nome
     - [ ] Saldo wallet
     - [ ] Numero spedizioni

5. **Assegnazione Listino:**
   - [ ] Se ci sono clienti, clicca su badge listino di un cliente
   - [ ] Verifica che si apra il dialog "Assegna Listino"
   - [ ] Verifica che mostri listini disponibili
   - [ ] Se non ci sono listini, verifica messaggio appropriato
   - [ ] Puoi chiudere il dialog senza assegnare (test UI)

6. **Azioni Rapide:**
   - [ ] Verifica menu dropdown (3 puntini) su ogni cliente
   - [ ] Verifica opzioni:
     - [ ] Ricarica Wallet
     - [ ] Vedi Spedizioni
     - [ ] Cambia Listino / Assegna Listino
     - [ ] Dettagli Cliente

**✅ CRITERIO DI SUCCESSO:**

- Tutte le sezioni caricano senza errori
- I dati sono visualizzati correttamente (anche se 0)
- Filtri e ordinamento funzionano
- Nessun errore in console browser

**❌ SE TROVI ERRORI:**

- FERMATI IMMEDIATAMENTE
- Fai screenshot
- Copia messaggio errore completo
- Segnala quale step ha fallito

---

### 🧪 TEST 2: Creazione Spedizione e Financial Tracking

**Obiettivo:** Verificare che il sistema tracci correttamente i costi quando si crea una spedizione

**Steps:**

1. **Preparazione:**
   - [ ] Vai su `/dashboard/spedizioni`
   - [ ] Clicca su "Nuova Spedizione" o "Crea Spedizione"
   - [ ] Prepara dati di test (usa indirizzi reali ma destinatario di test)

2. **Creazione Spedizione:**
   - [ ] Compila il form di creazione spedizione:
     - [ ] Mittente: usa dati validi
     - [ ] Destinatario: usa dati validi (puoi usare indirizzo di test)
     - [ ] Peso: 1-5 kg (valore normale)
     - [ ] Corriere: scegli un corriere disponibile
   - [ ] **IMPORTANTE:** Usa un tracking number di test o lascia che il sistema lo generi
   - [ ] Completa la creazione spedizione
   - [ ] **NOTA:** Annota il tracking number o ID spedizione per cancellarla dopo

3. **Verifica Creazione:**
   - [ ] Verifica che la spedizione sia stata creata con successo
   - [ ] Verifica che appaia nella lista spedizioni
   - [ ] Controlla che il tracking number sia presente

4. **Verifica Financial Tracking (se applicabile):**
   - [ ] Se la spedizione usa contratti piattaforma, verifica:
     - [ ] Campo `api_source` popolato (verifica via SQL se possibile, altrimenti segnala)
     - [ ] Record creato in `platform_provider_costs` (verifica via SQL se possibile)
   - [ ] Se non puoi verificare via SQL, segnala nel report: "Financial tracking non verificabile via UI"

5. **CANCELLAZIONE SPEDIZIONE (OBBLIGATORIO):**
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
- Financial tracking funziona (o segnalato se non verificabile)
- Spedizione cancellata con successo (o segnalata se non funziona)

**❌ SE TROVI ERRORI:**

- Se la creazione fallisce: FERMATI e segnala
- Se il tracking non funziona: segnala ma continua
- Se la cancellazione non funziona: segnala ma NON è bloccante

---

### 🧪 TEST 3: Listini Fornitore

**Obiettivo:** Verificare che la gestione listini fornitore funzioni

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/reseller/listini` (tab "Listini Fornitore")
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**
   - [ ] Verifica redirect: `/dashboard/reseller/listini-fornitore` → `/dashboard/reseller/listini?tab=fornitore`

2. **Lista Listini:**
   - [ ] Verifica che la lista listini sia visibile
   - [ ] Se ci sono listini, verifica colonne:
     - [ ] Nome listino
     - [ ] Corriere
     - [ ] Stato (draft/active/archived)
     - [ ] Data creazione
     - [ ] Azioni (modifica/elimina)
   - [ ] Se non ci sono listini, verifica messaggio "Nessun listino" (non errore)

3. **Creazione Listino (se possibile):**
   - [ ] Clicca su "Crea Listino" o "Nuovo Listino"
   - [ ] Verifica che si apra il form
   - [ ] Compila i campi base (nome, corriere)
   - [ ] **NOTA:** Non è necessario completare la creazione, solo verificare che il form funzioni
   - [ ] Puoi chiudere senza salvare (test UI)

4. **Filtri e Ricerca:**
   - [ ] Testa campo di ricerca (se presente)
   - [ ] Testa filtro per stato (se presente)
   - [ ] Testa filtro per corriere (se presente)

**✅ CRITERIO DI SUCCESSO:**

- Pagina carica senza errori
- Lista listini visualizzata correttamente (anche se vuota)
- Form creazione funziona (se testato)
- Nessun errore in console

---

### 🧪 TEST 4: Listini Personalizzati

**Obiettivo:** Verificare che la gestione listini personalizzati funzioni

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/reseller/listini` e clicca tab "Listini Personalizzati"
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**
   - [ ] Verifica redirect: `/dashboard/reseller/listini-personalizzati` → `/dashboard/reseller/listini?tab=personalizzati`

2. **Lista Listini:**
   - [ ] Verifica che la lista listini personalizzati sia visibile
   - [ ] Se ci sono listini, verifica informazioni:
     - [ ] Nome listino
     - [ ] Margine configurato
     - [ ] Clienti assegnati
     - [ ] Stato
   - [ ] Se non ci sono listini, verifica messaggio appropriato (non errore)

3. **Creazione Listino (se possibile):**
   - [ ] Clicca su "Crea Listino Personalizzato"
   - [ ] Verifica che si apra il form
   - [ ] **NOTA:** Non è necessario completare, solo verificare UI
   - [ ] Puoi chiudere senza salvare

**✅ CRITERIO DI SUCCESSO:**

- Pagina carica senza errori
- Lista visualizzata correttamente
- Form creazione funziona (se testato)
- Nessun errore in console

---

### 🧪 TEST 5: Wallet e Ricariche

**Obiettivo:** Verificare che la gestione wallet funzioni

**Steps:**

1. **Navigazione:**
   - [ ] Vai su `/dashboard/wallet`
   - [ ] Verifica che la pagina carichi senza errori
   - [ ] Controlla console browser: **NESSUN errore JavaScript**

2. **Saldo Wallet:**
   - [ ] Verifica che il saldo corrente sia visibile
   - [ ] Verifica che sia formattato correttamente (€X.XX)

3. **Transazioni:**
   - [ ] Verifica che la lista transazioni sia visibile
   - [ ] Se ci sono transazioni, verifica colonne:
     - [ ] Data
     - [ ] Tipo (addebito/accredito)
     - [ ] Importo
     - [ ] Descrizione
   - [ ] Se non ci sono transazioni, verifica messaggio appropriato

4. **Ricarica Wallet (se possibile):**
   - [ ] Clicca su "Ricarica Wallet" o pulsante simile
   - [ ] Verifica che si apra il dialog/form
   - [ ] **NOTA:** Non è necessario completare la ricarica, solo verificare UI
   - [ ] Puoi chiudere senza completare

**✅ CRITERIO DI SUCCESSO:**

- Pagina carica senza errori
- Saldo visualizzato correttamente
- Transazioni visualizzate correttamente (anche se vuota)
- Form ricarica funziona (se testato)
- Nessun errore in console

---

### 🧪 TEST 6: Navigation e Menu

**Obiettivo:** Verificare che la navigazione funzioni correttamente

**Steps:**

1. **Menu Laterale:**
   - [ ] Verifica presenza sezione "Reseller" nel menu
   - [ ] Verifica voci:
     - [ ] "I Miei Clienti" → punta a `/dashboard/reseller/clienti`
     - [ ] "Listini" → punta a `/dashboard/reseller/listini` (pagina unificata con 2 tab)
   - [ ] Clicca su ogni voce e verifica navigazione corretta

2. **Sezione Finanze:**
   - [ ] Verifica presenza sezione "Finanze" nel menu
   - [ ] Verifica voce "Wallet" → punta a `/dashboard/wallet`
   - [ ] Clicca e verifica navigazione

3. **Sezione Logistica:**
   - [ ] Verifica presenza sezione "Logistica" nel menu
   - [ ] Verifica voci principali (Spedizioni, Resi, etc.)
   - [ ] Clicca su "Spedizioni" e verifica navigazione

4. **Link Funzionanti:**
   - [ ] Verifica che tutti i link navigano correttamente
   - [ ] Verifica che non ci siano errori 404
   - [ ] Verifica che non ci siano errori in console

**✅ CRITERIO DI SUCCESSO:**

- Tutti i link funzionano
- Navigazione fluida
- Nessun errore 404
- Nessun errore in console

---

## 📊 REPORT FINALE

Al termine dei test, compila questo report:

### ✅ Test Completati

- [ ] Test 0: Verifica Configurazioni API Corriere
- [ ] Test 1: Dashboard Clienti Reseller
- [ ] Test 2: Creazione Spedizione e Financial Tracking
- [ ] Test 3: Listini Fornitore
- [ ] Test 4: Listini Personalizzati
- [ ] Test 5: Wallet e Ricariche
- [ ] Test 6: Navigation e Menu

### ❌ Errori Trovati

- [ ] Nessun errore
- [ ] Errori trovati (descrivi sotto)

### 📝 Note

- **Configurazioni API Corriere:** [Visibili / Non visibili] - [Lista corrieri se visibili]
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

- ✅ Tutti i 7 test sono stati eseguiti (Test 0-6)
- ✅ Nessun errore critico (bloccante) trovato
- ✅ Tutte le funzionalità principali funzionano
- ✅ Configurazioni API verificate (visibili o segnalate)
- ✅ Report finale compilato

---

## 🎯 PROSSIMI STEP (DOPO RESELLER)

Una volta completati i test Reseller:

1. ✅ Report Reseller completato
2. ⏳ Test BYOC (da fare dopo)

---

**IMPORTANTE:** Questo prompt è per test **RESELLER SOLO**. Non testare funzionalità SuperAdmin o BYOC in questa fase.
