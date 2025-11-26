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

## 🛠️ Installazione

1. Installa le dipendenze:
```bash
npm install
```

2. Avvia il server di sviluppo:
```bash
npm run dev
```

3. Apri [http://localhost:3000](http://localhost:3000) nel browser

## 📁 Struttura Progetto

```
spediresicuro.it/
├── app/              # App Router di Next.js 14
│   ├── layout.tsx   # Layout principale
│   └── page.tsx     # Homepage
├── components/       # Componenti React riutilizzabili
├── lib/             # Funzioni utility e logica
├── types/            # Definizioni TypeScript
└── data/            # Database JSON locale (temporaneo)
```

## 🎨 Convenzioni Codice

- **File**: kebab-case (es. `calcolo-prezzo.ts`)
- **Componenti**: PascalCase (es. `FormSpedizione.tsx`)
- **Variabili**: camelCase italiano (es. `prezzoTotale`)
- **Commenti**: Sempre in italiano

## ⚡ Performance

Obiettivo: Tempo di caricamento sotto 2 secondi

## 🔒 GDPR

Tutte le funzionalità devono essere GDPR compliant

## 💰 Budget

Priorità a soluzioni gratuite o low-cost

