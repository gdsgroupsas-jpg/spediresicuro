# 🚀 SpediRe Sicuro

Piattaforma web per preventivi spedizioni con ricarico configurabile.

## 📋 Stack Tecnologico

- **Framework**: Next.js 14 (App Router)
- **Linguaggio**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **Autenticazione**: NextAuth.js v5
- **AI Assistant**: Anne (Claude AI)
- **Deploy**: Vercel

## 🚀 Quick Start

### 1. Installazione

```bash
npm install
```

### 2. Configurazione

Copia `.env.example` e rinominalo in `.env.local`:

```bash
# Windows
copy .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

Compila le variabili necessarie in `.env.local`:

#### Variabili Obbligatorie

- `NEXT_PUBLIC_SUPABASE_URL` - URL progetto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chiave anonima Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key Supabase
- `NEXTAUTH_URL` - URL applicazione (locale: `http://localhost:3000`)
- `NEXTAUTH_SECRET` - Genera con: `openssl rand -base64 32`
- `ENCRYPTION_KEY` - Genera con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### Variabili Opzionali (per funzionalità avanzate)

- `ANTHROPIC_API_KEY` - Chiave API per Anne AI Assistant (ottieni da https://console.anthropic.com/)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Per login Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - Per login GitHub OAuth

### 3. Avvio Server Locale

```bash
npm run dev
```

L'applicazione sarà disponibile su: **http://localhost:3000**

## 📁 Struttura Progetto

```
├── app/              # Next.js App Router (pagine e API routes)
├── components/       # Componenti React riutilizzabili
├── lib/             # Utilities e configurazioni
├── types/           # TypeScript types
├── supabase/        # Migrazioni database
├── scripts/         # Script di utilità
│   └── tools/       # Script batch per sviluppo locale
├── docs/            # Documentazione
│   └── archive/     # Documentazione storica/obsoleta
└── .env.example     # Template variabili ambiente
```

## 🔧 Script Utili (in `scripts/tools/`)

- `VERIFICA-ANNE-LOCALE.bat` - Verifica configurazione Anne AI
- `RIAVVIA-SERVER.bat` - Riavvia il server di sviluppo
- `VERIFICA-ENV-LOCALE.bat` - Verifica variabili ambiente

## 📚 Documentazione

### File Principali

- `README.md` - Questo file (guida rapida)
- `MANUALE_UTENTE.md` - Manuale utente completo della piattaforma
- `SETUP.md` - Guida setup dettagliata

### Cartelle

- `docs/` - Documentazione tecnica attiva
- `docs/archive/` - Documentazione storica/obsoleta (fix risolti, guide vecchie)

## 🤖 Anne AI Assistant

Anne è l'assistente virtuale AI integrato nella piattaforma. Per attivarla:

1. Ottieni una chiave API da https://console.anthropic.com/
2. Aggiungi in `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Riavvia il server: `npm run dev`
4. Apri Anne dal pulsante "AI Assistant" nel dashboard

**Verifica configurazione**: Esegui `scripts/tools/VERIFICA-ANNE-LOCALE.bat`

## 🔐 Sicurezza

- ⚠️ **NON committare mai `.env.local`** nel repository
- ⚠️ Usa sempre variabili d'ambiente per chiavi e segreti
- ⚠️ In produzione, configura tutte le variabili su Vercel
- ⚠️ Genera sempre `NEXTAUTH_SECRET` e `ENCRYPTION_KEY` unici per ogni ambiente

## 🚀 Deploy

Il progetto è configurato per deploy automatico su Vercel:
- Ogni push su `master` → deploy automatico
- Variabili ambiente vanno configurate su Vercel Dashboard

## 📝 Note

- **Repository**: https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Branch principale**: `master`
- **Account GitHub**: gdsgroupsas-jpg

## 🆘 Supporto

Per problemi o domande:
1. Controlla `docs/` per documentazione tecnica
2. Verifica `.env.local` è configurato correttamente
3. Controlla i log del server per errori

---

**Versione**: 1.0.0  
**Ultimo aggiornamento**: Dicembre 2025
