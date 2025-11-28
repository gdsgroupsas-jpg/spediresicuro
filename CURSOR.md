# CURSOR.md - Guida per Cursor AI

## 🎯 Panoramica Progetto

**Ferrari Logistics Platform** - Piattaforma logistica/e-commerce di nuova generazione.

**Filosofia:** Massima potenza funzionale + costi quasi zero (Ferrari a energia solare).

---

## 🏗️ Architettura

### Stack
- **Next.js 14** (App Router)
- **TypeScript 5.3**
- **Supabase** (PostgreSQL + RLS)
- **Tailwind CSS**
- **NextAuth v5**

### Struttura Chiave

```
lib/
├── db/              # Database modules (Supabase queries)
├── adapters/        # Adapter pattern per integrazioni esterne
├── engine/          # Business logic engines
└── utils.ts         # Utilities

app/
├── api/             # API Routes
├── dashboard/       # Dashboard pages
└── ...

components/          # React components
types/               # TypeScript types
supabase/migrations/ # Database migrations
```

---

## 📐 Convenzioni Codice

### Naming
- **File**: kebab-case (`fulfillment-orchestrator.ts`)
- **Componenti React**: PascalCase (`OCRUpload.tsx`)
- **Variabili**: camelCase (`totalCost`)
- **Tipi/Interfacce**: PascalCase (`FulfillmentOption`)
- **Costanti**: UPPER_SNAKE_CASE (`MAX_RETRIES`)

### TypeScript
- ✅ **Sempre** tipi espliciti per funzioni pubbliche
- ✅ **Sempre** interfacce per oggetti complessi
- ✅ **Mai** `any` (usa `unknown` se necessario)
- ✅ Usa **utility types** (`Partial<T>`, `Pick<T>`, etc.)

### Imports
- ✅ Named exports (non default, eccetto page.tsx)
- ✅ Alias `@/` per import assoluti
- ✅ Gruppi: React → Next → Libs → Local

```typescript
import { useState } from 'react';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/db/client';
import { FulfillmentOrchestrator } from '@/lib/engine/fulfillment-orchestrator';
```

### Componenti React
- ✅ **Sempre** 'use client' se usa hooks
- ✅ Props interface esplicita
- ✅ Default props dove sensato
- ✅ Error boundaries per errori

```typescript
'use client';

interface MyComponentProps {
  title: string;
  onSubmit?: (data: any) => void;
}

export default function MyComponent({ title, onSubmit }: MyComponentProps) {
  // ...
}
```

### API Routes
- ✅ Error handling completo
- ✅ Validazione input
- ✅ Response consistenti
- ✅ Status codes appropriati

```typescript
try {
  // Validazione
  if (!input) {
    return NextResponse.json({ error: 'Input mancante' }, { status: 400 });
  }

  // Business logic
  const result = await doSomething(input);

  return NextResponse.json({ success: true, data: result });
} catch (error: any) {
  console.error('Error:', error);
  return NextResponse.json(
    { error: error.message || 'Errore interno' },
    { status: 500 }
  );
}
```

---

## 🗄️ Database (Supabase)

### Schema
- 19 tabelle production-ready
- Full-text search (GIN indexes)
- Row Level Security (RLS)
- Triggers automatici

### Moduli DB (`lib/db/`)

Ogni modulo ha pattern consistente:

```typescript
// CRUD
export async function createEntity(data: CreateInput): Promise<Entity> { }
export async function getEntityById(id: string): Promise<Entity | null> { }
export async function listEntities(filters?: Filters): Promise<Entity[]> { }
export async function updateEntity(id: string, updates: UpdateInput): Promise<Entity> { }
export async function deleteEntity(id: string): Promise<void> { }

// Business logic specifico
export async function doSpecificThing(): Promise<Result> { }
```

**Regole:**
- ✅ **Sempre** usa `supabase` client (con RLS) per query user-scoped
- ✅ Usa `supabaseAdmin` solo per operazioni server-side che bypassano RLS
- ✅ Error handling graceful (throw Error con messaggio chiaro)
- ✅ Type-safe queries (usa types da `types/`)

---

## 🔌 Adapter Pattern

Tutti gli adapter esterni seguono questa struttura:

```typescript
// 1. Base interface
export abstract class BaseAdapter {
  abstract connect(): Promise<boolean>;
  abstract doSomething(input: Input): Promise<Output>;
}

// 2. Implementazione specifica
export class ConcreteAdapter extends BaseAdapter {
  async connect(): Promise<boolean> {
    // Implementazione
  }
  // ...
}

// 3. Factory
export function createAdapter(type: string): BaseAdapter {
  switch (type) {
    case 'foo': return new FooAdapter();
    case 'bar': return new BarAdapter();
  }
}
```

**Categorie adapter:**
- `adapters/ecommerce/` - Shopify, WooCommerce, etc.
- `adapters/ocr/` - OCR providers
- `adapters/export/` - CSV, XLSX, PDF
- `adapters/couriers/` - API corrieri
- `adapters/social/` - Meta, TikTok, etc.

---

## 🧠 Business Engines (`lib/engine/`)

### Fulfillment Orchestrator

**Il più importante!** Decide dove e come evadere ordini.

```typescript
import { createFulfillmentOrchestrator } from '@/lib/engine/fulfillment-orchestrator';

const orchestrator = createFulfillmentOrchestrator({
  cost: 0.40,    // Peso costo
  time: 0.30,    // Peso tempo
  quality: 0.20, // Peso qualità
  margin: 0.10,  // Peso margine
});

const decision = await orchestrator.decide({
  items: [{ product_id: '...', quantity: 2 }],
  destination: { zip: '20100', city: 'Milano' },
});

// decision contiene opzione raccomandata + tutte le alternative
```

**Algoritmo:**
1. Trova tutte le opzioni (magazzini + fornitori × corrieri)
2. Calcola metriche (costo, tempo, qualità, margine)
3. Normalizza (0-100)
4. Applica pesi → score finale
5. Ordina per score
6. Ritorna opzione best + rationale

---

## 🎨 UI Components

### Struttura Componente

```typescript
'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface MyComponentProps {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
}

export default function MyComponent({ title, onSubmit }: MyComponentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);

    try {
      await onSubmit(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{title}</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* UI content */}

      <button
        onClick={() => handleSubmit(data)}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Caricamento...' : 'Invia'}
      </button>
    </div>
  );
}
```

### Tailwind Utilities Comuni

```css
/* Layout */
.container: max-w-7xl mx-auto px-4
.space-y-4: gap verticale 1rem tra children

/* Buttons */
.btn-primary: px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
.btn-secondary: px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300

/* Cards */
.card: bg-white border border-gray-200 rounded-lg shadow-sm p-6

/* Alerts */
.alert-success: p-4 bg-green-50 border border-green-200 rounded-lg
.alert-error: p-4 bg-red-50 border border-red-200 rounded-lg
.alert-warning: p-4 bg-yellow-50 border border-yellow-200 rounded-lg
.alert-info: p-4 bg-blue-50 border border-blue-200 rounded-lg
```

---

## 🔐 Sicurezza

### Environment Variables

**Mai committare secrets!** Usa sempre `.env.local`:

```env
# Public (può essere esposto client-side)
NEXT_PUBLIC_SUPABASE_URL=...

# Private (solo server-side)
SUPABASE_SERVICE_ROLE_KEY=...
NEXTAUTH_SECRET=...
```

**Access in code:**
```typescript
// Client-side (componenti React)
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Server-side only (API routes, server components)
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### Input Validation

- ✅ **Sempre** valida input utente
- ✅ Usa TypeScript types per type checking
- ✅ TODO: Usa Zod per validation schemas (Step 16)

### Database Security

- ✅ Row Level Security (RLS) abilitato
- ✅ Usa `supabase` client (con RLS) per query user
- ✅ Usa `supabaseAdmin` solo server-side per operazioni trusted

---

## 🧪 Testing

### Comandi

```bash
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm run build        # Build check
```

### Mock Adapters

Usa mock per testing senza costi:

```typescript
// OCR Mock (sempre disponibile)
import { createOCRAdapter } from '@/lib/adapters/ocr';
const ocr = createOCRAdapter('mock');

// Courier Mock
import { MockCourierAdapter } from '@/lib/adapters/couriers/base';
const courier = new MockCourierAdapter();

// Social Mock
import { MockSocialAdapter } from '@/lib/adapters/social/base';
const social = new MockSocialAdapter();
```

---

## 📈 Performance

### Best Practices

- ✅ Use Next.js Image component per immagini
- ✅ Lazy load componenti pesanti (`React.lazy()`)
- ✅ Pagination per liste lunghe (default: 50 items)
- ✅ Database indexes (già implementati in schema)
- ✅ SWR/React Query per cache client-side (TODO: Step 17)

### Database Query Optimization

```typescript
// ✅ GOOD: Select solo campi necessari
const { data } = await supabase
  .from('shipments')
  .select('id, tracking_number, status')
  .eq('user_id', userId);

// ❌ BAD: Select *
const { data } = await supabase
  .from('shipments')
  .select('*');
```

---

## 🐛 Debugging

### Logging

```typescript
// Development
console.log('[ComponentName] Debug info:', data);

// Error
console.error('[ComponentName] Error:', error);

// Production (TODO: Sentry)
// Sentry.captureException(error);
```

### Common Issues

**"Module not found":**
```bash
npm install
```

**"Type error":**
```bash
npm run type-check
```

**"Supabase RLS error":**
- Check policy in `supabase/migrations/001_complete_schema.sql`
- Verifica auth token
- Usa `supabaseAdmin` se operazione trusted

---

## 🚀 Workflow Development

### 1. Nuova Feature

```bash
# 1. Crea branch
git checkout -b feature/nome-feature

# 2. Se serve DB → aggiungi migration
# supabase/migrations/002_nome_feature.sql

# 3. Se serve types → aggiungi in types/
# types/nome-feature.ts

# 4. Implementa logica in lib/
# lib/db/nome-feature.ts o lib/engine/nome-feature.ts

# 5. Crea API route se necessario
# app/api/nome-feature/route.ts

# 6. Crea UI component
# components/nome-feature.tsx

# 7. Crea page
# app/dashboard/nome-feature/page.tsx

# 8. Test
npm run type-check
npm run build

# 9. Commit
git add .
git commit -m "feat: descrizione feature"
git push origin feature/nome-feature
```

### 2. Bug Fix

```bash
git checkout -b fix/descrizione-bug
# Fix code
npm run type-check
git commit -m "fix: descrizione fix"
git push origin fix/descrizione-bug
```

### 3. Refactoring

```bash
git checkout -b refactor/descrizione
# Refactor code (no new features, no bug fixes)
npm run type-check
npm run build
git commit -m "refactor: descrizione"
```

---

## 📚 Documentazione

### Dove Cercare

- `FERRARI_LOGISTICS_PLATFORM.md` - Overview completo progetto
- `README.md` - Quick start
- `CURSOR.md` - Questa guida
- `types/` - Tipi TypeScript (auto-documentanti)
- `lib/adapters/*/base.ts` - Interfacce adapter
- Commenti JSDoc in codice

### Come Documentare

```typescript
/**
 * Descrizione funzione in italiano
 *
 * @param input - Descrizione parametro
 * @returns Descrizione output
 * @throws Error se condizione
 *
 * @example
 * const result = await myFunction(input);
 */
export async function myFunction(input: string): Promise<Result> {
  // Implementation
}
```

---

## ✅ Checklist Contributi

Prima di committare:

- [ ] `npm run type-check` passa
- [ ] `npm run lint` passa (oppure fix)
- [ ] `npm run build` passa
- [ ] Codice segue convenzioni
- [ ] Secrets non committati
- [ ] Commenti/JSDoc aggiunti dove necessario
- [ ] Types aggiornati se cambi interfacce
- [ ] README/docs aggiornati se feature nuova

---

## 🎯 Feature Priority

**Alta priorità** (implementare prima):
1. E-commerce integrations UI
2. Listini import UI
3. Export buttons in dashboard
4. Fulfillment execution (auto)

**Media priorità**:
1. Geo-marketing dashboard
2. Social intelligence UI
3. Magazzino/inventory UI

**Bassa priorità**:
1. API corrieri reali
2. Mobile app
3. AI/ML enhancements

---

## 🆘 Help

**Problemi comuni:**

- Type errors → Controlla `types/` e imports
- Build errors → `rm -rf .next && npm run build`
- DB errors → Controlla migrations + RLS policies
- Auth errors → Verifica `.env.local` + NextAuth config

**Dove chiedere aiuto:**
- GitHub Issues
- Email: [TODO]
- Discord: [TODO]

---

**Buon coding! 🚀**
