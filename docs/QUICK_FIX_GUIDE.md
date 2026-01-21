# ⚡ Quick Fix: Creazione Spedizione

## 🎯 Problema

Creazione spedizione fallisce in produzione, login funziona.

## 🔍 Causa Probabile

`SUPABASE_SERVICE_ROLE_KEY` mancante o errata in Vercel (dopo rotazione secrets).

---

## ✅ Fix Rapido (5 minuti)

### 1. Verifica Vercel Environment Variables

1. Vai su: https://vercel.com/dashboard → Il tuo progetto → **Settings** → **Environment Variables**
2. Cerca `SUPABASE_SERVICE_ROLE_KEY`
3. Se **manca** o contiene "placeholder":
   - Vai su: https://supabase.com/dashboard → **Settings** → **API**
   - Copia **service_role** key (clicca "Reveal")
   - Aggiorna in Vercel (assegna a **Production**)
   - **Save**

### 2. Redeploy

```bash
git commit --allow-empty -m "fix: update SUPABASE_SERVICE_ROLE_KEY"
git push origin master
```

### 3. Verifica

Dopo deploy, testa:

```bash
curl https://tuo-dominio.vercel.app/api/test-supabase
```

Dovresti vedere:

```json
{
  "isConfigured": true,
  "insertTest": { "success": true }
}
```

### 4. Test Creazione Spedizione

Prova a creare una spedizione dall'app. Dovrebbe funzionare.

---

## 🔧 Se Il Problema Persiste

### Verifica Schema Database

```bash
# Installa Supabase CLI (se non già fatto)
npm install --save-dev supabase

# Verifica schema
npm run verify:schema
```

### Verifica RLS Policies

```bash
npm run check:rls
```

### Documentazione Completa

- **Fix step-by-step**: `docs/FIX_SHIPMENT_CREATION_STEPS.md`
- **Setup Supabase CLI**: `docs/SUPABASE_CLI_SETUP.md`
- **Diagnostica completa**: `docs/DIAGNOSTIC_SHIPMENT_CREATION_FAILURE.md`

---

## 📊 Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` presente in Vercel Production
- [ ] Redeploy eseguito
- [ ] `/api/test-supabase` ritorna `isConfigured: true`
- [ ] Creazione spedizione funziona

---

**Tempo stimato**: 5-10 minuti
