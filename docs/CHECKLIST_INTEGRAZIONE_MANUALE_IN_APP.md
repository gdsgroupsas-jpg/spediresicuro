# ✅ Checklist Tecnica: Integrazione Manuale Utente In-App

> **Obiettivo:** Rendere il manuale utente leggibile IN-APP, protetto dopo login, usando `docs/MANUALE_UTENTE_RESELLER_V1.md` come source of truth.

---

## 📋 Stato Attuale

### ✅ Già Esistente

1. **File Markdown:** `docs/MANUALE_UTENTE_RESELLER_V1.md` (source of truth)
2. **Libreria Markdown:** `react-markdown` + `remark-gfm` (già installate)
3. **Pagina Pubblica:** `app/manuale/page.tsx` (legge `MANUALE_UTENTE.md` dalla root)
4. **Sidebar Config:** `lib/config/navigationConfig.ts` (ha voce "Manuale Utente" → `/manuale`)
5. **Dashboard Layout:** `app/dashboard/layout.tsx` (protegge tutte le route `/dashboard/**`)
6. **Middleware:** `middleware.ts` (protegge `/dashboard/**`, permette `/manuale` pubblico)

### ❌ Da Fare

1. Creare pagina protetta `/dashboard/manuale`
2. Aggiornare sidebar per puntare a `/dashboard/manuale`
3. Proteggere/disabilitare `/manuale` pubblico

---

## 🔧 Implementazione

### Step 1: Creare Pagina Protetta Dashboard

**File da creare:** `app/dashboard/manuale/page.tsx`

**Requisiti:**
- Server Component (async)
- Legge `docs/MANUALE_UTENTE_RESELLER_V1.md`
- Usa `react-markdown` con stili dashboard
- Layout dashboard (sidebar inclusa)
- Protezione automatica via `app/dashboard/layout.tsx`

**Template base:**
```typescript
import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DashboardNav from '@/components/dashboard-nav';

export const dynamic = 'force-dynamic';

async function getManualContent(): Promise<string> {
  try {
    const manualPath = path.join(process.cwd(), 'docs', 'MANUALE_UTENTE_RESELLER_V1.md');
    return await fs.readFile(manualPath, 'utf-8');
  } catch (error) {
    console.error('Errore lettura manuale:', error);
    return '# Errore\n\nManuale non disponibile.';
  }
}

// Componenti Markdown con stili dashboard (non dark mode)
const markdownComponents: Components = {
  // ... stili chiari per dashboard
};

export default async function ManualeDashboardPage() {
  const content = await getManualContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav
        title="Manuale Utente"
        subtitle="Documentazione completa per reseller e point fisici"
        showBackButton={true}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

**Stili Markdown per Dashboard:**
- Background bianco (non dark)
- Testo grigio scuro (non bianco)
- Link arancioni (`#FF9500`)
- Code blocks con sfondo grigio chiaro
- Tabelle con bordi sottili
- Heading con colori dashboard

---

### Step 2: Aggiornare Navigation Config

**File da modificare:** `lib/config/navigationConfig.ts`

**Modifica necessaria:**
```typescript
const supportSection: NavSection = {
  id: 'support',
  label: 'Supporto',
  collapsible: false,
  items: [
    {
      id: 'manual',
      label: 'Manuale Utente',
      href: '/dashboard/manuale', // ⚠️ CAMBIARE da /manuale a /dashboard/manuale
      icon: BookOpen,
      description: 'Documentazione completa',
    },
  ],
};
```

**Linea da modificare:** ~220 (href da `/manuale` a `/dashboard/manuale`)

---

### Step 3: Proteggere/Disabilitare Route Pubblica

**Opzione A: Redirect a Dashboard (Consigliata)**

**File da modificare:** `app/manuale/page.tsx`

**Modifica:**
```typescript
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';

export default async function ManualePage() {
  // Verifica autenticazione
  const session = await auth();
  
  if (session) {
    // Se autenticato, redirect a versione protetta
    redirect('/dashboard/manuale');
  }
  
  // Se non autenticato, mostra versione pubblica (opzionale)
  // OPPURE redirect a login
  redirect('/login?callbackUrl=/dashboard/manuale');
}
```

**Opzione B: 404/Not Found**

**File da modificare:** `app/manuale/page.tsx`

**Modifica:**
```typescript
import { notFound } from 'next/navigation';

export default async function ManualePage() {
  // Disabilita completamente la route pubblica
  notFound();
}
```

**Opzione C: Mantenere Pubblica ma Aggiornare File**

**File da modificare:** `app/manuale/page.tsx`

**Modifica path:**
```typescript
async function getManualContent(): Promise<string> {
  try {
    const manualPath = path.join(process.cwd(), 'docs', 'MANUALE_UTENTE_RESELLER_V1.md');
    // ⚠️ CAMBIARE da 'MANUALE_UTENTE.md' a 'docs/MANUALE_UTENTE_RESELLER_V1.md'
    return await fs.readFile(manualPath, 'utf-8');
  } catch (error) {
    // ...
  }
}
```

**Raccomandazione:** Opzione A (redirect) - mantiene compatibilità ma indirizza utenti autenticati alla versione protetta.

---

### Step 4: Aggiornare Middleware (Opzionale)

**File da modificare:** `middleware.ts`

**Se si sceglie Opzione B (404):**
- Rimuovere `/manuale` da `PUBLIC_ROUTES` (linea ~44)

**Se si sceglie Opzione A (redirect):**
- Mantenere `/manuale` in `PUBLIC_ROUTES` (per permettere redirect)

---

## 📁 File Coinvolti

### File da Creare

1. `app/dashboard/manuale/page.tsx` (nuovo)

### File da Modificare

1. `lib/config/navigationConfig.ts` (linea ~220: href `/manuale` → `/dashboard/manuale`)
2. `app/manuale/page.tsx` (redirect o 404 - opzionale)

### File da Verificare (Nessuna Modifica)

1. `app/dashboard/layout.tsx` (già protegge `/dashboard/**`)
2. `middleware.ts` (già protegge `/dashboard/**`)
3. `package.json` (già ha `react-markdown` e `remark-gfm`)

---

## 🎨 Stili Markdown Dashboard

**Componenti da usare in `app/dashboard/manuale/page.tsx`:**

```typescript
const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="text-4xl font-bold text-gray-900 mt-10 mb-4 leading-tight" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="text-3xl font-semibold text-gray-900 mt-10 mb-4 leading-snug" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-3 leading-snug" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="text-xl font-semibold text-gray-800 mt-6 mb-3 leading-snug" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="text-gray-700 leading-relaxed mb-4" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-[#FF9500] hover:text-[#FFB84D] underline underline-offset-2 font-semibold"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4 ml-4" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4 ml-4" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="leading-relaxed" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="text-gray-900 font-semibold" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-4 border-[#FF9500] pl-4 italic text-gray-700 bg-orange-50 rounded-r-xl py-2 pr-3 mb-6"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }) => {
    const codeClass = className ? String(className) : '';
    const isInline = !className?.includes('language-');

    if (isInline) {
      return (
        <code
          className={`px-2 py-1 rounded-md bg-gray-100 text-[#FF9500] font-mono text-sm ${codeClass}`}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-gray-900 border border-gray-200 rounded-xl p-4 overflow-x-auto mb-6">
        <code
          className={`text-sm text-gray-100 font-mono leading-relaxed ${codeClass}`}
          {...props}
        >
          {children}
        </code>
      </pre>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto my-6 rounded-2xl border border-gray-200">
      <table className="min-w-full text-left text-gray-700" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead className="bg-gray-50" {...props} />
  ),
  th: ({ node: _node, ...props }) => (
    <th className="px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="px-4 py-3 text-sm border-b border-gray-200 align-top" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="border-t border-gray-200 my-8" {...props} />
  ),
};
```

---

## 🔒 Routing Consigliato

### Route Protetta (Principale)

**URL:** `/dashboard/manuale`

**Protezione:**
- ✅ Automatica via `app/dashboard/layout.tsx`
- ✅ Richiede autenticazione
- ✅ Richiede dati cliente completati (via middleware)

**Accesso:**
- Sidebar → Sezione "Supporto" → "Manuale Utente"
- URL diretto (se autenticato)

### Route Pubblica (Opzionale)

**URL:** `/manuale`

**Comportamento consigliato:**
- Se autenticato → redirect a `/dashboard/manuale`
- Se non autenticato → redirect a `/login?callbackUrl=/dashboard/manuale`

**Alternativa:**
- 404 Not Found (disabilita completamente)

---

## ✅ Checklist Esecuzione

### Fase 1: Creazione Pagina Protetta

- [ ] Creare `app/dashboard/manuale/page.tsx`
- [ ] Implementare funzione `getManualContent()` che legge `docs/MANUALE_UTENTE_RESELLER_V1.md`
- [ ] Implementare componenti Markdown con stili dashboard (chiari, non dark)
- [ ] Usare `DashboardNav` per header
- [ ] Testare rendering markdown

### Fase 2: Aggiornamento Sidebar

- [ ] Modificare `lib/config/navigationConfig.ts` linea ~220
- [ ] Cambiare `href: '/manuale'` in `href: '/dashboard/manuale'`
- [ ] Verificare che la voce appaia nella sidebar dopo login

### Fase 3: Protezione Route Pubblica

- [ ] Scegliere opzione (A: redirect, B: 404, C: mantenere)
- [ ] Modificare `app/manuale/page.tsx` di conseguenza
- [ ] Se opzione B, rimuovere `/manuale` da `middleware.ts` PUBLIC_ROUTES
- [ ] Testare comportamento route pubblica

### Fase 4: Testing e Verifica

- [ ] Test accesso `/dashboard/manuale` dopo login → deve funzionare
- [ ] Test accesso `/dashboard/manuale` senza login → redirect a `/login`
- [ ] Test sidebar → link "Manuale Utente" porta a `/dashboard/manuale`
- [ ] Test route pubblica `/manuale` → comportamento corretto (redirect/404)
- [ ] Verificare che il contenuto Markdown sia leggibile
- [ ] Verificare che gli stili siano coerenti con dashboard

---

## 🚨 Note Importanti

### Source of Truth

**File unico:** `docs/MANUALE_UTENTE_RESELLER_V1.md`

- ✅ Modifiche al manuale: editare SOLO questo file
- ✅ Nessuna duplicazione
- ✅ Build-time reading (non runtime API)

### Protezione

- ✅ Route `/dashboard/manuale` protetta automaticamente
- ✅ Richiede autenticazione
- ✅ Richiede dati cliente completati
- ✅ Sidebar mostra solo se autenticato

### Compatibilità

- ✅ Nessun breaking change per utenti esistenti
- ✅ Redirect automatico da `/manuale` a `/dashboard/manuale` (se autenticati)
- ✅ Sidebar aggiornata automaticamente

---

## 📝 Esempio Implementazione Completa

Vedi file separato: `app/dashboard/manuale/page.tsx` (da creare)

---

**Fine Checklist**

