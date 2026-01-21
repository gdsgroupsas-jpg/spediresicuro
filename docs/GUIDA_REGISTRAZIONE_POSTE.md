# 📋 Guida: Registrazione Applicazione Poste Delivery Business

## 🎯 Obiettivo

Registrare la tua applicazione nel portale Poste Delivery Business per ottenere **Client ID** e **Secret ID** validi per l'integrazione API.

---

## 📍 Step 1: Accesso al Portale Poste

### 1.1 Accedi al Portale Poste Delivery Business

1. Vai al portale: **https://portale.postedeliverybusiness.it** (o URL fornito da Poste)
2. Effettua il login con le credenziali del tuo account aziendale Poste
3. Se non hai ancora un account, contatta il supporto Poste per richiedere l'accesso

### 1.2 Verifica Permessi

Assicurati di avere i permessi per:

- ✅ Creare applicazioni API
- ✅ Gestire credenziali OAuth
- ✅ Accedere alle API Waybill Services

---

## 🔐 Step 2: Registrazione Applicazione

### 2.1 Crea Nuova Applicazione

1. Nel portale, vai su **"Gestione Applicazioni"** o **"API Management"**
2. Clicca su **"Nuova Applicazione"** o **"Registra App"**
3. Compila il form con:

   **Nome Applicazione:**

   ```
   SpedireSicuro - Integrazione API
   ```

   **Descrizione:**

   ```
   Applicazione per integrazione spedizioni tramite API Poste Delivery Business
   ```

   **Tipo Applicazione:**
   - Seleziona **"API Application"** o **"Server Application"**
   - ⚠️ **NON** selezionare "Single Page Application" o "Mobile App"

### 2.2 Configura OAuth2

1. Nella sezione **"Autenticazione"** o **"OAuth Settings"**:

   **Grant Type:**
   - ✅ Abilita **"Client Credentials"** (OAuth2 flow)
   - ❌ NON abilitare "Authorization Code" o "Implicit"

   **Redirect URI:**
   - Per applicazioni server-side, di solito non è richiesto per Client Credentials
   - Se richiesto, inserisci: `https://spediresicuro.vercel.app/api/auth/callback`

2. **Scope/Permessi API:**
   - Cerca e seleziona: **"Waybill Services"** o **"Postal Logistics API"**
   - Verifica che lo scope sia: `api://8f0f2c58-19a8-45ef-9f9e-8ccb0acc7657/.default`
   - Se non vedi questo scope esatto, seleziona tutti i permessi disponibili per "Waybill" o "Spedizioni"

### 2.3 Salva e Ottieni Credenziali

1. Clicca su **"Salva"** o **"Crea Applicazione"**
2. Dopo la creazione, il portale mostrerà:
   - ✅ **Client ID** (Application ID)
   - ✅ **Secret ID** (Client Secret)

   ⚠️ **IMPORTANTE:**
   - Il **Secret ID** viene mostrato **UNA SOLA VOLTA**
   - Copialo immediatamente in un posto sicuro
   - Se lo perdi, dovrai rigenerarlo

---

## 📝 Step 3: Configurazione CDC (Codice Conto)

### 3.1 Verifica CDC

1. Nel portale, vai su **"Contratti"** o **"Account Settings"**
2. Trova il tuo **CDC (Codice Conto)** o **Codice Cliente**
3. Esempio: `CDC-00038791`

### 3.2 Associa CDC all'Applicazione

1. Nella configurazione dell'applicazione, cerca **"Contract Mapping"** o **"CDC Association"**
2. Inserisci il tuo CDC
3. Salva le modifiche

---

## ✅ Step 4: Verifica Configurazione

### 4.1 Controlla Dettagli Applicazione

Nel portale, verifica che l'applicazione abbia:

- ✅ **Status:** Attiva
- ✅ **Client ID:** Presente (es: `h41lyNNkTGg6VdfqM1mbyQ==...`)
- ✅ **Secret ID:** Presente (es: `qcYhj1jgQRNrsXZQJfxQ43BLnk46iHM3rcoOShAUaRA...`)
- ✅ **Grant Type:** Client Credentials abilitato
- ✅ **Scope:** Waybill Services / Postal Logistics API
- ✅ **CDC:** Associato correttamente

### 4.2 Test Autenticazione (Opzionale)

Puoi testare l'autenticazione direttamente dal portale se c'è una sezione "Test API" o "API Console".

---

## 🔧 Step 5: Configurazione in SpedireSicuro

### 5.1 Usa il Wizard di Configurazione

1. Vai su **`/dashboard/integrazioni`**
2. Clicca su **"Configura Poste Italiane"**
3. Inserisci i dati:

   **Client ID:**

   ```
   [Incolla il Client ID dal portale Poste]
   ```

   **Secret ID:**

   ```
   [Incolla il Secret ID dal portale Poste]
   ```

   **Base URL:**

   ```
   https://apiw.gp.posteitaliane.it/gp/internet
   ```

   (o l'URL fornito da Poste)

   **CDC (Codice Conto):**

   ```
   CDC-00038791
   ```

   (il tuo codice CDC)

4. Clicca su **"Testa e Salva"**

### 5.2 Verifica Test

Se il test passa:

- ✅ Le credenziali sono corrette
- ✅ L'applicazione è registrata correttamente
- ✅ Puoi iniziare a creare spedizioni

Se il test fallisce:

- ❌ Verifica che Client ID e Secret ID siano corretti
- ❌ Controlla che l'applicazione sia attiva nel portale
- ❌ Verifica che lo scope sia configurato correttamente

---

## 🚨 Problemi Comuni

### Errore: "Application not found in directory"

**Causa:** Client ID non valido o applicazione non registrata nel tenant corretto.

**Soluzione:**

1. Verifica che il Client ID sia quello esatto dal portale
2. Controlla che l'applicazione sia nel tenant "Poste Italiane S.p.A."
3. Se hai più tenant, assicurati di usare quello corretto

### Errore: "Invalid client secret"

**Causa:** Secret ID errato o scaduto.

**Soluzione:**

1. Verifica di aver copiato correttamente il Secret ID
2. Se hai rigenerato il Secret, usa quello nuovo
3. Controlla che non ci siano spazi o caratteri nascosti

### Errore: "Insufficient permissions"

**Causa:** Scope/Permessi API non configurati correttamente.

**Soluzione:**

1. Nel portale, verifica che l'applicazione abbia i permessi per "Waybill Services"
2. Controlla che lo scope sia: `api://8f0f2c58-19a8-45ef-9f9e-8ccb0acc7657/.default`
3. Se necessario, richiedi permessi aggiuntivi al supporto Poste

---

## 📞 Supporto

Se hai problemi con la registrazione:

1. **Contatta Supporto Poste:**
   - Email: supporto.postedeliverybusiness@poste.it
   - Telefono: (verifica sul portale)

2. **Documentazione Poste:**
   - Cerca "Poste Delivery Business API Manual" nel portale
   - Sezione "Application Registration"

3. **Verifica Log:**
   - Controlla i log di Vercel per errori dettagliati
   - I messaggi di errore ora sono più chiari e indicano il problema specifico

---

## ✅ Checklist Finale

Prima di testare l'integrazione, verifica:

- [ ] Applicazione registrata nel portale Poste
- [ ] Client ID copiato correttamente
- [ ] Secret ID copiato correttamente (e salvato in modo sicuro)
- [ ] CDC (Codice Conto) verificato e associato
- [ ] Grant Type "Client Credentials" abilitato
- [ ] Scope/Permessi API configurati
- [ ] Configurazione salvata in SpedireSicuro tramite wizard
- [ ] Test di autenticazione passato

---

## 📚 Note Tecniche

### Endpoint Autenticazione

Il sistema prova automaticamente questi endpoint:

1. `/user/sessions`
2. `/oauth/token`
3. `/auth/token`

### Scope OAuth2

Lo scope utilizzato è:

```
api://8f0f2c58-19a8-45ef-9f9e-8ccb0acc7657/.default
```

Questo è lo scope standard per Poste Delivery Business API.

### Base URL

URL di produzione tipico:

```
https://apiw.gp.posteitaliane.it/gp/internet
```

URL di sviluppo/test (se disponibile):

```
https://apid.gp.posteitaliane.it/dev/kindergarden
```

---

**Ultimo aggiornamento:** 12 Dicembre 2025
