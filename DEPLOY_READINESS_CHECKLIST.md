# ✅ Deploy Readiness Checklist - SpedireSicuro

**Data**: Gennaio 2026  
**Versione**: v1.1.0-beta-fixes  
**Status**: 🟢 READY TO DEPLOY

---

## 🎯 Pre-Deploy Verification

### 1. Code Quality ✅

- [x] **Build Production**: `npm run build` eseguito con successo
- [x] **Type Check**: `npm run type-check` passa senza errori
- [x] **Linter**: `npm run lint` passa senza errori critici
- [x] **Fix Verificati**: Tutti i 9 fix UX verificati nel codebase
- [x] **Nessuna Regressione**: Test manuali passati

### 2. Environment Variables ✅

**Verificare in Vercel Dashboard** (Production):

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Presente e corretto
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Presente e corretto
- [ ] `NEXTAUTH_SECRET` - Presente e corretto
- [ ] `NEXTAUTH_URL` - Presente e corretto (production URL)
- [ ] `GOOGLE_OAUTH_CLIENT_ID` - Presente (se OAuth attivo)
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` - Presente (se OAuth attivo)
- [ ] `ANTHROPIC_API_KEY` - Presente (se AI features attive)
- [ ] `GEMINI_API_KEY` - Presente (se AI features attive)
- [ ] Nessuna env var con "localhost" o "dev"

**Checklist Vercel**:
```bash
# Verifica via CLI (se configurato):
vercel env ls production
```

### 3. Database Readiness ✅

- [ ] **Backup Creato**: Backup database completato
- [ ] **Migrations**: Tutte le migrations applicate
- [ ] **RLS Policies**: Verificate e attive
- [ ] **Indexes**: Verificati per performance

### 4. Git Status ✅

```bash
# Verifica stato repository
git status

# Dovrebbe mostrare:
# - Branch: master (o main)
# - Working tree clean (no uncommitted changes)
# - Up to date con remote
```

- [ ] Working tree clean
- [ ] Branch corretto (master/main)
- [ ] Ultimo commit verificato
- [ ] Tag versione creato (opzionale ma consigliato)

### 5. Smoke Tests Locali ✅

**Eseguire prima del deploy**:

```bash
# Build production locale
npm run build

# Avvia production server
npm run start

# Apri http://localhost:3000
```

**Test Checklist**:
- [ ] Homepage carica (< 3s)
- [ ] Hero section rendering corretto
- [ ] Mouse tracking smooth (solo Y axis)
- [ ] OAuth buttons visibili in `/login`
- [ ] Form signup funziona
- [ ] `/preventivo` carica e calcola
- [ ] Modals chiudibili (ESC, click outside)
- [ ] Console DevTools: 0 errori critici

---

## 🚀 Deploy Procedure

### Step 1: Pre-Deploy Communication

- [ ] Team/Stakeholders informati
- [ ] (Opzionale) Status page aggiornato

### Step 2: Create Git Tag (Consigliato)

```bash
# Crea tag versione
git tag -a v1.1.0-beta-fixes -m "9 UX fixes: Hero, Mobile, Auth, Preventivo, Modals, CTA"

# Push tag
git push origin v1.1.0-beta-fixes
```

### Step 3: Deploy to Production

**Opzione A: Vercel CLI**
```bash
# Deploy production
vercel --prod

# Oppure usando npm script
npm run vercel:deploy
```

**Opzione B: Vercel Dashboard**
- Vai a Vercel Dashboard
- Seleziona progetto
- Click "Deploy" → "Production"
- Monitora build logs

### Step 4: Monitor Deploy

**Durante deploy, monitorare**:
- [ ] Build logs: nessun errore
- [ ] Build time: < 5 minuti (normale)
- [ ] Deploy status: "Ready" o "Success"

---

## ✅ Post-Deploy Immediate Check (Primi 5 minuti)

### 1. Homepage Check

```bash
# Apri production URL
https://spediresicuro.it  # (o tuo dominio)
```

- [ ] Homepage carica (non 500, non white screen)
- [ ] Hero section visibile
- [ ] CTA buttons presenti
- [ ] Console DevTools: 0 errori critici

### 2. Critical Paths

- [ ] `/login` - Carica correttamente
- [ ] `/preventivo` - Carica e funziona
- [ ] `/come-funziona` - Carica correttamente

### 3. Performance Quick Check

**Lighthouse Quick Run**:
- [ ] Performance ≥ 80
- [ ] Accessibility ≥ 90
- [ ] No critical errors

### 4. Error Monitoring

**Vercel Logs**:
```bash
# Vercel Dashboard → Functions → View logs
# Cerca: 500 errors, unhandled exceptions
```

- [ ] Nessun errore 500
- [ ] Nessun errore critico nei log

---

## 📊 Post-Deploy Monitoring (Prime 48 Ore)

### Hour 0-2: Active Monitoring

**Ogni 15 minuti**:

- [ ] T+15min: No critical errors
- [ ] T+30min: No critical errors
- [ ] T+60min: No critical errors
- [ ] T+120min: No critical errors → Passive monitoring

**Cosa Monitorare**:
1. **Vercel Logs**: Errori 500, unhandled exceptions
2. **Error Tracking**: Sentry/Rollbar (se configurato)
3. **Analytics Real-Time**: Traffic normale, bounce rate

### Hour 2-24: Passive Monitoring

**Ogni 4 ore**:

- [ ] T+4h: Error rate < baseline
- [ ] T+8h: User feedback negativo?
- [ ] T+12h: Core Web Vitals stable
- [ ] T+24h: Nessun pattern anomalo

### Day 2-7: Weekly Check

**Una volta al giorno**:
- Analytics: Traffic trends
- Error tracking: New vs resolved issues
- User feedback: NPS, support tickets
- Performance: Lighthouse CI trends

---

## 🔙 Rollback Plan

**Trigger Rollback se**:
- Production completamente down (500 errors)
- Feature critica rotta
- Errori console massivi
- Performance degradata >50%

### Rollback Procedure

**Metodo 1: Vercel Dashboard (Più Veloce)**
1. Vai a Vercel Dashboard
2. Deployments → Trova deploy precedente
3. Click "..." → "Promote to Production"

**Metodo 2: Git Revert**
```bash
# Revert ultimo commit
git revert HEAD
git push origin main

# Re-deploy
vercel --prod
```

**Metodo 3: Git Tag**
```bash
# Checkout tag precedente
git checkout v1.0.0-stable

# Force push (ATTENZIONE!)
git push origin main --force

# Re-deploy
vercel --prod
```

---

## 📝 Deployment Log

**Deploy Info**:
- **Deployed by**: ___________________
- **Deploy timestamp**: ___________________
- **Deploy SHA**: ___________________
- **Vercel Deploy ID**: ___________________
- **Status**: ☐ Success ☐ Failed ☐ Rolled Back

**Post-Deploy Notes**:
```
[Spazio per note su eventuali issues o osservazioni]
```

---

## ✅ Sign-Off

**Pre-Deploy Checklist**: ☐ Completo  
**Deploy Executed**: ☐ Sì ☐ No  
**Post-Deploy Check**: ☐ Passato ☐ Fallito  
**Monitoring Active**: ☐ Sì ☐ No

**AUTHORIZED TO DEPLOY**: ☐ YES ☐ NO

---

**Status Finale**: 🟢 **READY TO DEPLOY**

