# 📋 ISTRUZIONI PER CONFIGURARE IL FILE .env

## 🎯 Obiettivo
Creare il file `.env` nella cartella `automation-service` con i valori corretti dal tuo `.env.local` della root.

## ✅ Metodo Automatico (Consigliato)

### Opzione 1: Script PowerShell
Esegui questo comando nella cartella `automation-service`:

```powershell
.\CONFIGURA_ENV.bat
```

Oppure:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\CONFIGURA_ENV.ps1
```

### Opzione 2: Script Batch
Doppio click su `CONFIGURA_ENV.bat` nella cartella `automation-service`

---

## 📝 Metodo Manuale

Se gli script non funzionano, segui questi passi:

### Passo 1: Apri il file `.env.local` nella root del progetto
Percorso: `d:\spediresicuro-master\.env.local`

### Passo 2: Copia questi valori:
- `NEXT_PUBLIC_SUPABASE_URL` → diventa `SUPABASE_URL` nel .env
- `SUPABASE_SERVICE_ROLE_KEY` → stesso nome
- `DIAGNOSTICS_TOKEN` → stesso nome
- `AUTOMATION_SERVICE_TOKEN` → stesso nome
- `ENCRYPTION_KEY` → stesso nome (⚠️ DEVE essere identico!)

### Passo 3: Genera `CRON_SECRET_TOKEN`
Esegui questo comando PowerShell:

```powershell
$cronToken = -join ((65..90) + (97..122) + (48..57) + (45, 95) | Get-Random -Count 40 | ForEach-Object {[char]$_}); Write-Host "CRON_SECRET_TOKEN=$cronToken"
```

Oppure usa: `.\GENERA_CRON_TOKEN.bat`

### Passo 4: Crea il file `.env`
Nella cartella `automation-service`, crea un file chiamato `.env` (senza estensione) con questo contenuto:

```env
# ============================================
# FILE .env - AUTOMATION-SERVICE
# ============================================

# SUPABASE - OBBLIGATORIO
SUPABASE_URL=VALORE_DA_ENV_LOCAL
SUPABASE_SERVICE_ROLE_KEY=VALORE_DA_ENV_LOCAL

# DIAGNOSTICS - OBBLIGATORIO
DIAGNOSTICS_TOKEN=VALORE_DA_ENV_LOCAL

# AUTOMATION SERVICE - OBBLIGATORIO
AUTOMATION_SERVICE_TOKEN=VALORE_DA_ENV_LOCAL

# CRON - OBBLIGATORIO
CRON_SECRET_TOKEN=TOKEN_GENERATO_QUI

# ENCRYPTION - OBBLIGATORIO
# ⚠️ DEVE ESSERE IDENTICO AL .env.local!
ENCRYPTION_KEY=VALORE_DA_ENV_LOCAL

# SERVER - OPZIONALE
PORT=3000
NODE_ENV=development
```

### Passo 5: Sostituisci i valori
Sostituisci tutti i `VALORE_DA_ENV_LOCAL` con i valori reali dal tuo `.env.local`

---

## ✅ Verifica

Dopo aver creato il file `.env`:

1. **Riavvia il server automation-service:**
   - Premi `Ctrl+C` nel terminale dove gira il server
   - Esegui: `npm start`

2. **Controlla i messaggi:**
   - ✅ Se vedi solo "🚀 Automation Service avviato" → tutto OK!
   - ⚠️ Se vedi ancora warning → controlla che i valori siano corretti

---

## 🔍 Risoluzione Problemi

### Il file .env non viene letto
- Verifica che il file si chiami esattamente `.env` (senza estensione)
- Verifica che sia nella cartella `automation-service`
- Riavvia il server dopo aver creato/modificato il file

### Warning "DIAGNOSTICS_TOKEN non configurato"
- Aggiungi `DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z` nel file `.env`

### Warning "SUPABASE_URL non configurato"
- Verifica che `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` siano presenti nel `.env`
- Copia i valori dal tuo `.env.local`

---

## 📌 Note Importanti

- ⚠️ **ENCRYPTION_KEY** deve essere **IDENTICO** in `.env.local` e `automation-service/.env`
- ⚠️ **AUTOMATION_SERVICE_TOKEN** deve essere **IDENTICO** in `.env.local` e `automation-service/.env`
- ⚠️ **CRON_SECRET_TOKEN** deve essere **DIVERSO** da `AUTOMATION_SERVICE_TOKEN`
- ⚠️ **NON committare** mai il file `.env` (è già in `.gitignore`)
