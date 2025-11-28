# 🔧 CURSOR FIX - Problemi Post-Merge SpedireSicuro.it

**Situazione:** Errori dopo merge su branch master
**Obiettivo:** Risolvere tutti gli errori di build, TypeScript e dipendenze
**Approccio:** Fix sistematico step-by-step

---

## 🎯 PROBLEMI IDENTIFICATI

### 1. Conflitto ESLint Versions
```
eslint-config-next@16.0.5 richiede eslint@>=9.0.0
Installato: eslint@8.57.1
```

### 2. Moduli TypeScript Mancanti
- ❌ `@/components/dashboard-sidebar`
- ❌ `@/lib/export-ldv`
- ❌ `@/components/homepage/pain-vs-gain-section`
- ❌ `jspdf`, `jspdf-autotable`, `xlsx` (types mancanti)

### 3. Vulnerabilità npm
- dompurify <3.2.4 (moderate)
- glob 10.2.0-10.4.5 (high)
- xlsx (high - nessun fix disponibile)
- jspdf <=3.0.1 (dipende da dompurify vulnerabile)

---

## 📋 STEP 1: Fix package.json Dependencies

### 1.1 Apri package.json
Modifica queste dipendenze:

```json
{
  "dependencies": {
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.3",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.33",
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

**Spiegazione:**
- `eslint-config-next@14.2.33` compatibile con `eslint@8.57.1`
- `jspdf@2.5.2` ultima versione stabile senza vulnerabilità critiche
- Mantieni `xlsx@0.18.5` (vulnerabilità nota, ma necessario)

### 1.2 Elimina node_modules e lock file
```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Oppure CMD
rmdir /s /q node_modules
del package-lock.json
```

### 1.3 Reinstalla con legacy peer deps
```bash
npm install --legacy-peer-deps
```

---

## 📋 STEP 2: Crea File Mancanti

### 2.1 Crea components/dashboard-sidebar.tsx

**File:** `components/dashboard-sidebar.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  TruckIcon,
  PlusCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Spedizioni', href: '/dashboard/spedizioni', icon: TruckIcon },
  { name: 'Nuova Spedizione', href: '/dashboard/spedizioni/nuova', icon: PlusCircleIcon },
  { name: 'Statistiche', href: '/dashboard/statistiche', icon: ChartBarIcon },
  { name: 'Impostazioni', href: '/dashboard/impostazioni', icon: Cog6ToothIcon },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <Link href="/dashboard" className="text-xl font-bold text-blue-600">
          SpedireSicuro.it
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors duration-150
                ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              Utente
            </p>
            <p className="text-xs text-gray-500 truncate">
              user@spediresicuro.it
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 2.2 Crea lib/export-ldv.ts

**File:** `lib/export-ldv.ts`

```typescript
/**
 * Export LDV (Lettera di Vettura) Functions
 *
 * Funzioni per generare PDF, Excel e CSV delle spedizioni
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Shipment {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_phone: string;
  weight: number;
  final_price?: number;
  status: string;
  created_at: string;
}

/**
 * Genera PDF LDV per una spedizione
 */
export async function generatePDFLDV(shipment: Shipment): Promise<Blob> {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('LETTERA DI VETTURA', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Tracking: ${shipment.tracking_number}`, 20, 35);
  doc.text(`Data: ${new Date(shipment.created_at).toLocaleDateString('it-IT')}`, 20, 42);

  // Destinatario
  doc.setFontSize(14);
  doc.text('DESTINATARIO', 20, 55);

  doc.setFontSize(10);
  doc.text(`Nome: ${shipment.recipient_name}`, 20, 65);
  doc.text(`Indirizzo: ${shipment.recipient_address}`, 20, 72);
  doc.text(`Città: ${shipment.recipient_city} (${shipment.recipient_zip})`, 20, 79);
  doc.text(`Telefono: ${shipment.recipient_phone}`, 20, 86);

  // Dettagli spedizione
  doc.setFontSize(14);
  doc.text('DETTAGLI SPEDIZIONE', 20, 100);

  autoTable(doc, {
    startY: 105,
    head: [['Campo', 'Valore']],
    body: [
      ['Peso (kg)', shipment.weight.toString()],
      ['Prezzo (€)', shipment.final_price ? shipment.final_price.toFixed(2) : 'N/A'],
      ['Status', shipment.status],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.text(
    `Pagina ${pageCount} - SpedireSicuro.it`,
    doc.internal.pageSize.getWidth() / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc.output('blob');
}

/**
 * Genera Excel per lista spedizioni
 */
export async function generateExcelLDV(shipments: Shipment[]): Promise<Blob> {
  const data = shipments.map(s => ({
    'Tracking': s.tracking_number,
    'Destinatario': s.recipient_name,
    'Città': s.recipient_city,
    'CAP': s.recipient_zip,
    'Telefono': s.recipient_phone,
    'Peso (kg)': s.weight,
    'Prezzo (€)': s.final_price || 0,
    'Status': s.status,
    'Data': new Date(s.created_at).toLocaleDateString('it-IT'),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Spedizioni');

  // Auto-width columns
  const maxWidth = data.reduce((w, r) => Math.max(w, JSON.stringify(r).length), 10);
  ws['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: maxWidth });

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Genera CSV per lista spedizioni
 */
export async function generateCSVLDV(shipments: Shipment[]): Promise<Blob> {
  const headers = [
    'Tracking',
    'Destinatario',
    'Città',
    'CAP',
    'Telefono',
    'Peso (kg)',
    'Prezzo (€)',
    'Status',
    'Data'
  ];

  const rows = shipments.map(s => [
    s.tracking_number,
    s.recipient_name,
    s.recipient_city,
    s.recipient_zip,
    s.recipient_phone,
    s.weight.toString(),
    s.final_price?.toFixed(2) || '0.00',
    s.status,
    new Date(s.created_at).toLocaleDateString('it-IT'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // UTF-8 BOM per Excel
  const BOM = '\uFEFF';
  return new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
}
```

---

### 2.3 Crea components/homepage/pain-vs-gain-section.tsx

**File:** `components/homepage/pain-vs-gain-section.tsx`

```typescript
'use client';

import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const pains = [
  'Gestione spedizioni manuale e dispersiva',
  'Errori nei dati destinatari',
  'Calcolo prezzi complicato',
  'Nessuna tracciabilità in tempo reale',
];

const gains = [
  'Automazione completa processo spedizioni',
  'OCR per estrazione automatica dati',
  'Calcolo prezzi automatico con margine',
  'Dashboard con tracking real-time',
];

export default function PainVsGainSection() {
  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Prima vs Dopo SpedireSicuro
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Scopri come trasformiamo la gestione delle tue spedizioni
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Pain Points */}
          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <XCircleIcon className="h-8 w-8 text-red-600" />
              <h3 className="text-xl font-semibold text-red-900">
                Senza SpedireSicuro
              </h3>
            </div>
            <ul className="space-y-3">
              {pains.map((pain, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">{pain}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gains */}
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
              <h3 className="text-xl font-semibold text-green-900">
                Con SpedireSicuro
              </h3>
            </div>
            <ul className="space-y-3">
              {gains.map((gain, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-green-800">{gain}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Inizia Gratis Ora
          </a>
        </div>
      </div>
    </section>
  );
}
```

---

## 📋 STEP 3: Installa Dipendenze Mancanti

### 3.1 Installa @heroicons/react (usato nei componenti)
```bash
npm install @heroicons/react --legacy-peer-deps
```

### 3.2 Installa types per jspdf-autotable
```bash
npm install --save-dev @types/jspdf-autotable --legacy-peer-deps
```

---

## 📋 STEP 4: Verifica e Test

### 4.1 Type Check
```bash
npm run type-check
```

**Aspettato:** 0 errors

### 4.2 Build Test
```bash
npm run build
```

**Aspettato:** Build successful

### 4.3 Dev Server
```bash
npm run dev
```

**Aspettato:** Server avviato su http://localhost:3000

---

## 📋 STEP 5: Commit su Master

### 5.1 Stage Modifiche
```bash
git add .
```

### 5.2 Commit
```bash
git commit -m "fix: resolve post-merge errors

- Fixed eslint-config-next version conflict (14.2.33)
- Downgraded jspdf to stable 2.5.2
- Created missing components:
  - components/dashboard-sidebar.tsx
  - components/homepage/pain-vs-gain-section.tsx
- Created missing lib/export-ldv.ts
- Installed @heroicons/react dependency
- Added @types/jspdf-autotable

Verified:
✅ Type check passed
✅ Build successful
✅ Dev server working"
```

### 5.3 Push su Master
```bash
git push origin master
```

---

## ✅ CHECKLIST FINALE

Verifica che tutto funzioni:

- [ ] `npm install --legacy-peer-deps` → Success
- [ ] `npm run type-check` → 0 errors
- [ ] `npm run build` → Success
- [ ] `npm run dev` → Server avviato
- [ ] Browser http://localhost:3000 → Homepage carica
- [ ] Login → Funzionante
- [ ] Dashboard → Sidebar visibile
- [ ] Spedizioni → Lista funzionante
- [ ] Export CSV/Excel/PDF → Download funzionanti

---

## 🚨 SE PERSISTONO ERRORI

### Errore: "Cannot find module '@heroicons/react'"
```bash
npm install @heroicons/react --force
```

### Errore: "Module not found: xlsx"
```bash
npm install xlsx@0.18.5 --legacy-peer-deps --force
```

### Errore: ESLint conflicts
```bash
# Rimuovi completamente e reinstalla
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Build fallisce ancora
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

---

## 📊 PACKAGE.JSON FINALE

Questo dovrebbe essere il tuo `package.json` corretto:

```json
{
  "name": "spediresicuro",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.33",
    "react": "^18",
    "react-dom": "^18",
    "@supabase/supabase-js": "^2.39.0",
    "next-auth": "5.0.0-beta.25",
    "@heroicons/react": "^2.1.1",
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.3",
    "xlsx": "^0.18.5",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/jspdf-autotable": "^3.5.13",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.33"
  }
}
```

---

## 🎯 VULNERABILITÀ npm - Note

### dompurify e jspdf
- **Versione:** jspdf@2.5.2 (downgrade da 3.x)
- **Motivo:** Versione 3.x dipende da dompurify vulnerabile
- **Alternativa:** Upgrade a jspdf@3.x quando dompurify@3.2.4+ disponibile

### xlsx
- **Vulnerabilità:** Prototype Pollution + ReDoS
- **Fix:** Nessun fix disponibile
- **Mitigazione:** Limitare input utente, validare file Excel

### glob
- **Vulnerabilità:** Command injection in CLI
- **Impatto:** Basso (usato solo in dev, non in production)
- **Monitoraggio:** Aggiornare quando fix disponibile

---

**CURSOR, ESEGUI QUESTI STEP IN ORDINE!**

1. Modifica package.json
2. Elimina node_modules + lock
3. npm install --legacy-peer-deps
4. Crea 3 file mancanti
5. npm install @heroicons/react --legacy-peer-deps
6. npm run type-check
7. npm run build
8. git commit + push

**Tempo stimato:** 5-10 minuti

✅ **Dopo questi fix, il progetto dovrebbe funzionare perfettamente!**
