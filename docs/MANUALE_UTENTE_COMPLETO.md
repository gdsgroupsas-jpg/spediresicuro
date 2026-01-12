# 📖 Manuale Utente SpedireSicuro - Guida Completa

> **Versione:** 1.0  
> **Data:** Gennaio 2026  
> **Per:** Tutti gli utenti della piattaforma

---

## 🎯 INDICE RAPIDO

1. [Primi Passi](#1-primi-passi)
2. [Navigazione Dashboard](#2-navigazione-dashboard)
3. [Sezioni Principali](#3-sezioni-principali)
4. [Guida SuperAdmin](#4-guida-superadmin)
5. [Guida Reseller](#5-guida-reseller)
6. [Guida Utente Standard](#6-guida-utente-standard)
7. [FAQ e Risoluzione Problemi](#7-faq-e-risoluzione-problemi)

---

## 1. PRIMI PASSI

### 1.1 Come Accedere

1. Vai su: **www.spediresicuro.it**
2. Clicca su **"Accedi"** o **"Login"** (in alto a destra)
3. Inserisci:
   - **Email:** la tua email registrata
   - **Password:** la tua password
4. Clicca **"Accedi"**

### 1.2 Cosa Vedrai Dopo il Login

Dopo il login, vedrai la **Dashboard Principale** con:

- **Menu laterale sinistro:** tutte le funzionalità disponibili
- **Area centrale:** contenuto della pagina selezionata
- **Header in alto:** logo, notifiche, profilo utente

### 1.3 I Tuoi Ruoli

La piattaforma ha 4 tipi di utenti:

| Ruolo          | Cosa Puoi Fare                                                                     |
| -------------- | ---------------------------------------------------------------------------------- |
| **User**       | Creare spedizioni, vedere le tue spedizioni, gestire il tuo wallet                 |
| **Reseller**   | Tutto di User + gestire clienti, listini personalizzati, ricaricare wallet clienti |
| **Admin**      | Tutto di Reseller + gestire utenti, vedere tutte le spedizioni, configurazioni     |
| **SuperAdmin** | Tutto + Financial Dashboard, gestione completa piattaforma, listini master         |

---

## 2. NAVIGAZIONE DASHBOARD

### 2.1 Menu Laterale

Il menu laterale è organizzato in **sezioni**:

#### 📦 **SPEDIZIONI** (tutti gli utenti)

- **Nuova Spedizione** - Crea una nuova spedizione
- **Tutte le Spedizioni** - Vedi tutte le tue spedizioni
- **Spedizioni Cancellate** - Spedizioni eliminate
- **Giacenze** - Spedizioni in giacenza
- **Contrassegni** - Spedizioni con contrassegno

#### 🔄 **RESI** (tutti gli utenti)

- **Gestione Resi** - Gestisci resi e rimborsi
- **Scanner Resi** - Scansiona LDV per resi

#### 💰 **FINANZE** (Reseller e utenti con wallet)

- **Wallet** - Ricariche e transazioni

#### 👥 **RESELLER** (solo Reseller)

- **I Miei Clienti** - Gestisci clienti, listini e wallet
- **Listini Fornitore** - Gestisci i tuoi listini fornitore
- **Listini Personalizzati** - Listini per i tuoi clienti

#### 💼 **FINANZA PIATTAFORMA** (solo SuperAdmin)

- **Financial Dashboard** - P&L, Margini e Riconciliazione
- **Listini Master** - Listini globali piattaforma

#### ⚙️ **AMMINISTRAZIONE** (Admin e SuperAdmin)

- **Super Admin** - Gestione completa piattaforma (solo SuperAdmin)
- **Admin Panel** - Gestione utenti e configurazioni

#### 👤 **ACCOUNT**

- **Profilo** - I tuoi dati personali
- **Impostazioni** - Configurazioni account

---

## 3. SEZIONI PRINCIPALI

### 3.1 Dashboard Principale (`/dashboard`)

**Cosa vedi:**

- **Statistiche in tempo reale:**

  - Spedizioni totali
  - Spedizioni oggi/settimana/mese
  - Fatturato totale e mensile
  - Margine medio
  - Spedizioni in transito/consegnate

- **Attività recente:**

  - Ultime spedizioni create
  - Ultimi preventivi calcolati

- **Quick Actions:**
  - Pulsante "Nuova Spedizione" (in evidenza)
  - Link rapidi alle sezioni principali

**Come usarla:**

- È la tua **homepage** dopo il login
- Ti dà una **panoramica** di tutto
- Clicca su qualsiasi card per andare alla sezione specifica

---

### 3.2 Nuova Spedizione (`/dashboard/spedizioni/nuova`)

**Cosa serve:**

- Creare una nuova spedizione

**Come usarla:**

1. **Clicca su "Nuova Spedizione"** nel menu o nella dashboard
2. **Compila il form:**

   - **Mittente:** i tuoi dati (precompilati se già salvati)
   - **Destinatario:** dati del destinatario
   - **Peso:** peso del pacco (obbligatorio)
   - **Dimensioni:** lunghezza, larghezza, altezza (opzionale ma consigliato)
   - **Corriere:** scegli tra quelli disponibili
   - **Servizio:** Standard, Express, Economy
   - **Opzioni:** Contrassegno, Assicurazione (se disponibili)

3. **Vedi il preventivo:**

   - Il sistema calcola automaticamente il costo
   - Vedi il prezzo prima di confermare

4. **Conferma:**
   - Clicca "Crea Spedizione"
   - Riceverai il tracking number

**💡 Suggerimenti:**

- Se hai un'immagine della bolletta, puoi usare **"AI Import"** per estrarre i dati automaticamente
- Il sistema suggerisce il corriere migliore in base a prezzo e tempi

---

### 3.3 Tutte le Spedizioni (`/dashboard/spedizioni`)

**Cosa vedi:**

- **Lista completa** delle tue spedizioni
- **Filtri:**
  - Per data
  - Per corriere
  - Per stato (in transito, consegnata, ecc.)
  - Per tracking number

**Come usarla:**

1. **Visualizza spedizioni:**

   - Vedi tutte le spedizioni in una tabella
   - Clicca su una spedizione per i dettagli

2. **Filtra:**

   - Usa i filtri in alto per trovare spedizioni specifiche
   - Esempio: "Spedizioni di oggi" o "Solo BRT"

3. **Azioni rapide:**

   - **Stampa etichetta** - Stampa l'etichetta spedizione
   - **Traccia** - Vedi lo stato di consegna
   - **Cancella** - Elimina una spedizione (se permesso)

4. **Export:**
   - Puoi esportare la lista in CSV o Excel

---

### 3.4 Wallet (`/dashboard/wallet`)

**Cosa vedi:**

- **Saldo attuale** del tuo wallet
- **Storico transazioni:**
  - Ricariche
  - Addebiti per spedizioni
  - Rimborsi

**Come usarla:**

1. **Vedi il saldo:**

   - In alto vedi quanto hai disponibile

2. **Ricarica:**

   - Clicca "Ricarica Wallet"
   - Inserisci l'importo
   - Scegli metodo di pagamento
   - Conferma

3. **Vedi transazioni:**
   - Scorri in basso per vedere tutte le operazioni
   - Ogni riga mostra: data, tipo, importo, saldo dopo

**⚠️ Importante:**

- Il wallet si addebita automaticamente quando crei una spedizione
- Se non hai credito, non puoi creare spedizioni (tranne SuperAdmin)

---

## 4. GUIDA SUPERADMIN

### 4.1 Super Admin Dashboard (`/dashboard/super-admin`)

**Cosa vedi:**

- **Lista utenti** completa della piattaforma
- **Statistiche globali:**

  - Totale utenti
  - Totale spedizioni
  - Fatturato totale

- **Quick Actions:**
  - **Financial Dashboard** (verde) - Vai alla dashboard finanziaria
  - **Listini Master** (blu) - Gestisci listini globali
  - **Analytics** (grigio) - Coming soon

**Come usarla:**

1. **Gestisci utenti:**

   - Vedi tutti gli utenti in una tabella
   - Filtra per ruolo, email, stato
   - Clicca su un utente per vedere i dettagli

2. **Azioni utente:**

   - **Crea nuovo utente** - Pulsante in alto
   - **Modifica utente** - Clicca sull'utente
   - **Ricarica wallet** - Dalla pagina dettaglio utente
   - **Promuovi a Reseller/Admin** - Dalla pagina dettaglio

3. **Quick Actions:**
   - Clicca sulle card colorate per andare rapidamente alle sezioni principali

---

### 4.2 Financial Dashboard (`/dashboard/super-admin/financial`)

**🎯 Questa è la sezione più importante per te come SuperAdmin!**

**Cosa vedi:**

#### **Tab "Overview" (predefinito):**

1. **8 Card Statistiche:**

   - **Spedizioni Totali** - Quante spedizioni totali
   - **Ricavi Totali** - Quanto hai incassato
   - **Costi Provider** - Quanto hai pagato ai corrieri
   - **Margine Lordo** - Profitto (Ricavi - Costi)
   - **Margine Medio** - Percentuale margine
   - **Da Riconciliare** - Spedizioni da verificare
   - **Margini Negativi** - Spedizioni in perdita
   - **Ultimi 30 Giorni** - Spedizioni recenti

2. **Period Selector:**

   - Dropdown in alto a destra
   - Scegli il periodo da visualizzare:
     - Ultimi 7 giorni
     - Ultimi 30 giorni
     - Ultimi 90 giorni
     - Da inizio anno
     - Tutto il periodo

3. **P&L Mensile:**

   - Grafico che mostra profitti/perdite per mese
   - Se non ci sono dati, vedi "Nessun dato disponibile"

4. **Alert Margini:**

   - Se ci sono problemi, vedi alert rossi/gialli
   - Se tutto ok, vedi checkmark verde "Nessun alert attivo"

5. **Pulsante "Export CSV":**
   - In alto a destra
   - Scarica tutti i dati finanziari in CSV

**Come usarla:**

1. **Vedi le statistiche:**

   - Le card mostrano i dati in tempo reale
   - Se vedi "0", significa che non ci sono ancora dati

2. **Cambia periodo:**

   - Clicca sul dropdown "Period Selector"
   - Scegli un periodo diverso
   - I dati si aggiornano automaticamente

3. **Esporta dati:**

   - Clicca "Export CSV"
   - Si scarica un file Excel con tutti i dati
   - Utile per analisi in Excel o contabilità

4. **Monitora alert:**
   - Controlla la sezione "Alert Margini"
   - Se vedi alert, significa che ci sono spedizioni con margine negativo (perdite)

---

#### **Tab "Analytics":**

**Cosa vedi:**

1. **Grafico "Margini per Corriere":**

   - Mostra quale corriere genera più profitto
   - Barre colorate per ogni corriere
   - Se non ci sono dati, vedi "Nessun dato disponibile"

2. **Tabella "Top Resellers":**
   - Classifica dei migliori reseller
   - Mostra: Nome, Spedizioni, Fatturato, Margine generato
   - Top 3 evidenziati

**Come usarla:**

1. **Analizza performance corrieri:**

   - Vedi quale corriere è più redditizio
   - Usa queste info per negoziare contratti migliori

2. **Identifica top clienti:**
   - Vedi chi genera più fatturato
   - Puoi offrire condizioni migliori ai migliori clienti

---

#### **Tab "Riconciliazione":**

**Cosa vedi:**

- **Tabella con spedizioni da riconciliare:**
  - Colonne: Tracking, Cliente, Billed, Costo, Margine, Stato, Azioni
  - **Stato può essere:**
    - `pending` - Da verificare
    - `matched` - Riconciliato (tutto ok)
    - `discrepancy` - C'è una differenza da verificare
    - `resolved` - Problema risolto

**Come usarla:**

1. **Vedi spedizioni da verificare:**

   - Le spedizioni con stato "pending" devono essere verificate
   - Confronta "Billed" (quanto hai addebitato) con "Costo" (quanto hai pagato)

2. **Riconcilia:**

   - Clicca su "Riconcilia" per una spedizione
   - Scegli lo stato:
     - **Matched** - Se tutto corrisponde
     - **Discrepancy** - Se c'è una differenza
   - Aggiungi note se necessario
   - Conferma

3. **Filtra:**
   - Usa i filtri per vedere solo spedizioni con un certo stato
   - Esempio: "Solo discrepancy" per vedere i problemi

**💡 Suggerimenti:**

- Riconcilia regolarmente (settimanale o mensile)
- Le spedizioni con margine negativo vengono automaticamente flaggate come "discrepancy"
- Le spedizioni vecchie (>7 giorni) con margine positivo vengono auto-riconcilate

---

#### **Tab "Alert":**

**Cosa vedi:**

- **Tabella con tutti gli alert finanziari:**
  - Colonne: Data, Tipo, Severità, Messaggio, Tracking
  - **Severità:**
    - 🔴 **Critical** - Problemi gravi (margini molto negativi)
    - 🟡 **Warning** - Attenzione (margini negativi)
    - 🔵 **Info** - Informazioni generali

**Come usarla:**

1. **Monitora problemi:**

   - Gli alert ti avvisano di problemi finanziari
   - Esempio: "5 spedizioni con margine negativo"

2. **Investiga:**

   - Clicca su un alert per vedere i dettagli
   - Vai alla spedizione specifica per capire il problema

3. **Risolvi:**
   - Dopo aver risolto, l'alert può essere marcato come risolto
   - Gli alert vengono anche inviati via Slack/Email (se configurati)

---

### 4.3 Listini Master (`/dashboard/super-admin/listini-master`)

**Cosa serve:**

- Gestire i **listini globali** della piattaforma
- Questi sono i listini base che tutti possono usare

**Come usarla:**

1. **Vedi listini esistenti:**

   - Tabella con tutti i listini master
   - Vedi: Nome, Corriere, Stato, Data creazione

2. **Crea nuovo listino:**

   - Clicca "Crea Listino Master"
   - Compila i dati:
     - Nome (es. "GLS Standard 2025")
     - Corriere (GLS, BRT, SDA, ecc.)
     - Margine percentuale
   - Salva

3. **Modifica listino:**
   - Clicca su un listino esistente
   - Modifica i dati
   - Salva

**💡 Importante:**

- I listini master sono la base per tutti i calcoli
- Se modifichi un listino, impatta tutti gli utenti che lo usano
- Usa con cautela!

---

## 5. GUIDA RESELLER

### 5.1 I Miei Clienti (`/dashboard/reseller/clienti`)

**🎯 Questa è la sezione principale per te come Reseller!**

**Cosa vedi:**

1. **4 Card Statistiche:**

   - **Totale Clienti** - Quanti clienti hai
   - **Saldo Totale Wallet** - Quanto hanno in totale nei wallet
   - **Con Listino Assegnato** - Quanti hanno un listino
   - **Spedizioni Totali** - Quante spedizioni hanno fatto

2. **Lista Clienti:**
   - Card per ogni cliente con:
     - Nome e email
     - Wallet (saldo attuale)
     - Spedizioni (quante ha fatto)
     - Fatturato (quanto ha speso)
     - Badge listino (se ha un listino assegnato)

**Come usarla:**

1. **Vedi tutti i clienti:**

   - La lista mostra tutti i tuoi clienti
   - Puoi cercare per nome/email usando la barra di ricerca

2. **Filtra:**

   - **Tutti** - Vedi tutti i clienti
   - **Con listino** - Solo clienti con listino assegnato
   - **Senza listino** - Solo clienti senza listino

3. **Ordina:**

   - Per nome
   - Per wallet (saldo)
   - Per spedizioni
   - Per data creazione

4. **Azioni rapide (menu 3 puntini):**

   - **Assegna Listino** - Assegna un listino a questo cliente
   - **Ricarica Wallet** - Aggiungi credito al wallet
   - **Vedi Spedizioni** - Vai alle spedizioni del cliente
   - **Modifica Cliente** - Modifica dati cliente

5. **Crea nuovo cliente:**
   - Clicca "Nuovo Cliente" in alto
   - Compila i dati
   - Salva

**💡 Suggerimenti:**

- Assegna sempre un listino ai clienti per applicare i tuoi prezzi
- Monitora i wallet: se un cliente è a zero, non può creare spedizioni
- Usa i filtri per trovare rapidamente clienti senza listino

---

### 5.2 Listini Fornitore (`/dashboard/reseller/listini-fornitore`)

**Cosa serve:**

- Gestire i **listini che ricevi dai tuoi fornitori** (corrieri)
- Questi sono i prezzi che PAGHI tu ai corrieri

**Come usarla:**

1. **Vedi listini esistenti:**

   - Tabella con i tuoi listini fornitore
   - Vedi: Nome, Corriere, Stato

2. **Crea nuovo listino:**

   - Clicca "Crea Listino Fornitore"
   - Scegli il corriere
   - Carica il file Excel con i prezzi (se disponibile)
   - Oppure inserisci manualmente

3. **Configura:**
   - Dopo aver creato, configura:
     - Assicurazione
     - Contrassegni
     - Servizi accessori

**💡 Importante:**

- I listini fornitore sono i prezzi che PAGHI
- I listini personalizzati sono i prezzi che VENDI ai clienti
- La differenza è il tuo margine!

---

### 5.3 Listini Personalizzati (`/dashboard/reseller/listini-personalizzati`)

**Cosa serve:**

- Creare **listini personalizzati** per i tuoi clienti
- Questi sono i prezzi che VENDI ai clienti

**Come usarla:**

1. **Vedi listini esistenti:**

   - Tabella con i tuoi listini personalizzati
   - Vedi: Nome, Corriere, Margine, Stato

2. **Crea nuovo listino:**

   - Clicca "Crea Listino Personalizzato"
   - Scegli:
     - Nome (es. "Listino Premium Cliente X")
     - Corriere
     - Margine percentuale (quanto vuoi guadagnare)
   - Salva

3. **Assegna a cliente:**
   - Vai su "I Miei Clienti"
   - Clicca menu 3 puntini su un cliente
   - Scegli "Assegna Listino"
   - Seleziona il listino personalizzato
   - Conferma

**💡 Suggerimenti:**

- Puoi creare listini diversi per clienti diversi
- Esempio: Listino "VIP" con margine basso per clienti importanti
- Esempio: Listino "Standard" con margine normale per altri

---

## 6. GUIDA UTENTE STANDARD

### 6.1 Dashboard (`/dashboard`)

**Cosa vedi:**

- Le tue statistiche personali
- Le tue ultime spedizioni
- Link rapidi

**Come usarla:**

- È la tua homepage
- Vedi tutto quello che ti serve in un colpo d'occhio

---

### 6.2 Creare una Spedizione

**Passo-passo:**

1. **Vai su "Nuova Spedizione"**
2. **Compila:**
   - Mittente (i tuoi dati)
   - Destinatario
   - Peso
   - Dimensioni (opzionale)
   - Corriere
3. **Vedi il preventivo**
4. **Conferma**
5. **Ricevi il tracking number**

**💡 Suggerimenti:**

- Se hai un'immagine della bolletta, usa "AI Import"
- Il sistema suggerisce il corriere migliore
- Puoi salvare i dati del destinatario per riutilizzarli

---

### 6.3 Tracciare una Spedizione

**Come fare:**

1. **Vai su "Tutte le Spedizioni"**
2. **Trova la spedizione** (usa filtri se necessario)
3. **Clicca su "Traccia"** o sul tracking number
4. **Vedi lo stato:**
   - In preparazione
   - In transito
   - In consegna
   - Consegnata

**Oppure:**

- Vai su **www.spediresicuro.it/track/[tracking-number]**
- Inserisci il tracking number
- Vedi lo stato (anche senza login)

---

## 7. FAQ E RISOLUZIONE PROBLEMI

### 7.1 Domande Frequenti

**Q: Non riesco a creare una spedizione, dice "Credito insufficiente"**  
A: Devi ricaricare il wallet. Vai su "Wallet" → "Ricarica Wallet"

**Q: Come vedo quanto ho speso questo mese?**  
A: Vai su "Dashboard" → Vedi "Fatturato Mese" nella card statistiche

**Q: Come assegno un listino a un cliente? (Reseller)**  
A: Vai su "I Miei Clienti" → Menu 3 puntini sul cliente → "Assegna Listino"

**Q: Come vedo i margini delle mie spedizioni? (SuperAdmin)**  
A: Vai su "Financial Dashboard" → Tab "Overview" → Vedi "Margine Lordo" e "Margine Medio"

**Q: Cosa significa "Da Riconciliare"? (SuperAdmin)**  
A: Sono spedizioni che devono essere verificate. Vai su Tab "Riconciliazione" per vederle

**Q: Come esporto i dati finanziari? (SuperAdmin)**  
A: Vai su "Financial Dashboard" → Clicca "Export CSV" in alto a destra

**Q: Perché vedo "Impossibile calcolare preventivo" per un corriere?**  
A: Il corriere non ha un listino configurato per quella rotta. Contatta l'amministratore.

---

### 7.2 Risoluzione Problemi Comuni

#### **Problema: Non vedo una sezione nel menu**

**Possibili cause:**

- Non hai i permessi per quella sezione
- La sezione è disponibile solo per certi ruoli

**Soluzione:**

- Contatta l'amministratore per verificare i tuoi permessi
- Esempio: "Finanza Piattaforma" è solo per SuperAdmin

---

#### **Problema: I dati non si aggiornano**

**Soluzione:**

1. Ricarica la pagina (F5)
2. Aspetta 2-3 secondi (i dati si aggiornano in tempo reale)
3. Se persiste, prova a fare logout e login

---

#### **Problema: Non riesco a cancellare una spedizione**

**Possibili cause:**

- La spedizione è già stata consegnata
- Non hai i permessi per cancellare
- La spedizione è stata già processata dal corriere

**Soluzione:**

- Contatta il supporto se necessario
- Le spedizioni consegnate non possono essere cancellate

---

#### **Problema: Il wallet non si aggiorna dopo una ricarica**

**Soluzione:**

1. Ricarica la pagina
2. Verifica che il pagamento sia andato a buon fine
3. Controlla lo storico transazioni
4. Se il problema persiste, contatta il supporto

---

### 7.3 Contatti e Supporto

**Se hai problemi:**

1. Controlla questo manuale
2. Vai su "Supporto" → "Manuale Utente" nel menu
3. Contatta il supporto via email o chat

---

## 🎯 QUICK REFERENCE

### Per SuperAdmin:

| Cosa Vuoi Fare              | Dove Andare                               |
| --------------------------- | ----------------------------------------- |
| Vedere profitti/perdite     | Financial Dashboard → Tab Overview        |
| Esportare dati finanziari   | Financial Dashboard → Export CSV          |
| Vedere margini per corriere | Financial Dashboard → Tab Analytics       |
| Riconciliare spedizioni     | Financial Dashboard → Tab Riconciliazione |
| Gestire listini globali     | Listini Master                            |
| Gestire utenti              | Super Admin Dashboard                     |

### Per Reseller:

| Cosa Vuoi Fare                | Dove Andare                                     |
| ----------------------------- | ----------------------------------------------- |
| Gestire clienti               | I Miei Clienti                                  |
| Assegnare listino a cliente   | I Miei Clienti → Menu cliente → Assegna Listino |
| Ricaricare wallet cliente     | I Miei Clienti → Menu cliente → Ricarica Wallet |
| Creare listino personalizzato | Listini Personalizzati                          |
| Gestire listini fornitore     | Listini Fornitore                               |

### Per Utente Standard:

| Cosa Vuoi Fare           | Dove Andare                                |
| ------------------------ | ------------------------------------------ |
| Creare spedizione        | Nuova Spedizione                           |
| Vedere le mie spedizioni | Tutte le Spedizioni                        |
| Tracciare spedizione     | Tutte le Spedizioni → Clicca su spedizione |
| Ricaricare wallet        | Wallet → Ricarica Wallet                   |
| Vedere statistiche       | Dashboard                                  |

---

## ✅ CONCLUSIONE

Questo manuale copre tutte le funzionalità principali della piattaforma.

**Se hai domande:**

- Controlla questo manuale
- Usa la funzione di ricerca (Ctrl+F)
- Contatta il supporto

**Buon lavoro con SpedireSicuro! 🚀**
