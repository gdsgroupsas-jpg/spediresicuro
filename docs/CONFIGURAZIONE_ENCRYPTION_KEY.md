# 🔐 Configurazione ENCRYPTION_KEY su Vercel

## ⚠️ IMPORTANTE

Il sistema di criptazione delle credenziali API richiede la variabile d'ambiente `ENCRYPTION_KEY` per funzionare in sicurezza.

**ATTENZIONE (P0 Security Fix 2026-01-17)**: In produzione (`NODE_ENV=production`), se `ENCRYPTION_KEY` non è configurata:

- ❌ Il salvataggio di nuove credenziali **FALLIRÀ** con errore `ENCRYPTION_KEY_MISSING`
- ❌ Qualsiasi errore di criptazione **FALLIRÀ** con errore `ENCRYPTION_FAILED`
- ✅ Le credenziali esistenti (già criptate) continueranno a funzionare
- ✅ In sviluppo, viene mostrato un warning e salvato in chiaro (per testing locale)

Questo comportamento **fail-closed** previene il salvataggio accidentale di credenziali in chiaro.

---

## 🎯 COSA FA ENCRYPTION_KEY

La chiave `ENCRYPTION_KEY` viene usata per criptare le credenziali API dei corrieri prima di salvarle nel database. Questo protegge:

- API Key dei corrieri (GLS, BRT, Poste, ecc.)
- API Secret (se presente)
- Altri dati sensibili

---

## ✅ COME CONFIGURARLA

### Passo 1: Genera una Chiave di Criptazione

Hai due opzioni:

#### Opzione A: Genera automaticamente (CONSIGLIATO)

Usa questo comando per generare una chiave sicura:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Oppure, se hai Node.js installato:

```javascript
// Apri la console Node.js e esegui:
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

Questo genererà una stringa di 64 caratteri esadecimali, tipo:

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### Opzione B: Usa una Chiave Manuale

Puoi anche usare una qualsiasi stringa lunga e casuale (minimo 32 caratteri, consigliato 64+).

---

### Passo 2: Aggiungi ENCRYPTION_KEY su Vercel

1. **Vai su Vercel Dashboard**: https://vercel.com/dashboard

2. **Seleziona il progetto** `spediresicuro` (o il nome del tuo progetto)

3. **Vai su Settings** → **Environment Variables**

4. **Clicca "Add New"** e aggiungi:

   | Nome             | Valore                            | Ambiente                                     |
   | ---------------- | --------------------------------- | -------------------------------------------- |
   | `ENCRYPTION_KEY` | `[la chiave generata al passo 1]` | **Production**, **Preview**, **Development** |

   ⚠️ **IMPORTANTE**: Seleziona tutti e tre gli ambienti (Production, Preview, Development) per assicurarti che funzioni ovunque.

5. **Clicca "Save"**

6. **Riavvia il deploy** (Vercel dovrebbe riavviare automaticamente, altrimenti vai su **Deployments** → **Redeploy**)

---

### Passo 3: Verifica che Funzioni

Dopo aver aggiunto la variabile e fatto il redeploy:

1. Vai su https://spediresicuro.vercel.app/dashboard/integrazioni
2. Prova a configurare una credenziale API
3. Controlla i log su Vercel - non dovresti più vedere il warning:
   ```
   ⚠️ ENCRYPTION_KEY non configurata in produzione
   ```

---

## 🔒 SICUREZZA

### ⚠️ ATTENZIONI IMPORTANTI

1. **NON condividere mai** la `ENCRYPTION_KEY` con nessuno
2. **NON committare** mai la chiave nel repository Git
3. **NON esporre** la chiave in log o messaggi di errore
4. **Usa chiavi diverse** per ambiente di sviluppo e produzione (consigliato)

### 🔄 Cambio Chiave

Se devi cambiare la `ENCRYPTION_KEY` (es. se è stata compromessa):

1. **Genera una nuova chiave** (vedi Passo 1)
2. **Aggiungi la nuova chiave** su Vercel
3. **⚠️ PROBLEMA**: Le credenziali già criptate con la vecchia chiave non potranno più essere decriptate!

   **Soluzione**:
   - Prima di cambiare chiave, decripta tutte le credenziali esistenti (se possibile)
   - Dopo aver cambiato chiave, riconfigura tutte le credenziali API degli utenti

---

## 📋 CHECKLIST

- [ ] Ho generato una chiave di criptazione sicura (64 caratteri hex)
- [ ] Ho aggiunto `ENCRYPTION_KEY` su Vercel in tutti gli ambienti
- [ ] Ho fatto il redeploy dell'applicazione
- [ ] Ho verificato che non ci siano più warning nei log
- [ ] Ho testato che la configurazione API funzioni

---

## 🆘 PROBLEMI COMUNI

### Problema: "ENCRYPTION_KEY non configurata in produzione"

**Causa**: La variabile non è stata aggiunta su Vercel o non è stata applicata correttamente.

**Soluzione**:

1. Verifica su Vercel Dashboard → Settings → Environment Variables che `ENCRYPTION_KEY` sia presente
2. Assicurati che sia selezionata per "Production"
3. Fai un redeploy completo (non solo rebuild)

### Problema: "Errore durante la decriptazione"

**Causa**: Le credenziali sono state criptate con una chiave diversa.

**Soluzione**:

1. Verifica che la `ENCRYPTION_KEY` su Vercel sia quella corretta
2. Se hai cambiato chiave, riconfigura tutte le credenziali API

### Problema: Le credenziali sono salvate in chiaro

**Causa**: `ENCRYPTION_KEY` non è configurata o c'è un errore nella criptazione.

**Soluzione**:

1. Verifica che `ENCRYPTION_KEY` sia presente su Vercel
2. Controlla i log per eventuali errori di criptazione
3. Dopo aver configurato la chiave, le nuove credenziali verranno criptate automaticamente

### Problema: Errore "ENCRYPTION_KEY_MISSING" in produzione

**Causa**: Stai cercando di salvare nuove credenziali ma `ENCRYPTION_KEY` non è configurata.

**Soluzione**:

1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Aggiungi `ENCRYPTION_KEY` con una chiave generata (vedi Passo 1)
3. Redeploy l'applicazione

> **Nota (2026-01-17)**: Questo errore è intenzionale - il sistema ora rifiuta di salvare credenziali in chiaro in produzione per sicurezza.

---

## 📚 RIFERIMENTI

- File di implementazione: `lib/security/encryption.ts`
- Utilizzo: `actions/configurations.ts`
- Documentazione Vercel: https://vercel.com/docs/concepts/projects/environment-variables

---

**Ultimo aggiornamento**: 17 Gennaio 2026
