# 🔍 Verifica Manuale .env.local

**Guida passo-passo per verificare cosa manca nel tuo .env.local**

---

## 📋 Step 1: Apri il File

1. Apri la cartella del progetto: `D:\spediresicuro-master`
2. Cerca il file `.env.local` (potrebbe essere nascosto)
3. Apri con un editor di testo (Notepad, VS Code, ecc.)

---

## 📋 Step 2: Verifica Queste Variabili

Cerca nel file queste variabili e verifica se sono configurate:

### ✅ Variabili OBBLIGATORIE per Autocomplete Città:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
```
- ✅ **OK se:** Inizia con `https://` e contiene `supabase.co`
- ❌ **NON OK se:** Contiene `your-project` o `xxxxx` o è vuoto

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```
- ✅ **OK se:** È una stringa lunga che inizia con `eyJ`
- ❌ **NON OK se:** Contiene `your-anon-key` o è vuoto

---

### ✅ Variabili OBBLIGATORIE per Autenticazione:

```env
NEXTAUTH_URL=http://localhost:3000
```
- ✅ **OK se:** È esattamente `http://localhost:3000`
- ❌ **NON OK se:** È vuoto o diverso

```env
NEXTAUTH_SECRET=qualcosa-di-lungo-e-casuale
```
- ✅ **OK se:** È una stringa lunga (almeno 32 caratteri)
- ❌ **NON OK se:** Contiene `your-secret-key-here` o è vuoto

---

### ✅ Variabili OBBLIGATORIE per Login Google:

```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
- ✅ **OK se:** Termina con `.apps.googleusercontent.com`
- ❌ **NON OK se:** Contiene `your-google-client-id` o è vuoto

```env
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```
- ✅ **OK se:** Inizia con `GOCSPX-` ed è lungo
- ❌ **NON OK se:** Contiene `your-google-client-secret` o è vuoto

---

### ⚠️ Variabili Opzionali:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```
- ⚠️ Opzionale, ma utile per seeding database

---

## 📊 Checklist Rapida

Controlla nel file `.env.local`:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → Contiene URL reale (non "your-project")
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Contiene chiave reale (non "your-anon-key")
- [ ] `NEXTAUTH_URL` → È `http://localhost:3000`
- [ ] `NEXTAUTH_SECRET` → Contiene chiave reale (non "your-secret-key-here")
- [ ] `GOOGLE_CLIENT_ID` → Contiene ID reale (non "your-google-client-id")
- [ ] `GOOGLE_CLIENT_SECRET` → Contiene secret reale (non "your-google-client-secret")
- [ ] `NEXT_PUBLIC_APP_URL` → È `http://localhost:3000`

---

## 🔧 Se Manca Qualcosa

### Se una variabile NON ESISTE:
1. Aggiungi la riga nel file
2. Copia il formato da `env.example.txt`
3. Sostituisci il valore placeholder con il valore reale

### Se una variabile ha un PLACEHOLDER:
1. Trova la riga nel file
2. Sostituisci il valore placeholder con il valore reale
3. Salva il file

---

## 📝 Esempio

**PRIMA (NON OK):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
GOOGLE_CLIENT_ID=your-google-client-id
```

**DOPO (OK):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://pxwmposcsvsusjxdjues.supabase.co
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

---

## ✅ Dopo le Modifiche

1. **Salva il file** `.env.local`
2. **Riavvia il server:**
   ```bash
   npm run dev
   ```
3. **Testa:**
   - Autocomplete città → dovrebbe funzionare
   - Login Google → dovrebbe funzionare

---

## 🆘 Se Non Funziona Ancora

1. Verifica che i valori siano corretti (URL Supabase, chiavi OAuth)
2. Controlla console browser per errori
3. Controlla console server per errori
4. Vedi `FIX_CONFIGURAZIONE_LOCALE.md` per troubleshooting

---

**Apri il file `.env.local` e verifica manualmente queste variabili!** 📝

