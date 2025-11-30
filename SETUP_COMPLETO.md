# ✅ Setup Completo - SpedireSicuro.it

## 🎯 Stato Attuale

Il progetto è **pronto per lo sviluppo**! Esegui la verifica con:

```bash
npm run verify:setup
```

## 📋 Checklist Setup

### ✅ Completato

- [x] **Node.js** v24.11.1 installato (>= 18 richiesto)
- [x] **Dipendenze** installate correttamente
- [x] **File configurazione** presenti (next.config.js, tsconfig.json, tailwind.config.js)
- [x] **Database locale** valido (data/database.json)
- [x] **Supabase** configurato (se necessario per geo-locations)

### ⚠️ Da Verificare

- [ ] **NEXTAUTH_SECRET** in `.env.local` - genera una chiave segreta per NextAuth
- [ ] **Variabili ambiente** - verifica che tutte le variabili in `.env.local` siano configurate

## 🚀 Comandi Disponibili

### Sviluppo

```bash
# Avvia server di sviluppo
npm run dev

# Avvia con monitor errori
npm run dev:monitor
```

### Build e Deploy

```bash
# Build per produzione
npm run build

# Avvia versione produzione
npm start

# Build con monitor errori
npm run build:monitor
```

### Verifica e Test

```bash
# Verifica setup completo
npm run verify:setup

# Controllo errori TypeScript
npm run type-check

# Linting
npm run lint

# Verifica errori
npm run check:errors
```

### Supabase (opzionale)

```bash
# Setup automatico Supabase
npm run setup:supabase

# Verifica configurazione Supabase
npm run verify:supabase

# Popola database geo-locations
npm run seed:geo

# Verifica struttura tabella
npm run check:table
```

## 🔧 Configurazione Variabili Ambiente

Il file `.env.local` è già presente. Verifica che contenga:

### Obbligatorie

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=<genera-una-chiave-segreta>
```

### Supabase (opzionale, per geo-locations)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Configurazione Margini

```env
NEXT_PUBLIC_DEFAULT_MARGIN=15
```

## 📁 Struttura Progetto

```
spediresicuro/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── dashboard/         # Dashboard utente
│   ├── preventivo/        # Pagina preventivo
│   ├── track/             # Tracking spedizioni
│   └── page.tsx           # Homepage
├── components/            # Componenti React
│   ├── ui/                # Componenti UI
│   ├── logo/              # Componenti logo
│   └── homepage/          # Sezioni homepage
├── lib/                   # Utilities e logica
│   ├── database.ts        # Database JSON locale
│   ├── supabase.ts        # Client Supabase
│   └── auth.ts            # Configurazione NextAuth
├── data/                  # Database JSON locale
│   └── database.json      # File database
├── scripts/               # Script di utilità
│   └── verify-setup.ts    # Verifica setup
├── types/                 # Definizioni TypeScript
└── public/                # File statici
```

## 🎨 Convenzioni Codice

- **File**: kebab-case (es. `calcolo-prezzo.ts`)
- **Componenti**: PascalCase (es. `FormSpedizione.tsx`)
- **Variabili**: camelCase italiano (es. `prezzoTotale`)
- **Commenti**: Sempre in italiano

## 🔒 Sicurezza

- ✅ `.env.local` è in `.gitignore` (non committato)
- ✅ Service Role Key usata solo server-side
- ⚠️ Genera `NEXTAUTH_SECRET` unica per produzione

Per generare `NEXTAUTH_SECRET`:

```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))

# Mac/Linux
openssl rand -base64 32
```

## 🚀 Primi Passi

1. **Avvia il progetto:**
   ```bash
   npm run dev
   ```

2. **Apri nel browser:**
   ```
   http://localhost:3000
   ```

3. **Testa le funzionalità:**
   - Homepage: `http://localhost:3000`
   - Preventivo: `http://localhost:3000/preventivo`
   - Dashboard: `http://localhost:3000/dashboard`
   - Nuova spedizione: `http://localhost:3000/dashboard/spedizioni/nuova`

## 📚 Documentazione

- **Setup Rapido Supabase**: `SETUP_RAPIDO.md`
- **Guida Supabase Completa**: `docs/SUPABASE_SETUP_GUIDE.md`
- **Setup Geo Autocomplete**: `docs/GEO_AUTOCOMPLETE_SETUP.md`
- **README Principale**: `README.md`

## ⚡ Performance

Obiettivo: **Tempo di caricamento < 2 secondi**

- ✅ Next.js 14 con App Router
- ✅ Ottimizzazioni immagini (WebP/AVIF)
- ✅ Code splitting automatico
- ✅ Compressione abilitata

## 🔍 Troubleshooting

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
```

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "TypeScript errors"
```bash
npm run type-check
```

### "Supabase connection error"
- Verifica variabili in `.env.local`
- Controlla che il progetto Supabase sia attivo
- Esegui `npm run verify:supabase`

## 📞 Supporto

- **Repository**: https://github.com/gdsgroupsas-jpg/spediresicuro.git
- **Branch principale**: `master`
- **Deploy automatico**: Push su `master` → Deploy Vercel

---

**Ultimo aggiornamento**: Setup verificato e funzionante ✅



