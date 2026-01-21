# 🔧 Fix Login su Mobile - Guida Completa

## 🎯 Problema

Il login non funziona correttamente su dispositivi mobili. Possibili sintomi:

- Login non completa il redirect
- Sessione non viene salvata
- Redirect a `/login` invece che a `/dashboard`
- Cookie non vengono salvati

---

## ✅ Modifiche Applicate

### 1. **Sostituito `window.location.href` con `router.push()`**

**Problema:** `window.location.href` può causare problemi su mobile, specialmente con:

- Cookie di sessione
- State management di Next.js
- Service Workers (PWA)

**Soluzione:** Usare `router.push()` con `router.refresh()` per:

- ✅ Migliore compatibilità mobile
- ✅ Mantenere lo stato di Next.js
- ✅ Funzionare correttamente con PWA

**File modificati:**

- `app/login/page.tsx` - Tutti i redirect ora usano `router.push()`

---

## 🔍 Problemi Comuni su Mobile

### ❌ Problema 1: Cookie non salvati

**Causa:** Su mobile, i cookie potrebbero non essere salvati se:

- Il dominio non è configurato correttamente
- Le impostazioni del browser bloccano i cookie
- HTTPS non è configurato (richiesto per cookie sicuri)

**Soluzione:**

1. Verifica che l'app sia su HTTPS (non HTTP)
2. Verifica che `NEXTAUTH_URL` sia configurato correttamente
3. Controlla le impostazioni del browser mobile

### ❌ Problema 2: localStorage non disponibile

**Causa:** Su alcuni browser mobile, localStorage potrebbe essere limitato o bloccato.

**Soluzione:**

- Il codice ora gestisce `typeof window !== 'undefined'` prima di usare localStorage
- Se localStorage non è disponibile, il sistema usa solo il database

### ❌ Problema 3: Redirect non funziona

**Causa:** `window.location.href` può causare problemi su mobile.

**Soluzione:**

- ✅ Ora usa `router.push()` che è più compatibile
- ✅ Usa `router.refresh()` per aggiornare la sessione

### ❌ Problema 4: Sessione non riconosciuta

**Causa:** I cookie di sessione potrebbero non essere salvati correttamente.

**Soluzione:**

1. Verifica che `NEXTAUTH_SECRET` sia configurato
2. Verifica che l'URL sia HTTPS
3. Pulisci i cookie del browser mobile e riprova

---

## 📋 Checklist per Mobile

### ✅ Prima di Testare

- [ ] L'app è su HTTPS (non HTTP)
- [ ] `NEXTAUTH_URL` è configurato correttamente
- [ ] `NEXTAUTH_SECRET` è configurato
- [ ] Cookie non sono bloccati nel browser mobile

### ✅ Durante il Test

1. **Apri l'app su mobile**
   - Vai all'URL dell'app (es. `https://spediresicuro.vercel.app`)

2. **Prova il login**
   - Email: `test@spediresicuro.it`
   - Password: `test123`

3. **Verifica il redirect**
   - Dovresti essere reindirizzato a `/dashboard`
   - NON dovresti essere reindirizzato a `/dashboard/dati-cliente` (per utente test)

4. **Verifica la sessione**
   - Apri la console del browser mobile (se possibile)
   - Cerca log `✅ [LOGIN] Login riuscito`
   - Cerca log `✅ [DASHBOARD] Utente test rilevato`

---

## 🔧 Debug su Mobile

### Metodo 1: Remote Debugging (Chrome)

1. **Collega il dispositivo mobile al computer**
2. **Apri Chrome su desktop**
3. **Vai su:** `chrome://inspect`
4. **Seleziona il dispositivo** e apri DevTools
5. **Vedi console e network** come su desktop

### Metodo 2: Safari Web Inspector (iOS)

1. **Abilita Web Inspector su iPhone:**
   - Impostazioni → Safari → Avanzate → Web Inspector

2. **Collega iPhone a Mac**
3. **Apri Safari su Mac**
4. **Sviluppo → [Nome iPhone] → [Nome Tab]**
5. **Vedi console e network**

### Metodo 3: Log Console Mobile

Se non puoi usare remote debugging:

- Aggiungi `alert()` temporanei per vedere cosa succede
- Usa `console.log()` e controlla i log del server

---

## 🚨 Se Ancora Non Funziona

### Verifica 1: Cookie e Sessione

```javascript
// Aggiungi questo nella console mobile per verificare
console.log('Cookie:', document.cookie);
console.log('localStorage:', localStorage.getItem('datiCompletati_test@spediresicuro.it'));
```

### Verifica 2: Network Requests

Controlla nella tab Network:

- La chiamata a `/api/auth/callback/credentials` va a buon fine?
- La chiamata a `/api/user/dati-cliente` funziona?
- Ci sono errori 401 o 403?

### Verifica 3: Service Worker

Se usi PWA, il Service Worker potrebbe interferire:

- Disabilita temporaneamente il Service Worker
- Pulisci la cache del browser mobile
- Ricarica l'app

---

## 📝 Note

- **HTTPS è obbligatorio** per cookie sicuri su mobile
- **Alcuni browser mobile** hanno limitazioni più severe sui cookie
- **PWA installata** potrebbe comportarsi diversamente dal browser

---

**Ultimo aggiornamento:** $(Get-Date -Format "yyyy-MM-dd")
