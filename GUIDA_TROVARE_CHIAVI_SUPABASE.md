# 🔑 Guida: Dove Trovare le Chiavi Supabase Corrette

## ⚠️ IMPORTANTE

La chiave custom **"spediresicuro_secret_api"** che hai creato NON è quella standard che serve per il progetto.

Il progetto usa le chiavi **standard di Supabase** che si trovano in una sezione diversa.

---

## 📍 Dove Trovare le Chiavi Corrette

### 1. Vai su Supabase Dashboard
https://supabase.com/dashboard

### 2. Seleziona il Progetto
Clicca sul progetto **"spedire-sicuro"** o quello corrispondente a:
- URL: `https://pxwmposcsvsusjxdjues.supabase.co`

### 3. Vai su Settings → API
Nel menu laterale sinistro:
- Clicca su **⚙️ Settings** (Impostazioni)
- Clicca su **API** nella lista

### 4. Sezione "Project API keys"

Qui trovi **3 chiavi standard**:

#### a) **anon / public** (Pubblica - sicura per browser)
- **Nome**: `anon` `public`
- **Tipo**: Pubblica (può essere esposta nel browser)
- **Dove usarla**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Formato**: Inizia con `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### b) **service_role** (SECRETA - solo server-side)
- **Nome**: `service_role` `secret`
- **Tipo**: SECRETA (NON esporre mai nel browser!)
- **Dove usarla**: `SUPABASE_SERVICE_ROLE_KEY`
- **Formato**: Inizia con `sb_secret_...` oppure `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **⚠️ IMPORTANTE**: Clicca su "Reveal" per vedere la chiave completa

#### c) **Project URL**
- **Nome**: `Project URL` o `URL del Progetto`
- **Dove usarla**: `NEXT_PUBLIC_SUPABASE_URL`
- **Formato**: `https://xxxxx.supabase.co`

---

## 🔍 Differenza tra Chiavi Custom e Standard

### Chiavi Custom (API Keys personalizzate)
- Si trovano in: **Settings → API → API Keys** (sezione custom)
- Sono chiavi che **TU crei** con nomi personalizzati
- Esempio: "spediresicuro_secret_api"
- **NON sono quelle standard** che il progetto usa

### Chiavi Standard (Project API keys)
- Si trovano in: **Settings → API → Project API keys**
- Sono chiavi **predefinite da Supabase**
- Nomi: `anon`, `service_role`
- **Queste sono quelle che servono!**

---

## ✅ Verifica Chiavi Attuali

Nel tuo `.env.local` dovresti avere:

```env
# URL del progetto
NEXT_PUBLIC_SUPABASE_URL=https://pxwmposcsvsusjxdjues.supabase.co

# Anon key (pubblica)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key (SECRETA)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

---

## 🔄 Se Hai Creato una Nuova Service Role Key

Se hai fatto "Reset" della service_role key in Supabase:

1. **Copia la nuova chiave** da Supabase Dashboard
2. **Sostituisci** in `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY="nuova_chiave_qui"
   ```
3. **Aggiorna anche** in:
   - Vercel Environment Variables (se usi Vercel)
   - Railway Environment Variables (se usi Railway)
   - automation-service/.env (se esiste)

---

## 📸 Screenshot Percorso (Testuale)

```
Supabase Dashboard
├── [Seleziona Progetto]
│   └── Settings (⚙️)
│       └── API
│           ├── Project API keys  ← QUI TROVI LE CHIAVI STANDARD
│           │   ├── anon public
│           │   ├── service_role secret
│           │   └── Project URL
│           │
│           └── API Keys (Custom)  ← QUI CI SONO LE CHIAVI CUSTOM (non servono)
│               └── spediresicuro_secret_api  ← Questa NON serve
```

---

## ⚠️ ATTENZIONE

- **NON usare** la chiave custom "spediresicuro_secret_api"
- **USA** le chiavi standard: `anon` e `service_role`
- La chiave `service_role` deve iniziare con `sb_secret_` o essere un JWT lungo

---

## 🆘 Se Non Vedi le Chiavi

1. Verifica di essere nel progetto corretto
2. Verifica di avere i permessi di amministratore
3. Controlla che il progetto sia attivo (non sospeso)
4. Prova a fare refresh della pagina

---

**Ultimo aggiornamento**: 2025-01-17

