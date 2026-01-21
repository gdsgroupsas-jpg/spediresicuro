# 🔐 Setup Microsoft Authenticator per Automation

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## 🎯 COSA È MICROSOFT AUTHENTICATOR

Microsoft Authenticator è un'app per smartphone che genera codici OTP (One-Time Password) a 6 cifre per la verifica in due passaggi.

**Differenza con Email 2FA:**

- ❌ **Email 2FA**: L'agent legge codice da email automaticamente
- ✅ **Microsoft Authenticator**: Devi inserire codice manualmente quando richiesto

---

## ⚙️ CONFIGURAZIONE

### **1. Nella Dashboard Automation**

1. Vai su `/dashboard/admin/automation`
2. Clicca **"Settings"** sulla configurazione Spedisci.Online
3. In **"Metodo 2FA"**, seleziona: **"Manuale (Microsoft Authenticator)"**
4. Compila:
   - **Spedisci.Online Username**: Il tuo username
   - **Spedisci.Online Password**: La tua password
   - **Auto Refresh Interval**: Ore tra sync (default: 24)
5. Clicca **"Salva"**

### **2. Come Funziona**

**Sync Manuale:**

1. Clicca **"Sync"** sulla configurazione
2. L'agent si collega a Spedisci.Online
3. Quando richiede 2FA, appare un **modal** per inserire OTP
4. Apri Microsoft Authenticator sul tuo smartphone
5. Inserisci il codice a 6 cifre nel modal
6. Clicca **"Conferma"**
7. L'agent completa il login e fa sync

**Sync Automatico (Cron):**

- ⚠️ **NON funziona** con Microsoft Authenticator
- ⚠️ Per sync automatico, devi usare Email 2FA
- ⚠️ Con Microsoft Authenticator, solo sync manuale

---

## 📱 COME USARE MICROSOFT AUTHENTICATOR

### **1. Apri App sul Telefono**

- Apri app **Microsoft Authenticator**
- Trova account **Spedisci.Online**
- Vedrai un codice a 6 cifre che cambia ogni 30 secondi

### **2. Durante Sync**

1. Clicca **"Sync"** nella dashboard
2. Quando appare modal OTP:
   - Guarda codice su Microsoft Authenticator
   - Inserisci codice nel modal (6 cifre)
   - Clicca **"Conferma"**

### **3. Se Codice Scade**

- I codici OTP scadono dopo 30 secondi
- Se scade, inserisci il nuovo codice
- Il modal si aggiorna automaticamente

---

## ⚠️ LIMITAZIONI

### **Sync Automatico NON Funziona**

Con Microsoft Authenticator:

- ❌ Sync automatico (cron) **NON funziona**
- ✅ Solo sync **manuale** funziona
- ✅ Devi essere presente per inserire OTP

### **Alternative:**

1. **Usa Email 2FA** (se disponibile):
   - L'agent legge codice automaticamente
   - Sync automatico funziona
   - Nessun intervento manuale

2. **Sync Manuale Periodico**:
   - Fai sync manuale quando necessario
   - Session dura 24h, quindi non serve ogni volta

---

## 🔄 WORKFLOW CONSIGLIATO

### **Opzione 1: Sync Manuale Quando Necessario**

1. Quando session scade (dopo 24h):
   - Vai su dashboard automation
   - Clicca **"Sync"**
   - Inserisci OTP quando richiesto
   - Session aggiornata per altre 24h

2. **Vantaggi:**
   - ✅ Controllo totale
   - ✅ Session sempre aggiornata quando necessario
   - ✅ Nessun sync automatico inutile

### **Opzione 2: Cambia a Email 2FA (Se Possibile)**

Se Spedisci.Online supporta 2FA via email:

1. Cambia metodo 2FA su Spedisci.Online a email
2. Configura automation con Email 2FA
3. Sync automatico funzionerà

---

## 🐛 TROUBLESHOOTING

### **Problema: "Codice OTP non valido"**

**Causa:** Codice scaduto o errato

**Soluzione:**

1. Verifica che codice sia di 6 cifre
2. Inserisci codice più recente (cambia ogni 30 secondi)
3. Verifica che account su Authenticator sia corretto

### **Problema: "Sync automatico non funziona"**

**Causa:** Microsoft Authenticator richiede input manuale

**Soluzione:**

- ✅ Normale, sync automatico NON funziona con Microsoft Authenticator
- ✅ Usa sync manuale quando necessario
- ✅ Oppure cambia a Email 2FA se possibile

### **Problema: "Modal OTP non appare"**

**Causa:** Errore durante sync

**Soluzione:**

1. Controlla logs per errori
2. Verifica che credenziali siano corrette
3. Prova sync di nuovo

---

## ✅ BEST PRACTICES

1. **Sync Manuale Periodico:**
   - Fai sync manuale ogni 24h (quando session scade)
   - Non serve più spesso

2. **Backup Session:**
   - Session dura 24h
   - Se fai sync oggi, non serve domani

3. **Monitoraggio:**
   - Controlla dashboard per vedere quando session scade
   - Fai sync prima che scada

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0
