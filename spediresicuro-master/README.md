# SpedireSicuro.it

Piattaforma per preventivi spedizioni con ricarico.

## 🚀 Stack Tecnologico

- **Next.js 14** - Framework React per applicazioni web
- **TypeScript** - Linguaggio tipizzato per maggiore sicurezza
- **Tailwind CSS** - Framework CSS per styling veloce
- **Vercel** - Hosting gratuito

## 📋 Funzionalità Principali

1. **Landing Page Preventivo** - Pagina iniziale per calcolo preventivi
2. **Form Spedizione** - Form per inserire dati spedizione
3. **Calcolo Margine** - Sistema per calcolare margini configurabili
4. **Tracking** - Tracciamento spedizioni
5. **Dashboard** - Pannello di controllo
6. **Pagamenti** - Gestione pagamenti (da implementare)

## 🛠️ Installazione e Avvio

### Prerequisiti

Prima di iniziare, assicurati di avere installato:
- **Node.js** (versione 18 o superiore) - [Scarica qui](https://nodejs.org/)
- **npm** (viene installato automaticamente con Node.js)

### Passo 1: Clona il Repository

Se non hai ancora il progetto, clonalo:
```bash
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git
cd spediresicuro
```

### Passo 2: Installa le Dipendenze

Installa tutti i pacchetti necessari:
```bash
npm install
```

Questo comando leggerà il file `package.json` e installerà tutte le librerie necessarie (Next.js, React, TypeScript, Tailwind CSS, ecc.).

### Passo 3: Configura le Variabili d'Ambiente

1. **Copia il file di esempio:**
   ```bash
   # Su Windows (PowerShell)
   Copy-Item env.example.txt .env.local
   
   # Su Mac/Linux
   cp env.example.txt .env.local
   ```

2. **Apri il file `.env.local`** con un editor di testo e modifica i valori se necessario (per iniziare puoi lasciare quelli di default).

### Passo 4: Avvia il Server di Sviluppo

```bash
npm run dev
```

Dovresti vedere un messaggio simile a:
```
✓ Ready in 2.3s
○ Local:        http://localhost:3000
```

### Passo 5: Apri nel Browser

Apri il browser e vai su: **http://localhost:3000**

Vedrai la homepage del progetto!

## 📁 Struttura Completa del Progetto

```
spediresicuro/
├── app/                      # App Router di Next.js 14
│   ├── api/                  # API Routes (endpoint backend)
│   │   └── health/           # Endpoint per health check
│   ├── preventivo/           # Pagina preventivo
│   │   └── page.tsx
│   ├── dashboard/            # Pagina dashboard
│   │   └── page.tsx
│   ├── layout.tsx            # Layout principale (header, footer)
│   ├── page.tsx              # Homepage
│   └── globals.css           # Stili globali
│
├── components/               # Componenti React riutilizzabili
│   ├── header.tsx            # Header del sito
│   ├── footer.tsx            # Footer del sito
│   ├── hero-section.tsx      # Sezione hero
│   └── logo/                 # Componenti logo
│
├── lib/                      # Funzioni utility e logica
│   ├── utils.ts              # Funzioni di utilità
│   ├── constants.ts          # Costanti dell'applicazione
│   └── database.ts           # Gestione database JSON locale
│
├── types/                    # Definizioni TypeScript
│   └── index.ts              # Tipi e interfacce
│
├── data/                     # Database JSON locale (temporaneo)
│   └── database.json         # File database (creato automaticamente)
│
├── public/                   # File statici (immagini, favicon, ecc.)
│   ├── brand/                # Asset del brand
│   └── favicon.svg
│
├── scripts/                  # Script di utilità
│
├── middleware.ts             # Middleware Next.js (eseguito su ogni richiesta)
├── next.config.js            # Configurazione Next.js
├── tailwind.config.js        # Configurazione Tailwind CSS
├── tsconfig.json             # Configurazione TypeScript
├── package.json              # Dipendenze e script del progetto
├── env.example.txt           # Esempio file variabili ambiente
└── README.md                 # Questo file
```

## 🎯 Primi Passi per Sviluppare

### 1. Modificare la Homepage

Il file principale della homepage è: `app/page.tsx`

Apri questo file e modifica il contenuto per vedere le modifiche in tempo reale nel browser.

### 2. Creare una Nuova Pagina

Per creare una nuova pagina, crea una cartella in `app/` con un file `page.tsx`:

```
app/mia-pagina/page.tsx
```

La pagina sarà automaticamente disponibile all'URL: `http://localhost:3000/mia-pagina`

### 3. Creare un Nuovo Componente

Crea un nuovo file in `components/`:

```typescript
// components/MioComponente.tsx
export default function MioComponente() {
  return <div>Ciao!</div>;
}
```

Poi importalo dove ti serve:
```typescript
import MioComponente from '@/components/MioComponente';
```

### 4. Usare il Database Locale

Il database JSON è gestito tramite le funzioni in `lib/database.ts`:

```typescript
import { addSpedizione, getSpedizioni } from '@/lib/database';

// Aggiungere una spedizione
addSpedizione({
  destinatario: 'Mario Rossi',
  indirizzo: 'Via Roma 1',
  // ... altri dati
});

// Leggere tutte le spedizioni
const spedizioni = getSpedizioni();
```

### 5. Configurare i Margini

I margini predefiniti sono in `lib/constants.ts`. Puoi modificarli o usarli così:

```typescript
import { MARGINI } from '@/lib/constants';

const margine = MARGINI.DEFAULT; // 15%
```

## 📝 Comandi Disponibili

```bash
# Sviluppo (avvia server locale)
npm run dev

# Build per produzione
npm run build

# Avvia versione produzione (dopo build)
npm start

# Controlla errori di codice
npm run lint
```

## 🎨 Convenzioni Codice

- **File**: kebab-case (es. `calcolo-prezzo.ts`)
- **Componenti**: PascalCase (es. `FormSpedizione.tsx`)
- **Variabili**: camelCase italiano (es. `prezzoTotale`)
- **Commenti**: Sempre in italiano
- **Cartelle**: kebab-case (es. `app/preventivo/`)

## 🔧 Configurazione

### Variabili d'Ambiente

Le variabili d'ambiente sono nel file `.env.local` (non committato nel repository).

Copia `env.example.txt` in `.env.local` e modifica i valori.

### Tailwind CSS

I colori del brand sono configurati in `tailwind.config.js`. Puoi usarli così:

```tsx
<div className="bg-brand-yellow-start text-brand-black">
  Testo con colori brand
</div>
```

## 🚀 Deploy su Vercel

Il progetto è configurato per il deploy automatico su Vercel:

1. **Push su GitHub** → Deploy automatico
2. Ogni push sul branch `master` attiva un nuovo deploy
3. Vercel usa la configurazione in `vercel.json`

Per configurare Vercel:
1. Vai su [vercel.com](https://vercel.com)
2. Collega il repository GitHub
3. Vercel rileverà automaticamente Next.js e configurerà tutto

## ⚡ Performance

Obiettivo: Tempo di caricamento sotto 2 secondi

- Usa immagini ottimizzate (formato WebP/AVIF)
- Lazy loading per componenti pesanti
- Code splitting automatico di Next.js

## 🔒 GDPR

Tutte le funzionalità devono essere GDPR compliant:
- Cookie banner (da implementare)
- Privacy policy
- Gestione consensi utente

## 💰 Budget

Priorità a soluzioni gratuite o low-cost:
- Vercel: hosting gratuito
- Database: JSON locale → PostgreSQL Vercel (gratuito per tier base)
- Analytics: Google Analytics gratuito

## 📚 Risorse Utili

- [Documentazione Next.js](https://nextjs.org/docs)
- [Documentazione Tailwind CSS](https://tailwindcss.com/docs)
- [Documentazione TypeScript](https://www.typescriptlang.org/docs/)

## 🆘 Problemi Comuni

### "Port 3000 already in use"
Se la porta 3000 è occupata, puoi cambiarla:
```bash
npm run dev -- -p 3001
```

### "Module not found"
Reinstalla le dipendenze:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Errori TypeScript
Controlla che tutti i file `.ts` e `.tsx` abbiano la sintassi corretta. Il linter ti aiuterà:
```bash
npm run lint
```

## 📞 Supporto

Per problemi o domande, consulta la documentazione o apri una issue su GitHub.

