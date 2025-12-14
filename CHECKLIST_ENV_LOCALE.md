# ✅ Checklist ENV Locale - Verifica Funzionamento

**Data:** 2025-01  
**Scopo:** Verificare che tutte le variabili d'ambiente siano configurate correttamente

---

## 🔍 VERIFICA RAPIDA

### Step 1: File `.env.local` Esiste?

```bash
# Nella root del progetto (spediresicuro/)
ls .env.local
```

✅ **Deve esistere** il file `.env.local`

---

### Step 2: Variabili Obbligatorie

Apri `.env.local` e verifica che contenga **TUTTE** queste variabili:

#### ✅ SUPABASE (3 variabili)
```env
NEXT_PUBLIC_SUPABASE_URL=https://pxd2.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Come verificare:**
- Vai su Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role secret (clicca "Reveal")

#### ✅ NEXTAUTH (2 variabili)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=la_tua_chiave_segreta_casuale_minimo_32_caratteri
```

**Come verificare:**
- `NEXTAUTH_URL` = sempre `http://localhost:3000` per locale
- `NEXTAUTH_SECRET` = chiave casuale (almeno 32 caratteri)

#### ✅ DIAGNOSTICS (1 variabile)
```env
DIAGNOSTICS_TOKEN=d4t1_d14gn0st1c1_s3gr3t1_2025_x9z
```

#### ✅ AUTOMATION SERVICE (1 variabile)
```env
AUTOMATION_SERVICE_TOKEN=genera_un_token_casuale_sicuro_qui
```

#### ✅ ENCRYPTION (1 variabile)
```env
ENCRYPTION_KEY=genera_64_caratteri_esadecimali_qui
```

**Come generare:**
- PowerShell: `[Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))`

---

### Step 3: Test Connessione Supabase

Avvia il server:
```bash
npm run dev
```

Apri il browser su `http://localhost:3000`

**Verifica:**
- ✅ La pagina carica senza errori
- ✅ Non ci sono warning in console tipo "Supabase URL o Anon Key non configurati"
- ✅ Puoi fare login

---

### Step 4: Test Pagina Admin Bonifici

1. Fai login come admin/superadmin
2. Vai su `/dashboard/admin/bonifici`
3. Verifica:
   - ✅ La pagina carica
   - ✅ Non ci sono errori in console
   - ✅ Vedi la tabella (anche se vuota)

---

## 🚨 PROBLEMI COMUNI

### Errore: "Supabase URL o Anon Key non configurati"

**Causa:** Manca `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Soluzione:**
1. Apri `.env.local`
2. Verifica che entrambe le variabili siano presenti
3. Riavvia il server (`Ctrl+C` e poi `npm run dev`)

---

### Errore: "Unauthorized" su `/dashboard/admin/bonifici`

**Causa:** L'utente non è admin/superadmin

**Soluzione:**
1. Verifica in Supabase che l'utente abbia `account_type = 'admin'` o `'superadmin'`
2. Oppure `role = 'admin'` nella tabella `users`

---

### Errore: "Cannot read property 'user' of undefined"

**Causa:** `SUPABASE_SERVICE_ROLE_KEY` mancante o errata

**Soluzione:**
1. Verifica in Supabase Dashboard → Settings → API → service_role secret
2. Copia TUTTA la chiave (è molto lunga!)
3. Incolla in `.env.local` come `SUPABASE_SERVICE_ROLE_KEY=...`
4. Riavvia il server

---

## ✅ CHECKLIST FINALE

Prima di fare commit/push, verifica:

- [ ] File `.env.local` esiste
- [ ] Tutte le 8 variabili obbligatorie sono presenti
- [ ] `npm run dev` avvia senza errori
- [ ] Login funziona
- [ ] `/dashboard/admin/bonifici` carica correttamente
- [ ] Non ci sono warning in console del browser

---

**Se tutto è ✅ → Pronto per commit/push!**
