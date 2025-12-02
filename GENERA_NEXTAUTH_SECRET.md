# 🔑 Genera NEXTAUTH_SECRET - Guida Rapida

## 🎯 Obiettivo

Generare una chiave segreta sicura per `NEXTAUTH_SECRET` da usare su Vercel.

## ✅ Metodo 1: Node.js (CONSIGLIATO)

Se hai Node.js installato (probabilmente sì, visto che usi Next.js):

1. **Apri un terminale** nella cartella del progetto
2. **Esegui questo comando:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. **Copia la chiave generata** (sarà una stringa lunga tipo: `RYOyoxCYzF5IL4eChY0ESaMvCUYIUk9EBnEGFETpNeI=`)

## ✅ Metodo 2: PowerShell (Windows)

Se sei su Windows e Node.js non funziona:

1. **Apri PowerShell**
2. **Esegui questo comando:**
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```
3. **Copia la chiave generata**

## ✅ Metodo 3: Generatore Online

Vai su uno di questi siti e genera una chiave:

### Opzione A: Random.org
1. Vai su: https://www.random.org/strings/
2. Imposta:
   - **Length**: 64 caratteri
   - **Character set**: Letters and Numbers
   - Clicca **Generate**
3. Copia la stringa generata

### Opzione B: 1Password Password Generator
1. Vai su: https://1password.com/password-generator/
2. Imposta:
   - **Length**: 64 caratteri
   - **Include symbols**: Sì
3. Copia la password generata

## ✅ Metodo 4: Usa questa chiave pre-generata

Se tutti gli altri metodi non funzionano, puoi usare questa chiave:

```
RYOyoxCYzF5IL4eChY0ESaMvCUYIUk9EBnEGFETpNeI=
```

⚠️ **IMPORTANTE**: Questa è una chiave di esempio. In produzione, è meglio generare una chiave unica per sicurezza, ma funzionerà comunque.

## 📋 Come Usare la Chiave

1. **Copia la chiave generata** (deve essere almeno 32 caratteri)
2. **Vai su Vercel Dashboard** → Settings → Environment Variables
3. **Aggiungi o modifica** la variabile:
   - **Name:** `NEXTAUTH_SECRET`
   - **Value:** Incolla la chiave che hai copiato
   - **Environment:** Seleziona **Production**
4. **Salva** e fai un nuovo deploy

## ✅ Verifica

Dopo il deploy, controlla i log di Vercel. Dovresti vedere:

```
✅ [AUTH CONFIG] NEXTAUTH_SECRET configurato correttamente
```

Se vedi invece:

```
❌ [AUTH CONFIG] ERRORE CRITICO: NEXTAUTH_SECRET non configurato in produzione!
```

Significa che la variabile non è ancora configurata correttamente. Verifica:
- La variabile è stata salvata su Vercel?
- Hai fatto un nuovo deploy dopo aver aggiunto la variabile?
- La variabile è selezionata per **Production**?

---

**Nota**: La chiave segreta deve essere una stringa casuale di almeno 32 caratteri. Può contenere lettere, numeri e caratteri speciali.

