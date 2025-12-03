# 🔧 Fix: Sistema Non Chiama API Spedisci.Online

## ⚠️ PROBLEMA

Quando crei una spedizione, il sistema:
- ✅ Crea la spedizione localmente
- ✅ Genera il PDF
- ❌ **NON chiama le API di Spedisci.Online**

Invece di creare la LDV via API, fa solo fallback CSV locale.

---

## 🔍 CAUSA

Il sistema registrava il broker Spedisci.Online **SOLO** se il corriere selezionato era esattamente "spedisci_online". Ma nel form puoi selezionare "GLS", "SDA", "Bartolini", ecc., quindi il broker non veniva mai registrato.

---

## ✅ SOLUZIONE IMPLEMENTATA

Ho modificato il codice per registrare **SEMPRE** Spedisci.Online come broker se è configurato, indipendentemente dal corriere scelto.

**File modificato**: `lib/actions/spedisci-online.ts`

Ora il sistema:
1. Prova adapter diretto (se disponibile per il corriere)
2. Se non trova, usa **Spedisci.Online come broker** (se configurato)
3. Se fallisce tutto, fa fallback CSV

---

## 📋 COSA DEVI VERIFICARE

### ✅ Passo 1: Verifica che la Configurazione Esista nel Database

1. Vai su `/dashboard/integrazioni` (o `/dashboard/admin/configurations` se sei admin)
2. Controlla che ci sia una configurazione per **Spedisci.Online**
3. Verifica che sia:
   - ✅ **Attiva** (`is_active = true`)
   - ✅ Ha **API Key** configurata
   - ✅ Ha **Base URL** configurata

### ✅ Passo 2: Verifica che la Tabella Esista

La configurazione deve essere nella tabella `courier_configs` in Supabase.

Per verificare:
1. Vai su **Supabase Dashboard** → **Table Editor**
2. Cerca la tabella `courier_configs`
3. Dovresti vedere almeno una riga con `provider_id = 'spedisci_online'`

Se la tabella non esiste, devi crearla (vedi migration 006 o schema).

### ✅ Passo 3: Testa la Creazione Spedizione

1. Vai su `/dashboard/spedizioni/nuova`
2. Compila tutti i campi
3. Seleziona un corriere (es: "GLS" o "SDA")
4. Clicca "Genera Spedizione"

**Cosa dovrebbe succedere**:
- ✅ Il sistema cerca adapter diretto per "GLS" (non lo trova)
- ✅ Il sistema usa Spedisci.Online come broker
- ✅ Chiama le API di Spedisci.Online
- ✅ Riceve tracking number reale
- ✅ Mostra "LDV Creata con Successo!" con tracking reale

**Se invece vedi**:
- ⚠️ Tracking number generato localmente (tipo "GLS123456789")
- ⚠️ Nessuna chiamata API effettuata
- ⚠️ Messaggio di errore nei log

Significa che:
- La configurazione non è nel database
- O la configurazione non è attiva
- O ci sono errori nelle credenziali

---

## 🐛 DEBUGGING

### Controlla i Log

Dopo aver creato una spedizione, controlla i log su Vercel:

1. Vai su **Vercel Dashboard** → **Deployments** → **Functions** (o **Logs**)
2. Cerca messaggi che iniziano con:
   - `✅ Broker adapter (Spedisci.Online) registrato...` → **OK!**
   - `⚠️ Spedisci.Online non configurato...` → **PROBLEMA!**
   - `❌ Errore registrazione broker adapter...` → **PROBLEMA!**
   - `✅ LDV creata (broker): ...` → **FUNZIONA!**
   - `⚠️ Creazione LDV fallita...` → **PROBLEMA!**

### Messaggi da Cercare

**Se tutto OK, vedrai**:
```
✅ Broker adapter (Spedisci.Online) registrato tramite configurazione DB
✅ LDV creata (broker): ABC123XYZ
```

**Se c'è problema, vedrai**:
```
⚠️ Spedisci.Online non configurato. La spedizione verrà creata solo localmente (fallback CSV).
⚠️ Configura Spedisci.Online in /dashboard/integrazioni per abilitare chiamate API reali.
```

---

## 🔧 COME CONFIGURARE SPEDISCI.ONLINE

Se non hai ancora configurato Spedisci.Online:

1. **Vai su** `/dashboard/integrazioni`
2. **Clicca su** "API Corrieri" o cerca la sezione Spedisci.Online
3. **Inserisci**:
   - API Key
   - Base URL (es: `https://tuodominio.spedisci.online/api/v2/`)
   - Dominio (se richiesto)
   - Contract Mapping (se necessario)
4. **Clicca** "Salva Configurazione"

Dopo aver salvato, la configurazione sarà disponibile per tutte le spedizioni.

---

## ✅ CHECKLIST FINALE

- [ ] Configurazione Spedisci.Online presente nel database
- [ ] Configurazione attiva (`is_active = true`)
- [ ] API Key configurata correttamente
- [ ] Base URL configurata correttamente
- [ ] Test creazione spedizione fatto
- [ ] Log verificati (nessun errore)
- [ ] Tracking number reale ricevuto (non generato localmente)

---

## 🎯 RISULTATO ATTESO

Dopo aver configurato tutto correttamente:

1. Crei una spedizione
2. Il sistema chiama le API di Spedisci.Online
3. Ricevi un tracking number **reale** da Spedisci.Online
4. La LDV viene creata sul sistema Spedisci.Online
5. Vedi "LDV Creata con Successo!" con tracking reale

---

**Ultimo aggiornamento**: 3 Dicembre 2025  
**File modificato**: `lib/actions/spedisci-online.ts`


