# 🔍 Come Verificare .env.local (Senza Sovrascrivere)

**Il comando `cp env.example.txt .env.local` sovrascrive il file se esiste già!**

---

## ✅ Verifica Sicura (Senza Modificare)

### Opzione 1: Script Automatico

```bash
npm run check:env
```

Questo script:
- ✅ Verifica se `.env.local` esiste
- ✅ Controlla quali variabili sono configurate
- ❌ **NON modifica nulla**
- ❌ **NON sovrascrive nulla**

---

### Opzione 2: Verifica Manuale

1. **Apri il file `.env.local`** nella root del progetto

2. **Verifica che contenga queste variabili** (con valori reali, non "your-xxx"):

```env
# Supabase (per autocomplete città)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# NextAuth (per autenticazione)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=chiave-segreta-32-caratteri

# Google OAuth (per login Google)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Controlla che i valori NON siano:**
   - ❌ `your-xxx`
   - ❌ `xxxxx`
   - ❌ `placeholder`
   - ❌ `TODO`
   - ❌ Vuoti

---

## ⚠️ Se File Non Esiste

**NON usare `cp env.example.txt .env.local` se il file esiste già!**

### Invece:

1. **Verifica se esiste:**
   ```bash
   # Windows PowerShell
   Test-Path .env.local
   ```

2. **Se NON esiste, crealo:**
   ```bash
   # Windows PowerShell
   Copy-Item env.example.txt .env.local
   ```

3. **Se ESISTE già:**
   - ✅ Non fare nulla!
   - ✅ Apri il file e verifica le variabili
   - ✅ Aggiungi solo quelle mancanti

---

## 🔧 Se Manca Qualcosa

### Aggiungi Solo le Variabili Mancanti

1. Apri `.env.local`
2. Aggiungi le variabili mancanti (non sovrascrivere quelle esistenti!)
3. Salva
4. Riavvia server: `npm run dev`

---

## 📋 Checklist

- [ ] File `.env.local` esiste
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurato (non "your-xxx")
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurato (non "your-xxx")
- [ ] `NEXTAUTH_URL=http://localhost:3000` configurato
- [ ] `NEXTAUTH_SECRET` configurato (non "your-secret-key-here")
- [ ] `GOOGLE_CLIENT_ID` configurato (se vuoi login Google)
- [ ] `GOOGLE_CLIENT_SECRET` configurato (se vuoi login Google)
- [ ] Server riavviato dopo modifiche

---

## 🎯 Risultato

Se tutto è configurato:
- ✅ Autocomplete città funziona
- ✅ Login Google funziona
- ✅ Nessun errore in console

---

**Ricorda: NON sovrascrivere `.env.local` se esiste già! Aggiungi solo quello che manca!** 🛡️

