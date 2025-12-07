# 📖 MANUALE UTENTE - SpediRe Sicuro

**Versione:** 1.0  
**Data:** 7 Dicembre 2025

---

## 📋 INDICE

1. [Panoramica Piattaforma](#panoramica)
2. [Accesso e Autenticazione](#accesso)
3. [Dashboard](#dashboard)
4. [Gestione Spedizioni](#spedizioni)
5. [AI Assistant](#ai-assistant)
6. [Voice Control (Gemini)](#voice-control)
7. [Sistema Wallet](#wallet)
8. [Gestione Utenti e Team](#team)
9. [Listini Prezzi](#listini)
10. [Sistema Reseller](#reseller)
11. [Super Admin](#super-admin)
12. [Impostazioni](#impostazioni)

---

## <a name="panoramica"></a>🎯 1. PANORAMICA PIATTAFORMA

**SpediRe Sicuro** è una piattaforma completa per la gestione di spedizioni, resi e tracking automatizzato con intelligenza artificiale integrata.

### Funzionalità Principali:
- ✅ **Gestione spedizioni** multi-corriere
- ✅ **AI Assistant** per supporto e automazione
- ✅ **Voice Control** con Gemini Live API
- ✅ **Sistema Wallet** per crediti e transazioni
- ✅ **Listini prezzi** personalizzabili
- ✅ **Sistema Reseller** multi-livello
- ✅ **Tracking automatico** delle spedizioni
- ✅ **OCR Scanner** per LDV e resi
- ✅ **Real-time updates** su tutti i dispositivi

### Ruoli Utente:
- **👤 User**: Utente base con accesso alle funzionalità essenziali
- **💼 Reseller**: Può gestire clienti e wallet
- **⭐ Admin**: Gestione team aziendale e listini
- **👑 Super Admin**: Controllo completo della piattaforma

---

## <a name="accesso"></a>🔐 2. ACCESSO E AUTENTICAZIONE

### Come Accedere:

1. **Vai su** `https://tuodominio.com/login`
2. **Scegli metodo di accesso**:
   - Email e password
   - Google OAuth
   - GitHub OAuth

### Registrazione:

1. **Clicca** "Registrati" nella pagina di login
2. **Scegli tipo account**:
   - **Account User**: Funzionalità base
   - **Account Admin**: Accesso completo + killer features
3. **Compila il form**:
   - Email
   - Password (minimo 8 caratteri)
   - Nome e cognome
4. **Conferma email** (se richiesto)

### Reset Password:

1. **Clicca** "Password dimenticata?"
2. **Inserisci email**
3. **Controlla email** per link di reset
4. **Crea nuova password**

---

## <a name="dashboard"></a>📊 3. DASHBOARD

La dashboard è il centro di controllo della piattaforma.

### Elementi Principali:

#### **Sidebar Sinistra (Desktop)**
Navigazione organizzata per sezioni:

**📊 Principale:**
- Dashboard
- Spedizioni
- Nuova Spedizione (CTA)
- AI Assistant
- Voice Control

**💰 Reseller** (solo per reseller):
- I Miei Clienti
- Wallet

**📧 Comunicazioni:**
- Posta

**👤 Il Mio Account** (collassabile):
- Wallet
- Dati Cliente
- Impostazioni
- Integrazioni

**🔧 Amministrazione** (solo admin/superadmin, collassabile):
- Super Admin (solo superadmin)
- Admin Panel
- Team Aziendale
- Listini

#### **Bottom Navigation (Mobile)**
5 pulsanti principali:
- 🏠 Home
- 📦 Spedizioni
- ➕ Nuova (CTA centrale)
- ✉️ Posta
- ☰ Menu

#### **Statistiche Dashboard**
- 📦 **Spedizioni Totali**: Numero totale spedizioni
- ⏱️ **In Transito**: Spedizioni attualmente in viaggio
- ✅ **Consegnate**: Spedizioni completate
- 💰 **Costo Totale**: Spesa totale spedizioni

---

## <a name="spedizioni"></a>📦 4. GESTIONE SPEDIZIONI

### Creare Nuova Spedizione:

1. **Vai su** Dashboard → Nuova Spedizione
2. **Compila dati mittente**:
   - Nome/Ragione sociale
   - Indirizzo completo
   - Email, telefono
3. **Compila dati destinatario**:
   - Nome/Ragione sociale
   - Indirizzo (con autocompletamento CAP)
   - Email, telefono
4. **Inserisci dimensioni pacco**:
   - Peso (kg)
   - Lunghezza, Larghezza, Altezza (cm)
   - Valore dichiarato (opzionale)
5. **Scegli corriere**:
   - Automatico (migliore prezzo)
   - Manuale (seleziona corriere specifico)
6. **Opzioni aggiuntive**:
   - Assicurazione
   - Contrassegno
   - Note per il corriere
7. **Clicca** "Crea Spedizione"

### Visualizzare Spedizioni:

**Dashboard → Spedizioni**

- **Lista completa** spedizioni con:
  - Stato (in transito, consegnata, in attesa)
  - Destinatario
  - Data creazione
  - Tracking number
  - Azioni rapide

**Filtri disponibili:**
- Per stato
- Per corriere
- Per data
- Per destinatario

**Azioni:**
- 👁️ **Visualizza**: Dettagli completi
- 📄 **Stampa etichetta**: Download PDF
- 🔍 **Tracking**: Stato in tempo reale
- 🔄 **Crea reso**: Genera spedizione di ritorno

### Tracking Spedizioni:

**Real-time tracking automatico:**
- Aggiornamenti automatici ogni ora
- Notifiche email agli step importanti
- Storico completo movimenti
- Mappa percorso (se disponibile)

---

## <a name="ai-assistant"></a>🤖 5. AI ASSISTANT

L'AI Assistant è un chatbot intelligente che aiuta con:
- Creazione spedizioni guidata
- Ricerca listini
- Calcolo preventivi
- Supporto generale

### Come Usarlo:

1. **Clicca** su "AI Assistant" nella sidebar
   - O usa il pulsante floating nell'angolo
2. **Scrivi messaggio** nella chat
3. **L'AI risponde** con suggerimenti e azioni

### Esempi di Richieste:

```
"Crea una spedizione per Milano"
"Quanto costa spedire un pacco di 5kg a Roma?"
"Mostrami le spedizioni di oggi"
"Qual è il listino per corriere X?"
```

### Funzionalità:
- ✅ Comprensione linguaggio naturale
- ✅ Accesso al database spedizioni
- ✅ Calcolo preventivi in tempo reale
- ✅ Suggerimenti proattivi
- ✅ Storico conversazioni

---

## <a name="voice-control"></a>🎤 6. VOICE CONTROL (GEMINI)

**Controllo vocale avanzato** con Gemini Live API per operazioni hands-free.

### Come Accedere:

**Dashboard → Voice Control**

### Funzionalità:

**🎯 Voice Operations:**
- Creazione spedizioni a voce
- Tracking spedizioni
- Quotazione preventivi
- Gestione resi
- Apertura ticket

**🔧 Tool Calling:**
- Gemini invoca automaticamente le API
- Crea, traccia, quota via voce
- Feedback vocale in tempo reale

### Come Usare:

1. **Clicca** "Avvia Sessione Live"
2. **Autorizza microfono** quando richiesto
3. **Parla** con Gemini
4. **Ricevi risposta vocale** + azioni automatiche

### Esempi di Comandi:

```
"Crea spedizione per via Roma 20, Milano"
"Traccia spedizione numero ABC123"
"Quanto costa spedire 3 kg a Torino?"
"Registra un reso per tracking XYZ789"
```

### Requisiti:
- ✅ Microfono funzionante
- ✅ Connessione internet stabile
- ✅ Browser compatibile (Chrome, Edge, Firefox)

---

## <a name="wallet"></a>💰 7. SISTEMA WALLET

Il Wallet permette di gestire crediti per spedizioni e servizi premium.

### Come Funziona:

**Dashboard → Wallet**

### Visualizzare Saldo:

La **Balance Card** mostra:
- 💰 Saldo attuale
- 📊 Statistiche (entrate, uscite, media)
- 📈 Grafico andamento

### Ricaricare Wallet:

**Per Utenti Normali:**
1. **Clicca** "Ricarica Wallet"
2. **Seleziona importo**:
   - Quick amounts: €50, €100, €250, €500
   - O inserisci importo custom
3. **Inserisci causale**
4. **Clicca** "Richiedi Ricarica"
5. ⏳ **Attendi approvazione** admin

**Per Admin/SuperAdmin:**
1. **Clicca** "Ricarica Wallet"
2. **Seleziona importo**
3. **Conferma**
4. ✅ **Credito aggiunto immediatamente**

### Storico Transazioni:

**Visualizza:**
- Data e ora
- Tipo (ricarica, spedizione, feature)
- Importo (+ o -)
- Saldo dopo transazione
- Descrizione

**Filtri:**
- Tutte
- Solo entrate
- Solo uscite

### Tipi di Transazione:

| Tipo | Descrizione | Importo |
|------|-------------|---------|
| 🎁 **admin_gift** | Credito regalo admin | + |
| 💳 **recharge** | Ricarica wallet | + |
| 📦 **shipment** | Costo spedizione | - |
| ⭐ **feature** | Acquisto killer feature | - |
| 🔄 **return** | Rimborso/reso | + |
| 💼 **commission** | Commissione reseller | + |

---

## <a name="team"></a>👥 8. GESTIONE UTENTI E TEAM

**Solo per Admin e Super Admin**

### Visualizzare Team:

**Dashboard → Amministrazione → Team Aziendale**

### Aggiungere Membro:

1. **Clicca** "Aggiungi Membro"
2. **Compila dati**:
   - Email
   - Nome
   - Ruolo (user, admin)
   - Password temporanea
3. **Clicca** "Crea Utente"
4. 📧 **Email automatica** inviata all'utente

### Gestire Permessi:

**Ruoli disponibili:**
- **User**: Accesso base
- **Admin**: Gestione team + listini
- **Super Admin**: Controllo totale

**Killer Features** (servizi premium):
- Scanner LDV Import
- Multi-Level Admin
- OCR Resi
- Real-time Sync
- (altre features configurabili)

### Modificare Utente:

1. **Trova utente** nella lista
2. **Clicca** icona ✏️ modifica
3. **Cambia dati**:
   - Ruolo
   - Stato (attivo/bannato)
   - Killer features
4. **Salva modifiche**

### Eliminare Utente:

1. **Clicca** icona 🗑️ elimina
2. **Conferma eliminazione**
3. ⚠️ **Attenzione**: azione irreversibile

---

## <a name="listini"></a>💵 9. LISTINI PREZZI

**Solo per Admin e Super Admin**

### Visualizzare Listini:

**Dashboard → Amministrazione → Listini**

### Creare Nuovo Listino:

1. **Clicca** "Crea Listino"
2. **Compila dati**:
   - **Nome**: es. "Listino Express 2025"
   - **Versione**: es. "1.0"
   - **Corriere**: Seleziona da dropdown
   - **Stato**: Attivo/Bozza
   - **Priorità**: 1-100 (default 50)
   - **Globale**: ✅ Applicabile a tutti
   - **Date validità**: Dal - Al
   - **Descrizione**: Note interne
3. **Aggiungi fasce peso**:
   - Peso da (kg)
   - Peso a (kg)
   - Prezzo (€)
4. **Clicca** "Salva Listino"

### Modificare Listino:

1. **Trova listino** nella lista
2. **Clicca** ✏️ Modifica
3. **Cambia dati** necessari
4. **Salva**

### Disattivare Listino:

1. **Apri listino**
2. **Cambia stato** a "Inattivo"
3. **Salva**

### Come Funzionano i Listini:

**Priorità:**
- Listino con priorità più alta vince
- A parità di priorità, il più recente

**Globale vs Specifico:**
- **Globale ✅**: Tutti gli utenti
- **Globale ❌**: Solo utenti specifici

**Fasce Peso:**
- Automaticamente ordinate per peso
- Interpolazione tra fasce
- Prezzo calcolato al kg o fisso

---

## <a name="reseller"></a>💼 10. SISTEMA RESELLER

**Per utenti con ruolo Reseller**

### Come Diventare Reseller:

1. Contatta un **Super Admin**
2. L'admin attiva il flag `is_reseller`
3. Accedi alle funzionalità reseller

### Gestire Clienti:

**Dashboard → Reseller → I Miei Clienti**

**Visualizza:**
- Lista clienti
- Saldo wallet cliente
- Spedizioni totali cliente
- Ultima attività

**Azioni:**
- Ricarica wallet cliente
- Visualizza statistiche dettagliate
- Gestisci permessi

### Wallet Reseller:

**Dashboard → Reseller → Wallet**

**Specifiche reseller:**
- 💰 Guadagni commissioni sulle spedizioni clienti
- 📊 Statistiche separate da wallet personale
- 🔄 Ricarica wallet clienti direttamente
- 📈 Report mensili guadagni

### Commissioni:

**Come funziona:**
1. Cliente crea spedizione
2. Sistema calcola costo
3. **Commissione reseller** detratta automaticamente
4. Commissione accreditata al reseller

**Configurable da Super Admin:**
- Percentuale commissione
- Tipo commissione (fissa/percentuale)
- Limiti minimi/massimi

---

## <a name="super-admin"></a>👑 11. SUPER ADMIN

**Funzionalità esclusive Super Admin**

### Dashboard Super Admin:

**Dashboard → Amministrazione → Super Admin**

### Creare Reseller:

1. **Clicca** "Crea Reseller"
2. **Compila form**:
   - Email
   - Nome completo
   - Password (generata automaticamente o custom)
   - **Credito iniziale**:
     - Quick amounts: €0, €50, €100, €250, €500, €1000
     - O importo custom
   - Note interne
3. **Clicca** "Crea Reseller"
4. 📧 Email automatica con credenziali

**Cosa succede:**
- ✅ Utente creato con `is_reseller = true`
- ✅ Wallet attivato con credito iniziale
- ✅ Transazione wallet registrata
- ✅ Accesso sezione "Reseller" nella sidebar

### Gestire Killer Features:

**Attivare feature per utente:**
1. Vai su Team Aziendale
2. Trova utente
3. Clicca "Gestisci Features"
4. Seleziona features da attivare
5. Salva

**Killer Features disponibili:**
- 📷 LDV Scanner Import
- 👥 Multi-Level Admin
- 🔄 Realtime Sync
- 📱 OCR Resi
- (altre configurabili)

### Statistiche Globali:

**Visualizza:**
- 👥 Utenti totali (user/admin/reseller)
- 📦 Spedizioni totali
- 💰 Revenue totale
- 📊 Grafici andamento

### Configurazione Sistema:

**Impostazioni globali:**
- Commissioni reseller default
- Listini base
- Email templates
- Integrazioni corrieri

---

## <a name="impostazioni"></a>⚙️ 12. IMPOSTAZIONI

### Dati Cliente:

**Dashboard → Il Mio Account → Dati Cliente**

**Compila/Modifica:**
- Ragione sociale
- Partita IVA / Codice Fiscale
- Indirizzo sede legale
- Telefono
- Email fatturazione
- PEC
- Codice SDI

### Impostazioni Account:

**Dashboard → Il Mio Account → Impostazioni**

**Gestisci:**
- 🔐 Password
- 📧 Email principale
- 🔔 Notifiche (email/push)
- 🌐 Lingua interfaccia
- 🎨 Tema (chiaro/scuro)

### Integrazioni:

**Dashboard → Il Mio Account → Integrazioni**

**Configura API corrieri:**

**Spedisci.Online:**
1. Inserisci username
2. Inserisci password
3. Testa connessione
4. Salva

**Altri corrieri:**
- DHL: API Key + Account Number
- UPS: API Key + Access License
- FedEx: API Key + Meter Number
- BRT: Username + Password

**IMAP Email (per tracking):**
- Server IMAP
- Porta
- Email
- Password
- Cartella monitoraggio

---

## 🆘 SUPPORTO E ASSISTENZA

### Contatti:

**Email**: supporto@spediresicuro.it  
**Orari**: Lunedì - Venerdì, 9:00 - 18:00

### Risorse:

- 📖 **Questo manuale**: Guida completa
- 🤖 **AI Assistant**: Supporto 24/7 in app
- 🎤 **Voice Control**: Aiuto vocale
- 📧 **Email support**: supporto@spediresicuro.it

### FAQ Rapide:

**Q: Come resetto la password?**  
A: Clicca "Password dimenticata?" nella pagina login

**Q: Posso cambiare corriere dopo aver creato la spedizione?**  
A: No, devi creare una nuova spedizione

**Q: Quanto tempo ci vuole per ricaricare il wallet?**  
A: Admin approva in max 24h (feriali)

**Q: Posso tracciare spedizioni di altri corrieri?**  
A: Sì, inserisci tracking number nella ricerca

**Q: Come attivo una killer feature?**  
A: Contatta un Super Admin

---

## 📝 CHANGELOG

### Versione 1.0 (7 Dicembre 2025)
- ✅ Release iniziale manuale
- ✅ Documentazione completa funzionalità
- ✅ Sezioni per tutti i ruoli

---

**© 2025 SpediRe Sicuro - Tutti i diritti riservati**
