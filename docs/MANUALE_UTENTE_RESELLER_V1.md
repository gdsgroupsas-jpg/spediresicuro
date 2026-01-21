# 📦 Manuale Utente Reseller / Point Fisico

## SpedireSicuro - Versione 1.0

> **Per chi è questo manuale:** Operatori di agenzie, point fisici, reseller che spediscono per conto dei clienti.  
> **Obiettivo:** Fare una spedizione senza fare domande.  
> **Tempo stimato lettura:** 15 minuti.

---

## 📋 Indice

1. [Quick Start – Prima spedizione in 10 minuti](#1-quick-start--prima-spedizione-in-10-minuti)
2. [Accesso e Onboarding (Dati Cliente)](#2-accesso-e-onboarding-dati-cliente)
3. [Creare una Spedizione (manuale)](#3-creare-una-spedizione-manuale)
4. [Wallet (No Credit, No Label)](#4-wallet-no-credit-no-label)
5. [Tracking e post-spedizione](#5-tracking-e-post-spedizione)
6. [Errori comuni e cosa fare](#6-errori-comuni-e-cosa-fare)
7. [Cosa NON fare (guardrail reseller)](#7-cosa-non-fare-guardrail-reseller)

---

## 1. Quick Start – Prima spedizione in 10 minuti

### Cosa serve prima di iniziare

- ✅ Account attivo (email e password)
- ✅ Credito nel wallet (almeno €20 per sicurezza)
- ✅ Dati cliente completati (nome, codice fiscale, indirizzo)

### Passo 1: Accedi

1. Vai su `spediresicuro.it/login`
2. Inserisci email e password
3. Clicca **"Accedi"**

**Cosa succede:**

- Se è la prima volta, ti porta a completare i dati cliente
- Se hai già completato, vai direttamente alla dashboard

### Passo 2: Completa Dati Cliente (solo prima volta)

Se vedi la pagina **"Completa i Tuoi Dati Cliente"**, compila:

**Obbligatori:**

- Nome
- Cognome
- Codice Fiscale (16 caratteri, es. `ABCDEF12G34H567I`)
- Telefono
- Indirizzo
- Città
- Provincia (2 lettere, es. `RM`, `MI`)
- CAP (5 cifre)

**Se sei un'azienda:**

- Tipo Cliente: seleziona **"Azienda"**
- Ragione Sociale
- Partita IVA (11 caratteri)

Clicca **"Salva e Completa Registrazione"**.

**Cosa succede:**

- I dati vengono salvati
- Vieni reindirizzato alla dashboard
- Non devi più rifarlo (a meno che non cambi account)

### Passo 3: Verifica Wallet

1. Dalla dashboard, clicca su **"Wallet"** nel menu
2. Controlla il saldo in alto

**Se il saldo è €0 o insufficiente:**

- Clicca **"Ricarica"**
- Carica PDF/immagine del bonifico
- Inserisci importo
- Clicca **"Invia Richiesta"**
- **ATTENZIONE:** Devi aspettare l'approvazione admin (non è immediato)

**Se il saldo è OK:**

- Procedi al passo successivo

### Passo 4: Crea Spedizione

1. Dalla dashboard, clicca **"Lista Spedizioni"**
2. Clicca **"Nuova Spedizione"** (pulsante arancione in alto a destra)

**Compila il form:**

**Mittente:**

- Nome completo
- Indirizzo
- Città/Provincia/CAP (usa l'autocompletamento)
- Telefono
- Email (opzionale)

**Destinatario:**

- Nome completo
- Indirizzo
- Città/Provincia/CAP (usa l'autocompletamento)
- Telefono (obbligatorio se contrassegno)
- Email (opzionale)

**Pacco:**

- Peso (kg) - obbligatorio
- Dimensioni (cm) - opzionali
- Tipo spedizione: Standard / Express / Assicurata
- Corriere: GLS / SDA / Bartolini / Poste Italiane

**Contrassegno (opzionale):**

- Spunta la casella se serve
- Inserisci importo

3. Clicca **"Genera Spedizione"** (pulsante arancione in basso a destra)

**Cosa succede:**

- Il sistema controlla il credito
- Se OK, addebita il wallet
- Crea la spedizione
- Genera l'etichetta (PDF)
- Ti scarica automaticamente il PDF
- Dopo 3 secondi ti porta alla lista spedizioni

**Se va tutto bene:**

- Vedi la spedizione nella lista
- Hai il PDF dell'etichetta scaricato
- Il wallet è stato scalato

---

## 2. Accesso e Onboarding (Dati Cliente)

### 2.1 Login

**URL:** `spediresicuro.it/login`

**Opzioni di accesso:**

1. **Email/Password:** Inserisci credenziali → clicca "Accedi"
2. **OAuth:** Clicca "Continua con Google/GitHub/Facebook"

**Cosa succede dopo il login:**

- Se dati cliente completati → vai a `/dashboard`
- Se dati cliente NON completati → vai a `/dashboard/dati-cliente` (obbligatorio)

**Se non riesci ad accedere:**

- Verifica email confermata (controlla spam)
- Se OAuth fallisce, usa email/password
- Contatta admin se password dimenticata

### 2.2 Completamento Dati Cliente

**Quando appare:** Prima volta dopo registrazione, oppure se dati incompleti.

**Cosa devi compilare:**

#### Se sei Persona Fisica:

**Obbligatori:**

- Nome
- Cognome
- Codice Fiscale (esattamente 16 caratteri, maiuscolo)
- Telefono
- Indirizzo
- Città
- Provincia (2 lettere maiuscole, es. `RM`, `MI`, `TO`)
- CAP (5 cifre)

**Opzionali:**

- Data di nascita
- Luogo di nascita
- Sesso
- Cellulare
- Email (già presente dal login)
- IBAN
- Documento identità

#### Se sei Azienda:

**Tutto quello sopra + obbligatori:**

- Tipo Cliente: seleziona **"Azienda"**
- Ragione Sociale
- Partita IVA (esattamente 11 caratteri)

**Opzionali:**

- Codice SDI (fatturazione elettronica)
- PEC
- Indirizzo fatturazione (se diverso da sede)

**Validazione:**

- Codice Fiscale: deve essere 16 caratteri (se inserito)
- Partita IVA: deve essere 11 caratteri (se azienda)
- Provincia: massimo 2 lettere maiuscole
- CAP: massimo 5 cifre

**Cosa succede se sbagli:**

- Il form mostra errore in rosso sotto il campo
- Non puoi salvare finché non correggi
- Esempio: "Il codice fiscale deve essere di 16 caratteri"

**Dopo il salvataggio:**

- Messaggio verde: "Dati salvati con successo!"
- Reindirizzamento automatico a dashboard dopo 1.5 secondi
- Non devi più rifarlo

**Se non salva:**

- Controlla tutti i campi obbligatori
- Verifica formato codice fiscale (16 caratteri)
- Verifica formato partita IVA se azienda (11 caratteri)
- Ricarica la pagina e riprova

---

## 3. Creare una Spedizione (manuale)

### 3.1 Accesso al Form

**Dove:** Dashboard → **"Lista Spedizioni"** → pulsante **"Nuova Spedizione"** (arancione, in alto a destra)

**URL diretto:** `/dashboard/spedizioni/nuova`

### 3.2 Due Modalità

**Manuale (default):**

- Compili tutto a mano
- Usa per spedizioni normali

**AI Import:**

- Clicca su **"AI Import"** in alto (icona stella)
- Carica immagine (screenshot WhatsApp, foto documento)
- Il sistema estrae automaticamente i dati destinatario
- **ATTENZIONE:** Verifica sempre i dati estratti prima di salvare

### 3.3 Compilazione Form

#### Sezione Mittente

**Campi obbligatori:**

- Nome Completo
- Indirizzo
- Città/Provincia/CAP (usa autocompletamento)
- Telefono

**Campi opzionali:**

- Email

**Autocompletamento Città:**

- Clicca nel campo "Città, Provincia, CAP"
- Inizia a digitare il nome della città
- Seleziona dalla lista
- Il sistema compila automaticamente Provincia e CAP

**Se il mittente è sempre lo stesso:**

- Il sistema carica automaticamente i dati predefiniti (se configurati)
- Puoi modificarli se serve

#### Sezione Destinatario

**Campi obbligatori:**

- Nome Completo
- Indirizzo
- Città/Provincia/CAP (usa autocompletamento)
- Telefono (obbligatorio SOLO se attivi contrassegno)

**Campi opzionali:**

- Email

**Validazione real-time:**

- Icona verde = campo valido
- Icona rossa = campo non valido
- Messaggio errore sotto il campo

**Formato telefono:**

- Accetta: `+39 312 345 6789`, `0039 312 345 6789`, `312 345 6789`
- Il sistema normalizza automaticamente a `+39...`

#### Sezione Dettagli Pacco

**Peso (obbligatorio):**

- Inserisci in kg (es. `2.5`)
- Minimo: `0.01`
- Il sistema valida che sia > 0

**Dimensioni (opzionali):**

- Lunghezza (cm)
- Larghezza (cm)
- Altezza (cm)
- Se non inserisci, il sistema usa valori di default

**Tipo Spedizione:**

- **Standard:** normale (default)
- **Express:** urgente (+50% costo)
- **Assicurata:** con assicurazione (+30% costo)

**Corriere:**

- Seleziona: **GLS**, **SDA**, **Bartolini**, **Poste Italiane**
- Il sistema mostra suggerimento AI se disponibile (colonna destra)

**Note (opzionale):**

- Campo libero per informazioni aggiuntive

#### Contrassegno (COD)

**Quando usarlo:**

- Il cliente paga alla consegna
- Devi riscuotere denaro dal destinatario

**Come attivarlo:**

1. Spunta la casella **"💰 Contrassegno (COD - Cash On Delivery)"**
2. Inserisci l'importo in euro (es. `50.00`)
3. **IMPORTANTE:** Il telefono destinatario diventa obbligatorio

**Cosa succede:**

- Il corriere riscuote l'importo alla consegna
- L'importo viene accreditato sul tuo wallet (dopo elaborazione)
- Tempi accredito: TBD (verificare con admin)

**Se attivi contrassegno senza telefono destinatario:**

- Il sistema mostra avviso giallo: "⚠️ Il telefono destinatario è obbligatorio per il contrassegno"
- Non puoi salvare finché non inserisci il telefono

### 3.4 Preview e Calcolo Costo

**Colonna destra (sticky):**

- Mostra preview ticket spedizione
- Visualizza percorso (mittente → destinatario)
- Mostra costo stimato in tempo reale
- Suggerimento AI corriere (se disponibile)

**Costo stimato:**

- Base: €10
- Peso: €2 per kg
- Express: +50%
- Assicurata: +30%

**Esempio:**

- Peso 2.5 kg, Standard → €10 + (2.5 × €2) = €15
- Peso 2.5 kg, Express → €15 × 1.5 = €22.50

**Progress bar:**

- Mostra completamento form (%)
- Deve essere 100% per salvare

### 3.5 Salvataggio

**Pulsante:** **"Genera Spedizione"** (arancione, in basso a destra)

**Cosa succede quando clicchi:**

1. **Validazione:**
   - Controlla tutti i campi obbligatori
   - Se manca qualcosa, mostra errore

2. **Controllo Wallet:**
   - Verifica credito disponibile
   - Se insufficiente → errore 402 (vedi sezione Errori)

3. **Addebito Wallet:**
   - Scala il costo stimato PRIMA di creare etichetta
   - Regola: "No Credit, No Label"

4. **Creazione Spedizione:**
   - Salva nel database
   - Genera tracking number
   - Tenta creazione etichetta via broker (Spedisci.online)

5. **Download Etichetta:**
   - Se etichetta OK → scarica PDF originale
   - Se etichetta KO → genera PDF locale (ticket di riserva)

6. **Redirect:**
   - Dopo 3 secondi → lista spedizioni
   - La nuova spedizione appare in cima

**Messaggi di successo:**

- Verde: "Spedizione creata con successo!"
- Mostra tracking number
- "Reindirizzamento alla lista spedizioni..."

**Se qualcosa va storto:**

- Vedi sezione [Errori comuni](#6-errori-comuni-e-cosa-fare)

---

## 4. Wallet (No Credit, No Label)

### 4.1 Cos'è il Wallet

**Il wallet è l'unico sistema di pagamento.**

- Non ci sono carte di credito
- Non ci sono bonifici diretti
- Devi ricaricare il wallet prima di spedire

**Regola fondamentale: "No Credit, No Label"**

- Nessuna etichetta viene generata senza credito
- Il sistema blocca la creazione se il saldo è insufficiente
- Non puoi "andare in negativo"

### 4.2 Visualizzazione Saldo

**Dove:** Dashboard → **"Wallet"** nel menu

**Cosa vedi:**

- Saldo corrente (in alto, grande)
- Statistiche: totale crediti, totale debiti, numero transazioni
- Lista transazioni (cronologica, più recenti prima)

**Filtri:**

- Tutte
- Solo crediti (ricariche)
- Solo debiti (spedizioni)

### 4.3 Ricarica Wallet

**Come fare:**

1. Vai a **"Wallet"**
2. Clicca **"Ricarica"** (pulsante arancione)
3. **Upload bonifico:**
   - Carica PDF o immagine del bonifico bancario
   - Formati: PDF, JPG, PNG
4. **Inserisci importo:**
   - Importo del bonifico in euro
   - Esempio: `100.00`
5. Clicca **"Invia Richiesta"**

**Cosa succede:**

- La richiesta viene salvata con status `pending`
- Un admin deve approvare manualmente
- **NON è immediato** (può richiedere ore/giorni)

**Dopo l'approvazione:**

- Il saldo viene aggiornato
- Appare transazione tipo "deposit"
- Ricevi notifica (TBD - verificare se implementato)

**Se la richiesta viene rifiutata:**

- Ricevi notifica (TBD)
- Puoi inviare nuova richiesta con bonifico corretto

**Limiti:**

- Max €10.000 per singola operazione
- Max €100.000 saldo totale

### 4.4 Transazioni Wallet

**Tipi di transazione:**

- **deposit:** Ricarica approvata (importo positivo)
- **shipment_cost:** Spesa per spedizione (importo negativo)
- **admin_gift:** Credito aggiunto da admin (importo positivo)
- **refund:** Rimborso (importo positivo)

**Visualizzazione:**

- Importo (verde se positivo, rosso se negativo)
- Tipo
- Descrizione
- Data/ora
- Saldo dopo transazione

**Export:**

- TBD (verificare se disponibile)

### 4.5 Cosa Succede Quando Spedisci

**Flusso automatico:**

1. Inserisci dati spedizione
2. Clicchi "Genera Spedizione"
3. **Il sistema controlla il credito:**
   - Se insufficiente → errore 402 (vedi Errori)
   - Se sufficiente → procede
4. **Addebito PRIMA di creare etichetta:**
   - Scala il costo stimato dal wallet
   - Crea transazione tipo "shipment_cost"
5. **Creazione etichetta:**
   - Se OK → spedizione creata
   - Se KO → rimborso automatico (refund)

**Regola "No Credit, No Label":**

- Se non hai credito, non puoi creare spedizioni
- Il sistema non permette saldo negativo
- Superadmin può bypassare (solo per testing)

**Costo reale vs stimato:**

- Il sistema addebita una stima (costo stimato + 20% buffer)
- Se il costo reale è diverso, viene fatto un aggiustamento
- Vedi transazione "adjustment" nel wallet

---

## 5. Tracking e post-spedizione

### 5.1 Visualizzazione Spedizione

**Dove:** Dashboard → **"Lista Spedizioni"**

**Cosa vedi:**

- Lista di tutte le tue spedizioni
- Colonne: Destinatario, Tracking, Status, Tipo, Peso, Data, Prezzo
- Filtri: ricerca, status, data, corriere, resi

**Status possibili:**

- **In Preparazione:** appena creata
- **In Transito:** spedita, in viaggio
- **Consegnata:** consegnata al destinatario
- **Eccezione:** problema (indirizzo errato, destinatario assente, etc.)
- **Annullata:** cancellata

**Azioni disponibili:**

- Clicca sulla riga → dettaglio spedizione
- Icona occhio → visualizza dettagli
- Icona PDF → scarica LDV
- Icona link esterno → tracking corriere (se disponibile)
- Icona cestino → elimina (solo se in preparazione)

### 5.2 Dettaglio Spedizione

**Dove:** Clicca su una spedizione dalla lista

**Cosa vedi:**

- Tutti i dati mittente/destinatario
- Dettagli pacco
- Tracking number
- Status e storico eventi
- Prezzo e costo
- Note

**Azioni:**

- Scarica LDV (PDF)
- Modifica (solo se in preparazione)
- Elimina (solo se in preparazione)

### 5.3 Tracking Pubblico

**URL:** `spediresicuro.it/track/[trackingId]`

**Per chi:** Cliente finale (non richiede login)

**Cosa vedono:**

- Status spedizione
- Stima consegna
- Posizione corrente
- Storico eventi

**Come condividere:**

- Copia l'URL completo
- Invia al cliente via email/WhatsApp
- Il cliente può tracciare senza account

**Nota:** Attualmente usa dati mock (verificare integrazione API corrieri reali)

### 5.4 Download LDV

**LDV = Lettera di Vettura (etichetta spedizione)**

**Come scaricare:**

1. Dalla lista spedizioni, clicca icona PDF sulla riga
2. Oppure dal dettaglio, clicca "Scarica LDV"

**Formati disponibili:**

- PDF (default)
- CSV (TBD - verificare)
- XLSX (TBD - verificare)

**Cosa contiene:**

- Dati mittente/destinatario
- Tracking number
- Barcode per scansione
- Note spedizione

**Se l'etichetta non si scarica:**

- Verifica che la spedizione sia stata creata correttamente
- Controlla errori nella creazione (vedi Errori)
- Se è un ticket locale (non etichetta reale), funziona comunque

### 5.5 Export Spedizioni

**Dove:** Lista Spedizioni → pulsante **"Esporta"** (in alto a destra)

**Formati:**

- CSV
- XLSX
- PDF

**Selezione:**

- Seleziona spedizioni con checkbox
- Oppure esporta tutte (filtri applicati)

**Uso:**

- Backup dati
- Import in altri sistemi
- Report contabilità

---

## 6. Errori comuni e cosa fare

### 6.1 Errore: "Credito insufficiente"

**Messaggio:** `Credito insufficiente. Disponibile: €X.XX`

**Cosa significa:**

- Il wallet non ha abbastanza credito per la spedizione
- Regola "No Credit, No Label" blocca la creazione

**Cosa fare:**

1. Vai a **"Wallet"**
2. Controlla saldo corrente
3. Se insufficiente:
   - Clicca **"Ricarica"**
   - Carica bonifico
   - Inserisci importo
   - Invia richiesta
   - **Aspetta approvazione admin** (non è immediato)
4. Dopo approvazione, riprova a creare spedizione

**Prevenzione:**

- Mantieni sempre almeno €50-100 nel wallet
- Controlla saldo prima di creare molte spedizioni
- Ricarica in anticipo se sai che spedirai molto

**Se l'errore persiste:**

- Verifica che la ricarica sia stata approvata
- Controlla transazioni wallet (vedi se c'è stato un addebito)
- Contatta admin se il saldo non si aggiorna

### 6.2 Errore: "Campi obbligatori mancanti"

**Messaggio:** Campo specifico in rosso con messaggio errore

**Cosa significa:**

- Un campo obbligatorio non è compilato o non è valido

**Cosa fare:**

1. Controlla tutti i campi con asterisco rosso (\*)
2. Verifica formato:
   - Codice Fiscale: esattamente 16 caratteri
   - Partita IVA: esattamente 11 caratteri (se azienda)
   - Telefono: minimo 8 caratteri
   - CAP: 5 cifre
   - Provincia: 2 lettere maiuscole
3. Compila tutti i campi obbligatori
4. Riprova a salvare

**Campi obbligatori spedizione:**

- Mittente: nome, indirizzo, città, provincia, CAP, telefono
- Destinatario: nome, indirizzo, città, provincia, CAP, telefono (se contrassegno)
- Pacco: peso

### 6.3 Errore: "Errore Creazione LDV" / "Errore Spedisci.online"

**Messaggio:** `⚠️ Errore Creazione LDV` con dettagli

**Cosa significa:**

- La creazione dell'etichetta via broker (Spedisci.online) è fallita
- La spedizione è stata salvata localmente, ma senza etichetta reale

**Possibili cause:**

1. **Contratto non configurato:**
   - Messaggio: "Contratto non configurato per [CORRIERE]"
   - **Cosa fare:**
     - Vai a **"Integrazioni"** (se disponibile)
     - Apri wizard Spedisci.online
     - Aggiungi contratto per il corriere scelto
     - Riprova a creare spedizione

2. **API Key non valida:**
   - Messaggio: "401 Unauthorized" o "API Key non valida"
   - **Cosa fare:**
     - Contatta admin per verificare credenziali Spedisci.online
     - Non puoi risolvere da solo

3. **Endpoint non trovato:**
   - Messaggio: "404 Not Found"
   - **Cosa fare:**
     - Contatta admin per verificare Base URL Spedisci.online
     - Non puoi risolvere da solo

**Cosa succede:**

- La spedizione viene salvata comunque
- Viene generato un PDF locale (ticket di riserva)
- Puoi usare questo PDF temporaneamente
- Devi creare l'etichetta manualmente su Spedisci.online (se hai accesso)

**Se l'errore persiste:**

- Prova con un altro corriere
- Contatta admin per risolvere configurazione
- Usa il PDF locale come backup

### 6.4 Errore: "Il codice fiscale deve essere di 16 caratteri"

**Messaggio:** Sotto il campo Codice Fiscale

**Cosa significa:**

- Il codice fiscale inserito non ha esattamente 16 caratteri

**Cosa fare:**

1. Controlla il codice fiscale
2. Deve essere esattamente 16 caratteri (lettere e numeri)
3. Formato: `ABCDEF12G34H567I` (maiuscolo)
4. Correggi e riprova

**Nota:** Il sistema non valida la correttezza del codice fiscale, solo la lunghezza.

### 6.5 Errore: "La partita IVA deve essere di 11 caratteri"

**Messaggio:** Sotto il campo Partita IVA (solo se azienda)

**Cosa significa:**

- La partita IVA inserita non ha esattamente 11 caratteri

**Cosa fare:**

1. Controlla la partita IVA
2. Deve essere esattamente 11 caratteri (solo numeri)
3. Formato: `12345678901`
4. Correggi e riprova

### 6.6 Errore: "Il telefono destinatario è obbligatorio per il contrassegno"

**Messaggio:** Sotto il campo Telefono Destinatario (se contrassegno attivo)

**Cosa significa:**

- Hai attivato il contrassegno ma non hai inserito il telefono destinatario

**Cosa fare:**

1. Inserisci il telefono destinatario
2. Formato: `+39 312 345 6789` o `312 345 6789`
3. Il sistema normalizza automaticamente
4. Riprova a salvare

**Perché è obbligatorio:**

- Il corriere deve contattare il destinatario per la consegna
- Senza telefono, il contrassegno non può essere gestito

### 6.7 Errore: "Database non configurato"

**Messaggio:** `Supabase non è configurato. Configura le variabili ambiente necessarie.`

**Cosa significa:**

- Errore tecnico del sistema (non dipende da te)

**Cosa fare:**

- Contatta immediatamente l'admin
- Non puoi risolvere da solo
- Il sistema non funziona finché non viene risolto

### 6.8 Errore: "Non autenticato"

**Messaggio:** `Non autenticato` o redirect a `/login`

**Cosa significa:**

- La sessione è scaduta
- Devi rifare il login

**Cosa fare:**

1. Vai a `/login`
2. Inserisci email e password
3. Clicca "Accedi"
4. Riprova l'operazione

**Prevenzione:**

- Il sistema mantiene la sessione attiva per diverse ore
- Se lavori a lungo, potrebbe scadere
- Salva sempre il lavoro prima di lasciare la pagina

### 6.9 Spedizione non appare nella lista

**Cosa significa:**

- La spedizione potrebbe non essere stata salvata
- Oppure è stata filtrata

**Cosa fare:**

1. Controlla i filtri (in alto nella lista)
2. Rimuovi tutti i filtri
3. Cerca per nome destinatario o tracking
4. Se non la trovi:
   - Controlla se hai ricevuto messaggio di errore
   - Verifica che il salvataggio sia andato a buon fine
   - Contatta admin se necessario

**Se la spedizione è stata creata ma non vedi l'etichetta:**

- Vedi errore [6.3](#63-errore-errore-creazione-ldv--errore-spediscionline)
- La spedizione esiste ma senza etichetta reale

---

## 7. Cosa NON fare (guardrail reseller)

### 7.1 NON creare spedizioni senza credito

**Cosa NON fare:**

- Tentare di creare spedizioni con wallet a €0
- Aspettarsi che il sistema "faccia credito"
- Chiedere all'admin di bypassare per "questa volta"

**Perché:**

- Regola "No Credit, No Label" è inviolabile
- Il sistema blocca automaticamente
- Anche l'admin non può bypassare facilmente (solo superadmin)

**Cosa fare invece:**

- Ricarica sempre in anticipo
- Mantieni buffer di sicurezza (€50-100)
- Monitora il saldo regolarmente

### 7.2 NON modificare dati cliente dopo onboarding

**Cosa NON fare:**

- Cambiare codice fiscale o partita IVA dopo il primo salvataggio
- Usare dati di un'altra persona/azienda
- Saltare la compilazione dati cliente

**Perché:**

- I dati cliente sono legati all'account
- Cambiamenti possono causare problemi fiscali
- Il sistema potrebbe richiedere verifica admin

**Cosa fare invece:**

- Compila correttamente la prima volta
- Se devi cambiare, contatta admin
- Usa account separati per persone/aziende diverse

### 7.3 NON usare contrassegno senza telefono destinatario

**Cosa NON fare:**

- Attivare contrassegno senza inserire telefono
- Inserire telefono falso o non valido
- Saltare la validazione telefono

**Perché:**

- Il corriere deve contattare il destinatario
- Senza telefono, la consegna fallisce
- Il contrassegno non può essere riscosso

**Cosa fare invece:**

- Chiedi sempre il telefono al cliente se usi contrassegno
- Verifica che il telefono sia corretto
- Se il cliente non vuole dare telefono, non usare contrassegno

### 7.4 NON creare spedizioni duplicate

**Cosa NON fare:**

- Creare la stessa spedizione due volte
- Cliccare "Genera Spedizione" più volte
- Non aspettare il completamento

**Perché:**

- Crei spedizioni duplicate
- Il wallet viene scalato più volte
- Confusione nella lista spedizioni

**Cosa fare invece:**

- Clicca "Genera Spedizione" UNA volta
- Aspetta il completamento (3-5 secondi)
- Se non succede nulla, controlla errori prima di riprovare
- Non ricaricare la pagina durante il salvataggio

### 7.5 NON eliminare spedizioni già spedite

**Cosa NON fare:**

- Eliminare spedizioni con status "In Transito" o "Consegnata"
- Modificare spedizioni già create
- Cancellare per "sbaglio"

**Perché:**

- Le spedizioni già spedite non possono essere annullate
- L'eliminazione può causare problemi di tracciabilità
- Il wallet è già stato scalato

**Cosa fare invece:**

- Elimina solo spedizioni "In Preparazione"
- Se hai sbagliato, contatta il corriere direttamente
- Non eliminare mai spedizioni consegnate

### 7.6 NON condividere account

**Cosa NON fare:**

- Dare password a colleghi
- Usare lo stesso account su più computer contemporaneamente
- Condividere credenziali OAuth

**Perché:**

- Problemi di sicurezza
- Confusione nelle spedizioni (chi ha fatto cosa)
- Impossibilità di tracciare operazioni

**Cosa fare invece:**

- Ogni operatore ha il proprio account
- Se sei reseller, crea sub-utenti (vedi sezione Reseller Team)
- Usa logout quando finisci

### 7.7 NON ignorare errori di validazione

**Cosa NON fare:**

- Inserire dati casuali per "bypassare" validazione
- Usare codici fiscale/partita IVA falsi
- Saltare campi obbligatori

**Perché:**

- I dati errati causano problemi alla consegna
- Il corriere può rifiutare la spedizione
- Problemi fiscali/legali

**Cosa fare invece:**

- Compila sempre tutti i campi correttamente
- Verifica dati con il cliente prima di salvare
- Se non hai un dato, chiedilo al cliente (non inventare)

### 7.8 NON aspettare approvazione ricarica all'ultimo minuto

**Cosa NON fare:**

- Ricaricare solo quando il wallet è a €0
- Aspettare approvazione per spedire urgente
- Contare su approvazione immediata

**Perché:**

- L'approvazione non è automatica
- Può richiedere ore o giorni
- Blocchi le spedizioni in attesa

**Cosa fare invece:**

- Ricarica sempre in anticipo
- Mantieni buffer di sicurezza
- Pianifica le ricariche settimanali/mensili

---

## Appendice: Riferimenti Tecnici

### URL Principali

- Login: `spediresicuro.it/login`
- Dashboard: `spediresicuro.it/dashboard`
- Lista Spedizioni: `spediresicuro.it/dashboard/spedizioni`
- Nuova Spedizione: `spediresicuro.it/dashboard/spedizioni/nuova`
- Wallet: `spediresicuro.it/dashboard/wallet`
- Dati Cliente: `spediresicuro.it/dashboard/dati-cliente`
- Tracking: `spediresicuro.it/track/[trackingId]`

### Status Spedizione

- `in_preparazione`: Appena creata, non ancora spedita
- `in_transito`: Spedita, in viaggio
- `consegnata`: Consegnata al destinatario
- `eccezione`: Problema (indirizzo errato, destinatario assente, etc.)
- `annullata`: Cancellata

### Corrieri Supportati

- GLS
- SDA
- Bartolini
- Poste Italiane

### Tipi Spedizione

- Standard: normale
- Express: urgente (+50% costo)
- Assicurata: con assicurazione (+30% costo)

### Limiti Wallet

- Max €10.000 per singola operazione
- Max €100.000 saldo totale
- Saldo minimo: €0 (non può essere negativo)

---

## Changelog

**Versione 1.0** (28/12/2025)

- Prima versione manuale operativo
- Basato su codebase reale
- Zero assunzioni, solo funzionalità verificate

---

**Fine Manuale**
