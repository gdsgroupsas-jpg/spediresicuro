# 📖 Manuale Utente - Gestione Bonifici Admin

**Versione:** 1.0  
**Data:** 2025-01  
**Per:** Admin e SuperAdmin

---

## 🎯 COSA FA QUESTA FUNZIONE?

La pagina **Gestione Bonifici** ti permette di:

- ✅ Vedere tutte le richieste di ricarica wallet via bonifico
- ✅ Approvare o rifiutare le richieste
- ✅ Controllare importi, utenti e ricevute

---

## 🚀 COME ACCEDERE

1. Fai login come **Admin** o **SuperAdmin**
2. Vai su: `/dashboard/admin/bonifici`
3. Oppure clicca su "Bonifici" nel menu admin (se presente)

---

## 📋 COME FUNZIONA

### Tab "In Attesa" (Pending)

Mostra tutte le richieste **non ancora processate**.

**Cosa vedi:**

- **Data:** Quando è stata creata la richiesta
- **Utente:** Email e nome dell'utente che ha fatto la richiesta
- **Importo:** Quanto vuole ricaricare (es. €100.00)
- **Stato:** Badge giallo "In Attesa"
- **AI Conf:** Percentuale di confidenza AI (se disponibile)
- **Azioni:** Bottone "Dettagli"

---

### Tab "Revisione" (Manual Review)

Mostra richieste che richiedono **controllo manuale** (es. AI confidence bassa).

**Stessa struttura** della tab "In Attesa".

---

### Tab "Approvate"

Mostra tutte le richieste **già approvate**.

**Cosa vedi:**

- Stessa struttura delle altre tab
- Badge verde "Approvata"
- Se l'importo approvato è diverso da quello richiesto, vedi: `(Approvato: €X)`

---

### Tab "Rifiutate"

Mostra tutte le richieste **rifiutate**.

**Cosa vedi:**

- Badge rosso "Rifiutata"
- Stessa struttura delle altre tab

---

## ✅ COME APPROVARE UNA RICHIESTA

### Step 1: Apri Dettagli

1. Vai su tab **"In Attesa"** o **"Revisione"**
2. Trova la richiesta che vuoi approvare
3. Clicca su **"Dettagli"**

### Step 2: Controlla Informazioni

Nel modal vedi:

- **Utente:** Nome e email
- **Importo Richiesto:** Quanto ha chiesto l'utente
- **Confidenza AI:** Barra di confidenza (verde = alta, giallo = media, rosso = bassa)
- **Ricevuta Bonifico:** Link "Apri ricevuta" per vedere il file

### Step 3: Imposta Importo (Opzionale)

- **Se vuoi approvare l'importo richiesto:** Lascia il campo "Importo da Accreditare" vuoto
- **Se vuoi approvare un importo diverso:** Inserisci l'importo (es. 80.00 invece di 100.00)

**Esempio:**

- Utente chiede: €100.00
- Tu approvi: €80.00
- Il wallet riceverà €80.00

### Step 4: Clicca "Approva"

1. Clicca sul bottone verde **"Approva"**
2. Attendi il messaggio di successo
3. La richiesta sparisce da "In Attesa" e appare in "Approvate"
4. Il wallet dell'utente viene accreditato automaticamente

**Cosa succede:**

- ✅ Status cambia a "Approvata"
- ✅ Wallet utente aumenta dell'importo approvato
- ✅ Viene creata una transazione nel wallet
- ✅ Viene scritto un log di audit

---

## ❌ COME RIFIUTARE UNA RICHIESTA

### Step 1: Apri Dettagli

Stesso procedimento dell'approvazione.

### Step 2: Inserisci Motivo

Nel campo **"Note / Motivo Rifiuto"** scrivi il motivo (es. "Ricevuta non leggibile", "Importo non corrispondente", ecc.)

**⚠️ IMPORTANTE:** Il campo è obbligatorio. Non puoi rifiutare senza motivo.

### Step 3: Clicca "Rifiuta"

1. Clicca sul bottone rosso **"Rifiuta"**
2. Attendi il messaggio di successo
3. La richiesta sparisce da "In Attesa" e appare in "Rifiutate"

**Cosa succede:**

- ✅ Status cambia a "Rifiutata"
- ✅ Il wallet dell'utente NON viene accreditato
- ✅ Viene scritto un log di audit con il motivo

---

## 🔍 COME CERCARE UNA RICHIESTA

1. Usa la **barra di ricerca** in alto
2. Inserisci:
   - Email utente (es. `mario@example.com`)
   - Nome utente (es. `Mario Rossi`)
   - Parte dell'email o nome
3. Premi **Invio** o clicca **"Aggiorna"**

**Risultato:** Vedi solo le richieste che corrispondono alla ricerca.

---

## ⚠️ REGOLE IMPORTANTI

### ✅ Puoi Fare

- Approvare richieste con importo diverso da quello richiesto
- Rifiutare richieste con motivo
- Vedere tutte le richieste (anche passate)
- Cercare per email/nome utente

### ❌ Non Puoi Fare

- Approvare una richiesta già approvata (vedi errore "Richiesta già processata")
- Approvare senza controllare la ricevuta
- Rifiutare senza motivo
- Modificare una richiesta già processata

---

## 🐛 PROBLEMI COMUNI

### "Richiesta già processata"

**Causa:** Stai cercando di approvare/rifiutare una richiesta già processata.

**Soluzione:** Vai nella tab corretta ("Approvate" o "Rifiutate") per vedere lo stato.

---

### "Importo non valido"

**Causa:** Hai inserito un importo < 0.01 o > 10.000

**Soluzione:** Inserisci un importo tra €0.01 e €10.000

---

### "Solo gli Admin possono..."

**Causa:** Il tuo account non ha permessi admin.

**Soluzione:** Contatta un SuperAdmin per ottenere i permessi.

---

### Email/Nome Utente Non Visibile

**Causa:** L'utente esiste solo in `auth.users` ma non in `public.users`.

**Soluzione:** Il sistema recupera automaticamente l'email da `auth.users`. Se non appare, l'utente potrebbe non avere email configurata.

---

## 📊 COSA VEDERE NEI DETTAGLI

Quando apri "Dettagli" di una richiesta, vedi:

### Se Status = "In Attesa" o "Revisione"

- ✅ Bottone **"Approva"** (verde)
- ✅ Bottone **"Rifiuta"** (rosso)
- ✅ Campo "Importo da Accreditare" (modificabile)
- ✅ Campo "Note / Motivo Rifiuto" (obbligatorio per rifiuto)

### Se Status = "Approvata"

- ✅ Info box verde con:
  - Data approvazione
  - Importo accreditato
- ❌ Nessun bottone azione

### Se Status = "Rifiutata"

- ✅ Info box rosso con motivo
- ❌ Nessun bottone azione

---

## 🎓 ESEMPI PRATICI

### Esempio 1: Approvazione Standard

1. Utente carica ricevuta bonifico per €100.00
2. Tu apri "Dettagli"
3. Controlli la ricevuta (link "Apri ricevuta")
4. Verifichi che corrisponda a €100.00
5. Clicchi "Approva" (senza modificare importo)
6. ✅ Wallet utente aumenta di €100.00

---

### Esempio 2: Approvazione con Importo Diverso

1. Utente carica ricevuta per €100.00
2. Tu apri "Dettagli"
3. Controlli la ricevuta
4. Vedi che in realtà è €80.00
5. Modifichi "Importo da Accreditare" a 80.00
6. Clicchi "Approva"
7. ✅ Wallet utente aumenta di €80.00 (non €100.00)

---

### Esempio 3: Rifiuto

1. Utente carica ricevuta per €100.00
2. Tu apri "Dettagli"
3. Controlli la ricevuta
4. Vedi che è illeggibile o non corrisponde
5. Inserisci motivo: "Ricevuta non leggibile"
6. Clicchi "Rifiuta"
7. ✅ Richiesta rifiutata, wallet NON aumenta

---

## 🔐 SICUREZZA

- ✅ Ogni approvazione/rifiuto viene registrato in audit log
- ✅ Non puoi approvare due volte la stessa richiesta
- ✅ Se l'accredito fallisce, la richiesta torna a "In Attesa"
- ✅ Solo Admin/SuperAdmin possono accedere

---

## 📞 SUPPORTO

Se hai problemi:

1. Controlla questo manuale
2. Verifica i "Problemi Comuni" sopra
3. Contatta il team tecnico

---

**Fine Manuale**
