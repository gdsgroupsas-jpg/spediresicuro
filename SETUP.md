# 🚀 Setup Progetto SpedireSicuro.it

## ✅ Stato Setup Corrente

### Dipendenze
- ✅ **Node.js**: v24.11.1
- ✅ **npm**: v11.6.2
- ✅ **Dipendenze installate**: Tutte le dipendenze da `package.json` sono installate correttamente

### Configurazione Ambiente
- ✅ **`.env.local`**: File presente e configurato con:
  - Supabase (URL e chiavi)
  - NextAuth (URL e secret)
  - OAuth providers (Google, GitHub)
  - Google Cloud credentials
  - Anthropic API key
  - Margine predefinito (15%)

### Database
- ✅ **`data/database.json`**: File presente e popolato con dati

### Git
- ✅ **Username**: gdsgroupsas-jpg
- ✅ **Email**: gdsgroupsas@gmail.com
- ✅ **Remote**: https://github.com/gdsgroupsas-jpg/spediresicuro.git

### Struttura Progetto
- ✅ **Next.js 14**: Configurato
- ✅ **TypeScript**: Configurato
- ✅ **Tailwind CSS**: Configurato
- ✅ **NextAuth v5**: Configurato

---

## 📋 Comandi Disponibili

### Sviluppo
```bash
npm run dev              # Avvia server di sviluppo
npm run dev:monitor      # Avvia con monitoraggio errori
```

### Build e Produzione
```bash
npm run build           # Build per produzione
npm run build:monitor    # Build con monitoraggio errori
npm run start            # Avvia server di produzione
```

### Verifica e Testing
```bash
npm run lint             # Esegue ESLint
npm run type-check       # Verifica errori TypeScript
npm run check:errors     # Controlla errori nel progetto
```

### Supabase
```bash
npm run setup:supabase   # Setup iniziale Supabase
npm run verify:supabase  # Verifica configurazione Supabase
npm run check:table      # Verifica struttura tabelle
npm run fix:schema       # Corregge schema database
npm run seed:geo         # Popola dati geografici
npm run verify:users     # Verifica utenti demo
```

### Configurazione
```bash
npm run verify:config    # Verifica configurazione locale
npm run check:env        # Verifica variabili ambiente (sicuro)
npm run check:env:simple # Verifica variabili ambiente (semplice)
```

---

## 🚀 Quick Start

### 1. Verifica Setup
```bash
# Verifica che tutto sia configurato
npm run check:env:simple
npm run type-check
```

### 2. Avvia Sviluppo
```bash
npm run dev
```

L'applicazione sarà disponibile su: **http://localhost:3000**

### 3. Verifica Supabase (se necessario)
```bash
npm run verify:supabase
```

---

## 📝 Note Importanti

### Variabili Ambiente
- Il file `.env.local` contiene dati sensibili e **NON deve essere committato**
- Per produzione, configurare le variabili su Vercel Dashboard

### Database
- **Sviluppo**: Usa `data/database.json` (file locale)
- **Produzione**: Usa Supabase PostgreSQL

### Git
- ⚠️ **SEMPRE verificare** che `git config user.name` sia `gdsgroupsas-jpg` prima di commit/push
- Branch principale: `master`
- Deploy automatico su Vercel ad ogni push su `master`

### Vercel
- Deploy automatico attivo
- Account: stesso del progetto "spedire sicuro platform"
- ⚠️ Creare nuovo progetto Vercel separato per questo progetto

---

## 🔧 Risoluzione Problemi

### Errori TypeScript
```bash
npm run type-check
```

### Errori di Build
```bash
npm run build
npm run check:errors
```

### Problemi Supabase
```bash
npm run verify:supabase
npm run check:table
npm run fix:schema
```

### Problemi Ambiente
```bash
npm run check:env:simple
npm run verify:config
```

---

## 📚 Documentazione Aggiuntiva

Vedi la cartella `docs/` per guide dettagliate su:
- Setup Supabase
- Configurazione OAuth
- Debug e troubleshooting
- Importazione utenti demo

---

**Ultimo aggiornamento**: Setup verificato e funzionante ✅


