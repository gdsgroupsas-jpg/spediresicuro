# ✅ Verifica Sicura .env.local

**NON sovrascrive il file esistente!** Solo verifica cosa c'è configurato.

---

## 🚀 Come Usare

### Verifica Configurazione (Sicuro)

```bash
npm run check:env
```

Questo comando:
- ✅ Verifica se `.env.local` esiste
- ✅ Controlla quali variabili sono configurate
- ✅ Verifica se i valori sono placeholder o reali
- ❌ **NON mostra i valori sensibili** (solo lunghezza)
- ❌ **NON modifica o sovrascrive** il file

---

## 📋 Cosa Verifica

### Variabili Obbligatorie:
- `NEXT_PUBLIC_SUPABASE_URL` - Per autocomplete città
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Per autocomplete città
- `NEXTAUTH_URL` - Per autenticazione
- `NEXTAUTH_SECRET` - Per autenticazione
- `GOOGLE_CLIENT_ID` - Per login Google
- `GOOGLE_CLIENT_SECRET` - Per login Google
- `NEXT_PUBLIC_APP_URL` - URL applicazione

### Variabili Opzionali:
- `SUPABASE_SERVICE_ROLE_KEY` - Per seeding database

---

## ✅ Risultato Atteso

Se tutto è configurato:
```
✅ NEXT_PUBLIC_SUPABASE_URL: Configurato
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Configurato
✅ NEXTAUTH_URL: Configurato
...
✅ Tutto configurato correttamente!
```

Se manca qualcosa:
```
❌ NEXT_PUBLIC_SUPABASE_URL: NON CONFIGURATO
⚠️  GOOGLE_CLIENT_ID: Valore placeholder (non valido)
...
❌ 3 variabile/i OBBLIGATORIA/E mancante/i
```

---

## 💡 Se File Non Esiste

Se `.env.local` non esiste, puoi crearlo:

```bash
# SOLO se non esiste già!
if not exist .env.local copy env.example.txt .env.local
```

Oppure manualmente:
1. Copia `env.example.txt`
2. Rinomina in `.env.local`
3. Compila le variabili

---

## 🔒 Sicurezza

- ❌ **NON mostra valori sensibili** (solo lunghezza)
- ❌ **NON modifica il file**
- ❌ **NON sovrascrive nulla**
- ✅ Solo **legge e verifica**

---

**Usa questo comando per verificare senza rischi!** 🛡️

