# 🤖 GUIDA INTEGRAZIONE AI - SpedireSicuro.it

**Progetto:** SpedireSicuro.it
**Versione:** 1.0.0 - Produzione Attiva
**Ultimo Aggiornamento:** 28 Novembre 2024

---

## ⚠️ LEGGIMI PRIMA - IMPORTANTISSIMO!

Se sei un'AI (Claude, ChatGPT, Cursor, Comet Agent, Windsurf, ecc.) che sta per lavorare su questo progetto, **LEGGI ATTENTAMENTE** questa guida per evitare:
- ❌ Creare confusione con vecchi progetti
- ❌ Sovrascrivere configurazioni esistenti
- ❌ Duplicare setup già completati
- ❌ Usare nomi/terminologie sbagliate

---

## 🎯 NOME PROGETTO CORRETTO

### ✅ NOME CORRETTO
**SpedireSicuro.it** (con la "e" in "Spedire")

### ❌ NOMI SBAGLIATI (NON USARE!)
- ~~SpediSicuro~~ ❌
- ~~Spedisicuro~~ ❌
- ~~SpediSecure~~ ❌
- ~~Ferrari Logistics~~ ❌ (vecchio nome, NON più usato!)

**IMPORTANTE:** Se vedi riferimenti a "Ferrari Logistics" nel codice, sono OBSOLETI e vanno sostituiti con "SpedireSicuro".

---

## 📊 STATO ATTUALE PROGETTO

### ✅ COSA È GIÀ CONFIGURATO

**Repository Git:**
- ✅ URL: https://github.com/gdsgroupsas-jpg/spediresicuro.git
- ✅ Branch: `master`
- ✅ Deploy automatico: Attivo (push → Vercel)

**Database Supabase:**
- ✅ Progetto creato e configurato
- ✅ URL: https://pxwmposcsvsusjxdjues.supabase.co (o simile)
- ✅ Schema database importato
- ✅ Tabelle: users, couriers, shipments, geo_locations

**Autenticazione OAuth:**
- ✅ Google OAuth: Configurato e funzionante
- ✅ GitHub OAuth: Configurato (App ID: 3267907)
- ✅ NextAuth v5: Integrato

**Deploy Produzione:**
- ✅ URL: https://www.spediresicuro.it
- ✅ Vercel: Deploy automatico da GitHub master branch
- ✅ Environment variables: Configurate in Vercel

**Funzionalità Operative:**
- ✅ Login/Registrazione
- ✅ Dashboard utente
- ✅ Creazione spedizioni
- ✅ Lista spedizioni con filtri
- ✅ Export CSV
- ✅ AI Routing Advisor
- ✅ Calcolo prezzi automatico

### ❌ COSA NON È ANCORA FATTO

- ⚠️ Homepage: Problemi idratazione Client Components
- ⚠️ Dettaglio spedizione: Da implementare
- ⚠️ Modifica/Cancellazione spedizioni: Da implementare
- ⚠️ Integrazione corrieri reali: Solo mock ora
- ⚠️ Email notifications: Non configurato
- ⚠️ Payment gateway: Non configurato

---

## 📋 SETUP GIÀ COMPLETATI - NON RIFARE!

### ❌ NON CREARE QUESTI SETUP

Se ti viene chiesto di "configurare Supabase" o "setup GitHub" o simili, **VERIFICA PRIMA** che non sia già fatto!

**Setup già completati:**
1. ✅ Git & GitHub → Repository esistente
2. ✅ Supabase Database → Database configurato
3. ✅ Google OAuth → Attivo in produzione
4. ✅ GitHub OAuth → Attivo in produzione
5. ✅ Vercel Deploy → Live su www.spediresicuro.it
6. ✅ Environment Variables → Configurate

**Come verificare:**
```bash
# Verifica Git
git remote -v  # Deve mostrare: gdsgroupsas-jpg/spediresicuro.git

# Verifica Supabase (se hai .env.local)
grep SUPABASE .env.local  # Deve mostrare URL e keys

# Verifica deploy
curl -I https://www.spediresicuro.it  # Deve rispondere 200 OK
```

---

## 🗂️ STRUTTURA PROGETTO

### Directory Principali

```
spediresicuro/
├── app/                          # Next.js 14 App Router
│   ├── api/                     # API Routes
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── spedizioni/         # API spedizioni (GET/POST)
│   │   ├── geo/search/         # API ricerca comuni
│   │   └── corrieri/           # API corrieri
│   ├── dashboard/              # Dashboard protetto
│   │   ├── spedizioni/
│   │   │   ├── nuova/         # Crea spedizione
│   │   │   └── page.tsx       # Lista spedizioni
│   │   └── page.tsx           # Dashboard home
│   ├── login/                  # Login page
│   └── page.tsx               # Homepage (con problemi)
│
├── components/                  # Componenti React
│   ├── homepage/              # Componenti homepage (problemi idratazione)
│   ├── ui/                    # UI components
│   ├── dashboard-nav.tsx      # Navigazione dashboard
│   └── ai-routing-advisor.tsx # AI advisor
│
├── lib/                        # Utilities & Logic
│   ├── database.ts           # Database JSON locale
│   ├── supabase.ts           # Supabase client
│   ├── auth-config.ts        # NextAuth config
│   └── corrieri-performance.ts
│
├── supabase/                   # Database Schema
│   ├── migrations/
│   │   └── 001_complete_schema.sql  # Schema completo
│   └── schema.sql            # Schema geo_locations
│
├── data/                       # Database Locale
│   └── database.json         # DB JSON temporaneo
│
├── docs/                       # Documentazione
│   ├── SUPABASE_SETUP_GUIDE.md
│   └── OAUTH_SETUP.md
│
├── public/                     # Assets statici
│
├── COMET_AGENT_SUPABASE_SETUP.md   # Prompt Comet
├── CURSOR_CLEANUP_REPO.md          # Prompt Cursor
├── AI_INTEGRATION_GUIDE.md         # Questa guida
├── README.md                        # Main README
├── package.json
├── tsconfig.json
└── next.config.mjs
```

---

## 🔧 TECNOLOGIE USATE

### Framework & Libraries

```json
{
  "framework": "Next.js 14.2.33",
  "react": "18.x",
  "typescript": "5.3.x",
  "styling": "Tailwind CSS 3.x",
  "auth": "NextAuth v5 (beta)",
  "database": "Supabase PostgreSQL",
  "deployment": "Vercel",
  "ui": "Lucide React (icons)",
  "forms": "Zod (validation)"
}
```

### Servizi Esterni

- **Database:** Supabase (PostgreSQL cloud)
- **Auth:** NextAuth v5 con Google & GitHub OAuth
- **Deploy:** Vercel (auto-deploy da GitHub)
- **Email:** Non configurato (futuro: SendGrid/Resend)
- **Payment:** Non configurato (futuro: Stripe)

---

## 📝 FILE CRITICI - NON MODIFICARE SENZA MOTIVO

### 1. `lib/auth-config.ts`
**Cosa fa:** Configurazione NextAuth v5 con OAuth
**Modifiche recenti:** Ottimizzato con tipi TypeScript, validazione OAuth
**⚠️ Non modificare:** Provider configuration, callbacks JWT

### 2. `lib/database.ts`
**Cosa fa:** Database JSON locale (temporaneo)
**Modifiche recenti:** Funzioni CRUD spedizioni
**⚠️ Non modificare:** Senza capire impatto su spedizioni esistenti

### 3. `supabase/migrations/001_complete_schema.sql`
**Cosa fa:** Schema database completo (19 tabelle)
**Modifiche recenti:** Schema production-ready
**⚠️ Non modificare:** Mai! Solo aggiunte tramite nuove migration

### 4. `app/api/spedizioni/route.ts`
**Cosa fa:** API REST per spedizioni (GET/POST)
**Modifiche recenti:** Funzionante e testato
**⚠️ Non modificare:** Senza testare impatto su frontend

### 5. `next.config.mjs`
**Cosa fa:** Configurazione Next.js
**⚠️ Non modificare:** Senza verificare build

### 6. `.env.local` (se esiste)
**Cosa fa:** Environment variables locali
**⚠️ CRITICO:** MAI committare su Git! Mai condividere!

---

## 🚨 PROBLEMI NOTI

### 1. Homepage - Errori Idratazione Client Components

**Problema:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

**Componenti affetti:**
- `components/homepage/*` (alcuni)
- Sezioni: Stats, Features, Testimonials potrebbero non renderizzare

**Soluzione temporanea:**
- Homepage è funzionante ma con warning
- Priorità bassa, non critico per funzionalità spedizioni

**Se vuoi risolvere:**
1. Analizza componenti in `components/homepage/`
2. Verifica `use client` directive
3. Controlla server/client data mismatch
4. Testa con `npm run dev`

### 2. Database Locale vs Supabase

**Situazione:**
- App usa `data/database.json` (database JSON locale) per spedizioni
- Supabase configurato ma non ancora integrato completamente
- Geo-locations usa Supabase ✅

**TODO futuro:**
- Migrare spedizioni da JSON a Supabase
- Mantenere JSON come fallback

---

## 🎯 COMPITI TIPICI E COME AFFRONTARLI

### Se ti chiedono: "Configura Supabase"

**❌ NON RIFARE DA ZERO!**

**✅ VERIFICA PRIMA:**
```bash
# Supabase è già configurato?
cat .env.local | grep SUPABASE

# Se vedi URL e keys → GIÀ CONFIGURATO!
```

**Se serve riconfigurare:**
- Usa il file `COMET_AGENT_SUPABASE_SETUP.md`
- Segui le istruzioni passo-passo
- NON creare nuovo progetto se esiste già

---

### Se ti chiedono: "Aggiungi una feature"

**✅ PROCESSO CORRETTO:**

1. **Analizza esistente:**
   ```bash
   # Cerca se feature simile esiste già
   grep -r "nome_feature" app/ components/ lib/
   ```

2. **Leggi documentazione:**
   - `README.md` - Overview progetto
   - `STATO_PROGETTO.md` - Funzionalità esistenti
   - `AI_INTEGRATION_GUIDE.md` - Questa guida

3. **Pianifica modifiche:**
   - Quali file modificare?
   - Nuove dipendenze necessarie?
   - Breaking changes?

4. **Implementa:**
   - Scrivi codice TypeScript type-safe
   - Mantieni stile progetto esistente
   - Commenta codice complesso

5. **Testa:**
   ```bash
   npm run build   # Deve passare
   npm run lint    # Deve passare
   npm run dev     # Deve funzionare
   ```

6. **Commit:**
   ```bash
   git add .
   git commit -m "feat: descrizione feature"
   git push
   ```

---

### Se ti chiedono: "Pulisci repository"

**✅ USA IL PROMPT DEDICATO:**
- File: `CURSOR_CLEANUP_REPO.md`
- Segui le istruzioni passo-passo
- NON eliminare file senza verifica

**❌ NON ELIMINARE MAI:**
- File in uso (importati nel codice)
- Configurazioni (next.config.mjs, tsconfig.json, ecc.)
- API routes funzionanti
- Database JSON (`data/database.json`)
- Schema migrations (`supabase/migrations/`)

---

### Se ti chiedono: "Risolvi bug XYZ"

**✅ PROCESSO DEBUG:**

1. **Riproduci bug:**
   ```bash
   npm run dev
   # Testa scenario che causa bug
   ```

2. **Analizza logs:**
   - Console browser (errori frontend)
   - Terminal (errori Next.js)
   - Vercel logs (errori produzione)

3. **Identifica causa:**
   - File/linea esatta dell'errore
   - Stack trace completo
   - Dati che causano problema

4. **Fix:**
   - Modifica minima necessaria
   - Mantieni backward compatibility
   - Aggiungi validazione se mancante

5. **Verifica:**
   ```bash
   npm run build   # No errors
   npm run dev     # Bug risolto
   ```

6. **Test edge cases:**
   - Input vuoti
   - Input malformati
   - Scenari limite

---

## 🔐 CREDENZIALI & SICUREZZA

### File .env.local

**⚠️ CRITICO - SICUREZZA MASSIMA!**

**Contenuto tipico:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# NextAuth
NEXTAUTH_SECRET=xxxxx
NEXTAUTH_URL=http://localhost:3000

# OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GITHUB_CLIENT_ID=REDACTED_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=xxxxx

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_MARGIN=15
```

**REGOLE DI SICUREZZA:**
1. ❌ **MAI** committare `.env.local` su Git
2. ❌ **MAI** condividere credenziali in chat/email
3. ❌ **MAI** loggare credenziali in console
4. ✅ `.env.local` deve essere in `.gitignore`
5. ✅ Usa variabili ambiente Vercel per produzione
6. ✅ Genera nuovo `NEXTAUTH_SECRET` per ogni ambiente

**Se .env.local non esiste:**
```bash
# Crea da template (se esiste)
cp env.example.txt .env.local

# Oppure chiedi all'utente le credenziali
# NON generarle a caso!
```

---

## 📚 DOCUMENTAZIONE DISPONIBILE

### Guide Setup
- `COMET_AGENT_SUPABASE_SETUP.md` - Setup database completo
- `CURSOR_CLEANUP_REPO.md` - Pulizia repository
- `docs/SUPABASE_SETUP_GUIDE.md` - Guida Supabase dettagliata
- `docs/OAUTH_SETUP.md` - Guida OAuth completa

### Documentazione Progetto
- `README.md` - Overview e quick start
- `STATO_PROGETTO.md` - Status funzionalità
- `AI_INTEGRATION_GUIDE.md` - Questa guida

### Documentazione Tecnica
- `DOCUMENTAZIONE_OAUTH_COMPLETA.md` - OAuth dettagli
- `VARIABILI_AMBIENTE_VERCEL.md` - Env vars Vercel
- `DEPLOY_AUTOMATICO.md` - CI/CD setup

---

## ✅ CHECKLIST PRIMA DI LAVORARE

**Prima di modificare QUALSIASI cosa:**

- [ ] Ho letto `AI_INTEGRATION_GUIDE.md` (questa guida)
- [ ] Ho verificato `STATO_PROGETTO.md` per funzionalità esistenti
- [ ] Ho verificato che setup NON sia già fatto
- [ ] Ho letto documentazione specifica per la task
- [ ] Ho analizzato codice esistente simile
- [ ] Ho pianificato modifiche senza breaking changes
- [ ] Ho `.env.local` configurato (se serve)
- [ ] Posso testare in locale con `npm run dev`

---

## 🎯 PRIORITÀ SVILUPPO (Prossimi Step)

### Alta Priorità (Urgente)
1. ✅ **Setup Supabase completo** (per deadline 18:00)
2. ✅ **Test creazione + download spedizioni**
3. ⚠️ **Risolvi errori idratazione homepage** (se tempo)

### Media Priorità (Settimana prossima)
1. Pagina dettaglio spedizione
2. Modifica/Cancellazione spedizioni
3. Integrazione email notifications
4. Miglioramenti UI/UX

### Bassa Priorità (Futuro)
1. Integrazione corrieri reali (DHL, UPS, ecc.)
2. Payment gateway (Stripe)
3. Analytics avanzate
4. Mobile app (React Native?)

---

## 🤝 COLLABORAZIONE TRA AI

### Se un'altra AI ha già lavorato sul progetto

**✅ VERIFICA IL SUO LAVORO:**
```bash
# Vedi ultimi commit
git log --oneline -10

# Vedi cosa è stato modificato
git diff HEAD~5..HEAD

# Leggi commit messages
git log --oneline --graph --all
```

**✅ CONTINUA DA DOVE HA LASCIATO:**
- Leggi commit messages per capire cosa è stato fatto
- Non duplicare lavoro già completato
- Mantieni coerenza stile codice

**❌ NON RIFARE DA ZERO:**
- Se vedi setup già fatto → NON rifarlo
- Se vedi feature già implementata → Migliorala, non riscriverla
- Se vedi documentazione → Aggiornala, non sostituirla

---

## 🔄 WORKFLOW GIT STANDARD

### Sviluppo Locale
```bash
# 1. Pull ultime modifiche
git pull origin master

# 2. Crea branch feature (opzionale)
git checkout -b feature/nome-feature

# 3. Sviluppa e testa
npm run dev
# ... codifica ...

# 4. Build test
npm run build

# 5. Commit
git add .
git commit -m "feat: descrizione chiara"

# 6. Push
git push origin master
# oppure
git push origin feature/nome-feature

# 7. Vercel auto-deploya → https://www.spediresicuro.it
```

### Commit Messages Standard
```
feat: aggiungi nuova funzionalità
fix: correggi bug XYZ
docs: aggiorna documentazione
style: formattazione codice
refactor: refactoring senza cambiare funzionalità
test: aggiungi test
chore: task di manutenzione
```

---

## 📞 SUPPORTO & RIFERIMENTI

### Link Utili

- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Production:** https://www.spediresicuro.it
- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Next.js Docs:** https://nextjs.org/docs
- **NextAuth Docs:** https://next-auth.js.org

### In Caso di Problemi

1. **Leggi documentazione:** Controlla file `.md` pertinenti
2. **Analizza logs:** Console, terminal, Vercel
3. **Cerca in codice:** `grep -r "keyword" .`
4. **Testa in locale:** `npm run dev`
5. **Verifica build:** `npm run build`
6. **Chiedi all'utente:** Se non sei sicuro, CHIEDI!

---

## ✅ CONCLUSIONE

**Ricorda:**
- ✅ Progetto si chiama **SpedireSicuro.it** (non SpediSicuro!)
- ✅ Setup principali già completati, NON rifare!
- ✅ Usa guide dedicate (`COMET_AGENT_*.md`, `CURSOR_*.md`)
- ✅ Leggi documentazione PRIMA di modificare
- ✅ Testa sempre in locale prima di pushare
- ✅ Mantieni coerenza stile codice esistente
- ✅ Documenta modifiche importanti
- ✅ Chiedi conferma se non sei sicuro

**Goal finale:**
Aiutare a completare SpedireSicuro.it senza creare confusione, duplicazioni o problemi.

---

**Versione Guida:** 1.0.0
**Ultimo Aggiornamento:** 28 Novembre 2024, 15:30
**Autore:** Claude (Anthropic) + Team SpedireSicuro

**Buon lavoro! 🚀**
