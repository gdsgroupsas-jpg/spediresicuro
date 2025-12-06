# 📦 SpedireSicuro.it

**Piattaforma SaaS per la gestione di spedizioni logistiche con integrazione e-commerce, OCR automatico e sistema di pricing dinamico.**

---

## 🚀 Quick Start

### Per Sviluppatori

```bash
# 1. Clone del repository
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro

# 2. Installa dipendenze
npm install

# 3. Configura ambiente
cp .env.example .env.local
# Modifica .env.local con le tue credenziali

# 4. Avvia server di sviluppo
npm run dev

# 5. Apri browser
# http://localhost:3000
```

### Per Utenti Cursor

Se usi **Cursor IDE**, leggi subito:

- 📖 **[.cursorrules](.cursorrules)** - Regole e limitazioni Cursor
- 🚨 **[RISOLVI_ERRORI_GIT_PUSH_PULL.md](RISOLVI_ERRORI_GIT_PUSH_PULL.md)** - Errori di autenticazione? Leggi qui!
- 🚀 **[GUIDA_RAPIDA_GIT_CURSOR.md](GUIDA_RAPIDA_GIT_CURSOR.md)** - Come usare git con Cursor
- ❓ **[PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md](PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md)** - FAQ su limitazioni

**⚠️ IMPORTANTE:** 
- Cursor **NON PUÒ** fare git pull/push/commit automatico per motivi di sicurezza
- Se ricevi errori di autenticazione, **devi configurare le credenziali** GitHub (vedi guida sopra)
- Usa gli script automatici o comandi manuali

---

## 📚 Documentazione

### Guide Essenziali

- **[.cursorrules](.cursorrules)** - Regole per Cursor IDE
- **[GUIDA_RAPIDA_GIT_CURSOR.md](GUIDA_RAPIDA_GIT_CURSOR.md)** - Git workflow con Cursor (1 minuto)
- **[PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md](PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md)** - Spiegazione completa limitazioni
- **[.AI_DIRECTIVE.md](.AI_DIRECTIVE.md)** - Direttive complete per AI agents
- **[RIEPILOGO_PROGETTO_CURSOR.md](RIEPILOGO_PROGETTO_CURSOR.md)** - Overview completo progetto

### Setup e Configurazione

- **[SETUP.md](SETUP.md)** - Guida setup completo
- **[env.example.txt](env.example.txt)** - Esempio variabili ambiente

### Guide Operative

- **[GUIDA_LAVORO_REMOTO_SICURO.md](GUIDA_LAVORO_REMOTO_SICURO.md)** - Lavoro remoto sicuro
- **[COMANDI_GIT_REMOTO_SICURI.md](COMANDI_GIT_REMOTO_SICURI.md)** - Comandi git sicuri

---

## 🎯 Stack Tecnologico

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Auth:** NextAuth.js (Google, GitHub, Credentials)
- **Deploy:** Vercel
- **OCR:** Google Cloud Vision, Anthropic Claude, Tesseract
- **E-commerce:** WooCommerce, Shopify, Magento, PrestaShop
- **Corrieri:** GLS, SDA, Poste Italiane, Bartolini, DHL

---

## 🛠️ Script Disponibili

### Development

```bash
npm run dev          # Server sviluppo (http://localhost:3000)
npm run build        # Build produzione
npm run start        # Avvia build produzione
npm run lint         # Linting
npm run type-check   # Controllo TypeScript
```

### Git Automation (Windows)

```bash
SYNC-AUTO.bat                    # Sincronizzazione completa (pull + push)
PULL-AUTO.bat                    # Solo pull
PUSH-AUTO.bat                    # Solo push
COMMIT-PUSH-SEMPLICE.bat        # Commit + push
```

### Git Automation (PowerShell)

```powershell
.\sync-automatico-completo.ps1   # Sincronizzazione completa
.\commit-and-push.ps1            # Commit + push
.\quick-commit-push.ps1          # Commit + push rapido
```

---

## 🔐 Variabili Ambiente

Crea `.env.local` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# NextAuth
NEXTAUTH_SECRET=your-secret-key-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (opzionale)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# GitHub OAuth (opzionale)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# OCR (opzionale)
GOOGLE_CLOUD_VISION_API_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 📂 Struttura Progetto

```
spediresicuro/
├── .cursor/                 # Configurazione Cursor
├── .github/                 # GitHub Actions
├── app/                     # Next.js App Router
│   ├── api/                # API Routes
│   ├── dashboard/          # Dashboard protetta
│   └── ...
├── components/             # Componenti React
├── lib/                    # Librerie e utilities
│   ├── database.ts         # ⚠️ CRITICO: Adapter Supabase
│   ├── supabase.ts         # Client Supabase
│   └── auth-config.ts      # NextAuth config
├── supabase/              # Migrazioni database
│   └── migrations/
├── types/                  # TypeScript types
├── public/                 # Asset statici
├── .cursorrules           # Regole Cursor
├── .env.local             # Variabili ambiente (NON committare!)
└── package.json
```

---

## 🚨 Regole Critiche

### ❌ NON FARE

1. ❌ **NON** usare JSON fallback per spedizioni (solo Supabase)
2. ❌ **NON** usare `fs.writeFileSync()` (Vercel è read-only)
3. ❌ **NON** committare `.env.local`
4. ❌ **NON** esporre API keys nel codice
5. ❌ **NON** fare `git push --force` su master

### ✅ SEMPRE FARE

1. ✅ Usare **SOLO Supabase** per operazioni su spedizioni
2. ✅ Verificare autenticazione in tutte le API routes
3. ✅ Testare in locale prima di pushare (`npm run build`)
4. ✅ Validare input utente
5. ✅ Usare soft delete (campo `deleted = true`)

---

## 🎓 Workflow Git con Cursor

### ⚠️ IMPORTANTE

**Cursor NON può fare git automaticamente!** Non è un bug, è una limitazione di sicurezza intenzionale.

### Workflow Consigliato

```bash
# 1. Sincronizza all'inizio
git pull origin master

# 2. Sviluppa con Cursor
# (Cursor ti aiuta a scrivere il codice)

# 3. Test
npm run dev
npm run build

# 4. Sincronizza alla fine
# OPZIONE A - Script automatico (consigliato):
SYNC-AUTO.bat                      # Windows
.\sync-automatico-completo.ps1     # PowerShell

# OPZIONE B - Comandi manuali:
git add .
git commit -m "feat: descrizione"
git push origin master
```

### Cosa Chiedere a Cursor

✅ **GIUSTO:**
```
"Aiutami a scrivere una funzione per calcolare il prezzo"
"Mostrami come fare git pull"
"Quale script uso per sincronizzare?"
"Suggerisci un commit message"
```

❌ **SBAGLIATO:**
```
"Fai pull automatico"           # ❌ Cursor non può
"Pusha le modifiche"            # ❌ Cursor non può
"Fai merge automatico"          # ❌ Cursor non può
```

**Leggi:** [PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md](PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md) per capire perché.

---

## 🤝 Contribuire

### Convenzioni

- **File:** kebab-case (`preventivo-form.tsx`)
- **Componenti:** PascalCase (`PreventivoForm`)
- **Variabili:** camelCase italiano (`prezzoFinale`, `datiSpedizione`)
- **Commenti:** Sempre in italiano
- **Commit:** `type(scope): description` in italiano
  - `feat`: Nuova funzionalità
  - `fix`: Correzione bug
  - `docs`: Documentazione
  - `style`: Formattazione
  - `refactor`: Refactoring
  - `test`: Test
  - `chore`: Manutenzione

### Branch Strategy

- **master** - Branch principale (auto-deploy su Vercel)
- **feature/nome** - Features in sviluppo
- **fix/nome** - Bug fixes
- **test/nome** - Esperimenti

---

## 📞 Supporto

### Documentazione Completa

Per domande su git e Cursor:
- 📖 [.cursorrules](.cursorrules)
- 🚀 [GUIDA_RAPIDA_GIT_CURSOR.md](GUIDA_RAPIDA_GIT_CURSOR.md)
- ❓ [PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md](PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md)

Per setup e configurazione:
- 🔧 [SETUP.md](SETUP.md)
- 📋 [RIEPILOGO_PROGETTO_CURSOR.md](RIEPILOGO_PROGETTO_CURSOR.md)

### Contatti

- **Email:** admin@spediresicuro.it
- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro
- **Deploy:** Vercel (auto-deploy da master)

---

## 📄 Licenza

Proprietario: GDS Group SAS

---

## ✨ Features Principali

- 📦 **Gestione Spedizioni** - CRUD completo con tracking
- 🔐 **Autenticazione** - NextAuth (Google, GitHub, Credentials)
- 🎯 **OCR Automatico** - Estrazione dati da LDV/documenti
- 💰 **Pricing Dinamico** - Calcolo automatico con margini
- 📊 **Dashboard** - Statistiche e analytics
- 🔄 **E-commerce Integration** - WooCommerce, Shopify, ecc.
- 👥 **Sistema Ruoli** - Admin, User, Agent, Manager, ecc.
- 🎁 **Killer Features** - Sistema permessi granulare
- 📱 **PWA Ready** - Progressive Web App
- 🌐 **Multi-tenant** - Supporto multi-utente

---

**Versione:** 1.0  
**Ultimo Aggiornamento:** Dicembre 2025

---

## 🎯 Quick Links

- [Documentazione Completa](.AI_DIRECTIVE.md)
- [Regole Cursor](.cursorrules)
- [Guida Git Rapida](GUIDA_RAPIDA_GIT_CURSOR.md)
- [FAQ Git e Cursor](PERCHE_CURSOR_NON_PUO_FARE_GIT_AUTOMATICO.md)
- [Setup Completo](SETUP.md)
