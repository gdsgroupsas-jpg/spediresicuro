# 📖 Istruzioni Sistema Admin/User - Guida Completa

## 🎯 Cosa Abbiamo Fatto

Ho implementato il sistema per distinguere tra **Account User** e **Account Admin**, con supporto per la gerarchia multi-livello degli admin.

---

## ✨ Funzionalità Implementate

### 1. **Scelta Tipo Account in Registrazione**
Quando un utente si registra, ora può scegliere:
- ✅ **Account User**: Esperienza base con funzionalità essenziali
- ✅ **Account Admin**: Accesso completo + killer features

### 2. **Sistema Gerarchico Admin**
- ✅ Un admin può avere sotto-admin
- ✅ Fino a 5 livelli di profondità
- ✅ Superadmin che gestisce tutto

### 3. **Killer Feature Multi-Livello Admin**
- ✅ Creata la killer feature `multi_level_admin`
- ✅ Gli admin possono acquistarla per creare sotto-admin
- ✅ L'admin superiore può acquistarla per i suoi sotto-admin

---

## 📋 Cosa Devi Fare Ora

### **STEP 1: Esegui la Migration SQL** ⚠️ IMPORTANTE

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/migrations/008_admin_user_system.sql`
3. Copia tutto il contenuto
4. Incollalo nell'editor SQL di Supabase
5. Clicca **Run** o **Esegui**

Questa migration aggiunge:
- Campi alla tabella `users` (account_type, parent_admin_id, admin_level)
- Funzioni SQL per gestire la gerarchia
- La killer feature `multi_level_admin`

### **STEP 2: Crea il Superadmin** ⚠️ IMPORTANTE

Dopo la migration, crea o promuovi un superadmin:

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/migrations/009_create_superadmin.sql`
3. **Modifica l'email** nel file (sostituisci `admin@spediresicuro.it` con la tua email superadmin)
4. Copia tutto il contenuto
5. Incollalo nell'editor SQL di Supabase
6. Clicca **Run** o **Esegui**

Il superadmin può:
- Gestire tutti gli utenti e admin
- Attivare/disattivare killer features per chiunque
- Creare admin di livello 1

### **STEP 3: Verifica che Funzioni** ✅

1. Vai su **Supabase Dashboard** → **Table Editor** → **users**
2. Verifica che ci siano le colonne:
   - `account_type`
   - `parent_admin_id`
   - `admin_level`
3. Verifica che esista la killer feature:
   - Vai su **Table Editor** → **killer_features**
   - Cerca `multi_level_admin`

---

## 🎨 Come Funziona la Registrazione

Quando un nuovo utente si registra:

1. **Compila i dati** (nome, email, password)
2. **Sceglie il tipo account**:
   - **Account User**: Per utenti normali
   - **Account Admin**: Per amministratori
3. **Clicca "Registrati"**
4. Il sistema salva l'utente con il tipo account scelto

---

## 🏗️ Struttura Gerarchica

```
Superadmin (livello 0)
  └── Admin A (livello 1)
       └── Admin B (livello 2)
            └── Admin C (livello 3)
                 └── Admin D (livello 4)
                      └── Admin E (livello 5) ← MASSIMO
```

**Regole:**
- Max 5 livelli di profondità
- Ogni admin può avere illimitati sotto-admin (solo limite profondità)
- La killer feature `multi_level_admin` permette di creare sotto-admin

---

## 📁 File Creati/Modificati

### **Nuovi File:**
1. ✅ `supabase/migrations/008_admin_user_system.sql` - Migration principale
2. ✅ `supabase/migrations/009_create_superadmin.sql` - Script creazione superadmin
3. ✅ `RIEPILOGO_SISTEMA_ADMIN_USER.md` - Documentazione tecnica
4. ✅ `ISTRUZIONI_SISTEMA_ADMIN_USER.md` - Questo file

### **File Modificati:**
1. ✅ `app/login/page.tsx` - Form registrazione con scelta account type
2. ✅ `app/api/auth/register/route.ts` - API che accetta accountType
3. ✅ `lib/database.ts` - Funzione createUser aggiornata

---

## ⏭️ Prossimi Sviluppi (Non Ancora Fatto)

Questo è quello che faremo dopo:

1. **UI Gestione Sotto-Admin**
   - Dashboard per admin con lista sotto-admin
   - Creazione nuovo sotto-admin
   - Statistiche per gerarchia

2. **Server Actions**
   - Funzione per creare sotto-admin
   - Verifica permessi gerarchici

3. **OCR per Resi**
   - Scanner fotocamera per documenti reso
   - Estrazione dati automatica

---

## ❓ Domande Frequenti

### **Come creo un sotto-admin?**
Per ora non è ancora implementato. Lo faremo dopo, ma il sistema è già pronto per gestirlo.

### **Cosa succede agli utenti esistenti?**
- Gli utenti con `role='admin'` diventano automaticamente `account_type='admin'`
- Gli utenti normali diventano `account_type='user'`

### **Posso cambiare il tipo account dopo?**
Sì, puoi modificarlo manualmente in Supabase o creare una funzione per farlo.

### **Il superadmin può creare altri superadmin?**
Per ora no, solo admin normali. Possiamo aggiungerlo se serve.

---

## 🆘 Problemi?

Se qualcosa non funziona:

1. **Verifica la migration:**
   - Controlla i log Supabase per errori
   - Verifica che i campi siano stati aggiunti alla tabella `users`

2. **Verifica il superadmin:**
   - Esegui lo script di verifica in `RIEPILOGO_SISTEMA_ADMIN_USER.md`
   - Controlla che l'email sia corretta

3. **Problemi con la registrazione:**
   - Verifica che l'API `/api/auth/register` funzioni
   - Controlla i log del server

---

## ✅ Checklist

- [ ] Eseguita migration `008_admin_user_system.sql`
- [ ] Creato/promosso superadmin con script `009_create_superadmin.sql`
- [ ] Verificati campi nella tabella `users`
- [ ] Verificata killer feature `multi_level_admin`
- [ ] Testata registrazione con scelta account type

---

## 🚀 Pronto!

Il sistema è pronto. Esegui le migration SQL e inizia a usarlo!

Prossimi step: UI per gestire i sotto-admin e Server Actions per crearli.





