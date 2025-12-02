# 🔧 Correzione Configurazione NextAuth

## ⚠️ IMPORTANTE: Differenza tra Locale e Vercel

### 📁 Configurazione LOCALE (env.local)

Nel file `env.local` (solo per sviluppo sul tuo computer):

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=SYTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0
```

- ✅ `NEXTAUTH_URL` deve essere `http://localhost:3000` (NON quello di Vercel!)
- ✅ `NEXTAUTH_SECRET` può essere qualsiasi chiave (almeno 32 caratteri)
- ✅ La chiave attuale è 112 caratteri - perfetta!

### 🌐 Configurazione VERCEL (Produzione)

Su Vercel Dashboard → Settings → Environment Variables:

```
NEXTAUTH_URL=https://spediresicuro.vercel.app
NEXTAUTH_SECRET=7fWgX7RJRyOsmlIFUxSWux3j+DbpaOiUweoA384AhwM=
```

- ✅ `NEXTAUTH_URL` deve essere `https://spediresicuro.vercel.app` (NON localhost!)
- ✅ `NEXTAUTH_SECRET` deve essere almeno 32 caratteri (la chiave generata sopra è 44 caratteri - perfetta!)

## 🔍 Verifica Configurazione Attuale

### File env.local (Locale)

Controlla che nel file `env.local` ci sia:

```env
NEXTAUTH_URL=http://localhost:3000
```

**❌ SBAGLIATO se è:**
```env
NEXTAUTH_URL=https://spediresicuro.vercel.app
```

### Vercel Dashboard

Vai su Vercel → Settings → Environment Variables e verifica:

1. **NEXTAUTH_URL**
   - Deve essere: `https://spediresicuro.vercel.app`
   - ❌ NON deve essere: `http://localhost:3000`

2. **NEXTAUTH_SECRET**
   - Deve essere almeno 32 caratteri
   - Se hai una chiave di 32 caratteri esatti, va bene
   - Se vuoi una chiave più sicura, usa quella generata sopra: `7fWgX7RJRyOsmlIFUxSWux3j+DbpaOiUweoA384AhwM=`

## ✅ Chiave Segreta Generata

Ho generato una nuova chiave segreta per te:

```
7fWgX7RJRyOsmlIFUxSWux3j+DbpaOiUweoA384AhwM=
```

Questa chiave è:
- ✅ 44 caratteri (più sicura di 32)
- ✅ Generata con crittografia sicura
- ✅ Pronta per essere usata su Vercel

## 📋 Cosa Fare Ora

### 1. Verifica env.local (Locale)

Apri il file `env.local` e assicurati che sia:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=SYTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0
```

**Se NEXTAUTH_URL è diverso da `http://localhost:3000`, correggilo!**

### 2. Configura Vercel

1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Verifica o aggiungi:

   **NEXTAUTH_URL:**
   - Name: `NEXTAUTH_URL`
   - Value: `https://spediresicuro.vercel.app`
   - Environment: Production

   **NEXTAUTH_SECRET:**
   - Name: `NEXTAUTH_SECRET`
   - Value: `7fWgX7RJRyOsmlIFUxSWux3j+DbpaOiUweoA384AhwM=` (o la tua chiave attuale se è almeno 32 caratteri)
   - Environment: Production

3. Salva e fai un nuovo deploy

## ⚠️ Regole Importanti

1. **Locale (env.local):**
   - `NEXTAUTH_URL` = `http://localhost:3000` (sempre!)
   - `NEXTAUTH_SECRET` = qualsiasi chiave (almeno 32 caratteri)

2. **Vercel (Produzione):**
   - `NEXTAUTH_URL` = `https://spediresicuro.vercel.app` (sempre!)
   - `NEXTAUTH_SECRET` = qualsiasi chiave (almeno 32 caratteri)

3. **Le chiavi possono essere diverse:**
   - La chiave locale può essere diversa da quella di Vercel
   - Entrambe devono essere almeno 32 caratteri

## 🔍 Verifica Dopo le Modifiche

Dopo aver fatto le modifiche:

1. **Locale:**
   - Riavvia il server: `npm run dev`
   - Controlla i log all'avvio
   - Dovresti vedere: `✅ [AUTH CONFIG] Configurazione OAuth valida`

2. **Vercel:**
   - Fai un nuovo deploy
   - Controlla i log di Vercel
   - Dovresti vedere: `✅ [AUTH CONFIG] Configurazione OAuth valida`

---

**Nota**: Se hai modificato `NEXTAUTH_URL` in locale con quello di Vercel, correggilo subito! In locale deve essere sempre `http://localhost:3000`.

