# 🔧 ISTRUZIONI PUSH MANUALE - FIX ACCOUNTTYPE

## ✅ MODIFICHE COMPLETATE

Le seguenti modifiche sono state completate nel codice:

### 1. File Modificati:
- ✅ `components/dashboard-nav.tsx` (linee 325 e 441)
- ✅ `supabase/migrations/021_verify_fix_account_type_config.sql` (nuovo file)

### 2. Modifiche Applicate:
- **Desktop (linea 325)**: Cambiato da `userRole === 'admin'` a `(userRole === 'admin' || accountType === 'admin' || accountType === 'superadmin')`
- **Mobile (linea 441)**: Stessa modifica applicata
- **Badge Superadmin (linea 215)**: Già corretto e funzionante
- **Script SQL**: Creato per verificare e fixare configurazioni account_type in Supabase

---

## 📋 COMANDI PER COMMIT E PUSH MANUALE

Apri PowerShell o CMD e esegui questi comandi **uno alla volta**:

### 1. Vai nella directory del progetto:
```powershell
cd d:\spediresicuro-master
```

### 2. Configura Git (se non già fatto):
```powershell
git config user.name "gdsgroupsas-jpg"
git config user.email "gdsgroupsas-jpg@users.noreply.github.com"
```

### 3. Verifica stato repository:
```powershell
git status
```

### 4. Aggiungi i file modificati:
```powershell
git add components/dashboard-nav.tsx
git add supabase/migrations/021_verify_fix_account_type_config.sql
```

### 5. Verifica file in staging:
```powershell
git status
```

### 6. Fai commit:
```powershell
git commit -m "Fix: Aggiunto controllo accountType per accesso sezione Admin e script SQL di verifica

- Modificato dashboard-nav.tsx per controllare accountType (admin/superadmin) oltre a userRole
- Applicato fix sia per versione desktop (linea 325) che mobile (linea 441)
- Creato script SQL 021_verify_fix_account_type_config.sql per verificare e fixare configurazioni account_type in Supabase
- Lo script verifica ENUM, colonne, fixa inconsistenze e genera report statistiche"
```

### 7. Push su GitHub:
```powershell
git push origin master
```

---

## ⚠️ SE IL PUSH CHIEDE AUTENTICAZIONE

1. **Vai su:** https://github.com/settings/tokens
2. **Clicca:** "Generate new token (classic)"
3. **Nome token:** `SpedireSicuro Push`
4. **Seleziona permessi:** `repo` (tutti i permessi)
5. **Clicca:** "Generate token"
6. **COPIA il token** (lo vedi solo una volta!)
7. **Quando Git chiede password:**
   - Username: `gdsgroupsas-jpg`
   - Password: **incolla il TOKEN** (NON la password di GitHub!)

---

## 🔍 VERIFICA CHE SIA ANDATO A BUON FINE

Dopo il push, verifica su GitHub:
- URL: https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
- Dovresti vedere il nuovo commit con il messaggio "Fix: Aggiunto controllo accountType..."

---

## 📝 ALTERNATIVA: USA GLI SCRIPT BATCH

Se preferisci, puoi eseguire direttamente:

```powershell
# Script PowerShell
powershell -ExecutionPolicy Bypass -File "d:\spediresicuro-master\commit-push-fix-completo.ps1"

# OPPURE script Batch
d:\spediresicuro-master\FIX-GIT-PUSH-DEFINITIVO.bat
```

---

## ✅ VERIFICA FINALE

Dopo il push, verifica che:
1. ✅ La sezione "Admin" appare nel menu se `accountType === 'superadmin'` o `accountType === 'admin'`
2. ✅ Il badge `👑 SUPERADMIN` è visibile quando `accountType === 'superadmin'`
3. ✅ Le modifiche sono su GitHub nel branch master

---

## 🆘 PROBLEMI COMUNI

### "Nothing to commit"
- Significa che le modifiche sono già state committate
- Verifica con `git log -1` se l'ultimo commit contiene le modifiche

### "Authentication failed"
- Usa Personal Access Token invece della password
- Segui le istruzioni sopra per creare il token

### "Connection timeout"
- Verifica la connessione internet
- Riprova dopo qualche minuto

### "Branch is ahead"
- Significa che hai commit locali non pushati
- Esegui `git push origin master` per sincronizzare

---

**Ultimo aggiornamento:** 6 Dicembre 2025

