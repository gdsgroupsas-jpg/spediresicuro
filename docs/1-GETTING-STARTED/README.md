# 1-GETTING-STARTED

> **Scopo:** Setup rapido per nuovi sviluppatori e onboarding in 5 minuti

## Indice

- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Onboarding](#onboarding)
- [First Contribution](#first-contribution)

---

## Quick Start

Setup completo in 5 minuti:

### 1. Clone Repository

```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

### 2. Installa Dipendenze

```bash
npm install
```

### 3. Configura Environment

```bash
cp .env.example .env.local
# Modifica .env.local con le tue credenziali Supabase
```

### 4. Avvia Server

```bash
npm run dev
```

### 5. Verifica Setup

```bash
npm run setup:check
```

Apri http://localhost:3000 ✅

---

## Local Development

### Prerequisites

- Node.js 18+
- npm o yarn
- Supabase account (cloud o local)

### Setup Completo

Vedi [QUICK_START.md](QUICK_START.md) per setup dettagliato.

### Comandi Utili

```bash
# Sviluppo
npm run dev                 # Avvia server di sviluppo

# Verifica
npm run setup:check         # Verifica setup completo
npm run check:env:simple    # Verifica variabili ambiente
npm run type-check          # Validazione TypeScript
npm run lint                # Validazione ESLint

# Database (se usi Supabase local)
npx supabase start          # Avvia Supabase locale
npx supabase stop           # Ferma Supabase locale
npx supabase status         # Verifica stato Supabase

# Testing
npm test                     # Esegui test
npm run test:e2e            # Esegui test Playwright E2E
```

---

## Onboarding

### Nuovi Team Member

1. Leggi [2-ARCHITECTURE/OVERVIEW.md](../2-ARCHITECTURE/OVERVIEW.md)
2. Leggi [10-AI-AGENT/OVERVIEW.md](../10-AI-AGENT/OVERVIEW.md)
3. Segui [FIRST_CONTRIBUTION.md](FIRST_CONTRIBUTION.md)
4. Partecipa al canale Slack/Discord del team

### Struttura Progetto

```
spediresicuro/
├── app/                    # Next.js 14 App Router
├── components/              # Componenti React
├── lib/                    # Logica condivisa
├── actions/                # Server Actions
├── supabase/               # Database migrations
├── docs/                   # Documentazione
└── tests/                  # Test (unit, integration, e2e)
```

---

## First Contribution

Vedi [FIRST_CONTRIBUTION.md](FIRST_CONTRIBUTION.md) per guida completa.

### Quick Checklist

- [ ] Repository clonata
- [ ] Dipendenze installate
- [ ] Environment configurato
- [ ] Server avviato
- [ ] Test passano (`npm test`)
- [ ] Type-check passa (`npm run type-check`)

---

## Troubleshooting

| Problema               | Soluzione                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `npm install` fallisce | Pulisci `node_modules` e `package-lock.json`, riprova       |
| Server non parte       | Verifica environment variables in `.env.local`              |
| Test falliscono        | Verifica Supabase configurato, esegui `npm run setup:check` |
| TypeScript errori      | Esegui `npm run type-check` per vedere dettagli             |

---

## Related Documentation

- [Local Development](LOCAL_DEVELOPMENT.md) - Setup locale completo
- [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) - Architettura progetto
- [First Contribution](FIRST_CONTRIBUTION.md) - Prima PR

---

_Last Updated: 2026-01-12_  
_Maintainer: Dev Team_
