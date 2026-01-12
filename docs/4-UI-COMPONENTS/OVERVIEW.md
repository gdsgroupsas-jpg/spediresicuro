# UI Components Overview - SpedireSicuro

## Overview
Questa documentazione descrive il sistema componenti UI di SpedireSicuro, basato su Shadcn/UI e componenti custom.

## Target Audience
- [x] Developers
- [ ] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites
- React hooks familiarity
- Tailwind CSS basics
- TypeScript basics

## Quick Reference
| Sezione | Pagina | Link |
|---------|--------|------|
| Shadcn/UI | docs/4-UI-COMPONENTS/SHADCN_UI.md | [Shadcn/UI](#shadcnui-integration) |
| Componenti Custom | docs/4-UI-COMPONENTS/CUSTOM_COMPONENTS.md | [Custom](#componenti-custom) |
| Dashboard | docs/4-UI-COMPONENTS/DASHBOARDS.md | [Dashboard](#dashboard-patterns) |
| Forms | docs/4-UI-COMPONENTS/FORMS.md | [Forms](#form-patterns) |

## Content

### Sistema Componenti

**Struttura Cartelle:**
```
components/
├── ui/                        # Shadcn/UI base components
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── textarea.tsx
│   ├── card.tsx
│   ├── dropdown-menu.tsx
│   ├── switch.tsx
│   ├── tabs.tsx
│   └── ...
├── admin/                     # Admin components
│   ├── ai-features/
│   └── platform-fee/
├── ai/                        # AI components
│   ├── anne/
│   ├── pilot/
│   └── voice-control-panel.tsx
├── anne/                      # Anne assistant components
│   ├── AnneAssistant.tsx
│   ├── AnneContext.tsx
│   └── ...
├── bookings/                  # Booking components
├── dashboard-nav.tsx          # Navigation
├── dashboard-sidebar.tsx       # Sidebar
├── integrazioni/               # Integration wizards
│   ├── SpedisciOnlineWizard.tsx
│   ├── PosteWizard.tsx
│   └── ...
├── listini/                   # Price list components
│   ├── supplier-price-list-table.tsx
│   ├── create-customer-price-list-dialog.tsx
│   └── ...
├── ocr/                       # OCR components
│   └── ocr-upload.tsx
├── shipments/                 # Shipment components
│   ├── intelligent-quote-comparator.tsx
│   ├── contract-comparison.tsx
│   └── courier-quote-card.tsx
├── wallet/                    # Wallet components
│   └── recharge-wallet-dialog.tsx
└── shared/                    # Shared utility components
    ├── confirm-action-dialog.tsx
    ├── empty-state.tsx
    └── data-table-skeleton.tsx
```

### Shadcn/UI Integration

**Setup:**
- Componenti base in `components/ui/`
- Basati su Radix UI (accessibilità)
- Styled con Tailwind CSS
- Copia-manutenzione (non npm install)

**Componenti Disponibili:**

#### Button (`components/ui/button.tsx`)
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  isLoading?: boolean
}

// Esempi
<Button variant="default">Predefinito</Button>
<Button variant="outline" size="sm">Piccolo</Button>
<Button isLoading>Caricamento...</Button>
```

**Variants:**
- `default`: Gradient giallo/arancione (brand colors)
- `destructive`: Rosso per azioni distruttive
- `outline`: Bordo grigio
- `secondary`: Grigio chiaro
- `ghost`: Senza sfondo
- `link`: Link stile (underline)

#### Dialog (`components/ui/dialog.tsx`)
```typescript
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Titolo Modale</DialogTitle>
      <DialogDescription>Descrizione</DialogDescription>
    </DialogHeader>
    <DialogBody>
      {/* Contenuto */}
    </DialogBody>
    <DialogFooter>
      <Button onClick={handleConfirm}>Conferma</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Input (`components/ui/input.tsx`)
```typescript
<Input
  type="text"
  placeholder="Inserisci testo"
  className="border-gray-300"
/>

// Con validazione
<Input
  type="email"
  placeholder="Email"
  className={cn(
    "border-gray-300",
    error && "border-red-500"
  )}
/>
```

#### Select (`components/ui/select.tsx`)
```typescript
<Select onValueChange={handleSelect}>
  <SelectTrigger>
    <SelectValue placeholder="Seleziona opzione" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Opzione 1</SelectItem>
    <SelectItem value="option2">Opzione 2</SelectItem>
  </SelectContent>
</Select>
```

#### Card (`components/ui/card.tsx`)
```typescript
<Card>
  <CardHeader>
    <CardTitle>Titolo Card</CardTitle>
    <CardDescription>Descrizione</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenuto */}
  </CardContent>
  <CardFooter>
    {/* Footer */}
  </CardFooter>
</Card>
```

### Componenti Custom

#### Dashboard Navigation (`components/dashboard-nav.tsx`)
Navigazione premium per dashboard con breadcrumbs e quick actions.

```typescript
<DashboardNav
  title="Nuova Spedizione"
  subtitle="Compila i dati per creare una nuova spedizione"
  showBackButton={true}
  actions={
    <Button onClick={handleAction}>Azioni Rapide</Button>
  }
/>
```

**Features:**
- Breadcrumbs automatici da pathname
- Sticky navbar con glassmorphism
- Back button con animazioni
- Actions slot per pulsanti custom

#### Intelligent Quote Comparator (`components/shipments/intelligent-quote-comparator.tsx`)
Componente preventivatore intelligente che compara più corrieri.

```typescript
<IntelligentQuoteComparator
  couriers={availableCouriers}
  weight={parseFloat(peso)}
  zip={destinatarioCap}
  province={destinatarioProvincia}
  city={destinatarioCitta}
  services={tipoSpedizione === "express" ? ["express"] : []}
  insuranceValue={0}
  codValue={parseFloat(contrassegnoAmount)}
  dimensions={{
    length: parseFloat(lunghezza),
    width: parseFloat(larghezza),
    height: parseFloat(altezza),
  }}
  useDbFirst={true}
  onQuoteReceived={(courierName, contractCode, quote) => {
    // Callback quando quote ricevuto
  }}
  onContractSelected={(courierName, contractCode, accessoryService, configId) => {
    // Callback quando contratto selezionato
  }}
/>
```

**Features:**
- Attivazione automatica quando dati completi
- DB-first con fallback API
- Filtro destinazione (Italia vs internazionale)
- Mapping flessibile contract codes
- Gestione servizi accessori dinamica
- Progresso globale + stato per singolo corriere

#### OCR Upload (`components/ocr/ocr-upload.tsx`)
Componente per upload immagini con estrazione dati OCR.

```typescript
<OCRUpload
  onDataExtracted={(data) => {
    // Popola form con dati estratti
    setFormData({
      destinatarioNome: data.recipient_name || "",
      destinatarioIndirizzo: data.recipient_address || "",
      // ...
    });
  }}
  onError={(error) => {
    // Gestisci errore OCR
    setSubmitError(`Errore OCR: ${error}`);
  }}
/>
```

### Pattern Riutilizzabili

#### Smart Input Pattern
Input con validazione in tempo reale e feedback visivo.

```typescript
function SmartInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  icon: Icon,
  isValid,
  errorMessage,
}) {
  const hasValue = value.length > 0;
  const showValid = hasValue && isValid === true;
  const showError = hasValue && isValid === false;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className={`w-full px-4 ${Icon ? "pl-10" : ""} pr-10 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
            showError
              ? "border-red-500 ring-2 ring-red-200 focus:ring-red-500 focus:border-red-600 bg-red-50"
              : showValid
              ? "border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50"
              : "border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400"
          } focus:outline-none placeholder:text-gray-500`}
        />
        {showValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
        {showError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
      </div>
      {showError && errorMessage && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
```

#### Card Pattern
Container con bordo arrotondato e shadow elegante.

```typescript
function SmartCard({
  title,
  icon: Icon,
  children,
  className = "",
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          {Icon && (
            <div className="p-2 bg-gradient-to-br from-[#FFD700] to-[#FF9500] rounded-lg">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}
```

#### Progress Bar Pattern
Indicatore di progresso visuale.

```typescript
function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#FFD700] to-[#FF9500] transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

### Componenti Principali

#### Dashboard Components
- `DashboardNav` - Navigazione con breadcrumbs
- `DashboardSidebar` - Sidebar con menu
- `DashboardMobileNav` - Navigation mobile

#### Shipment Components
- `IntelligentQuoteComparator` - Preventivatore multi-corriere
- `ContractComparison` - Confronto contratti
- `CourierQuoteCard` - Card singolo corriere

#### Admin Components
- `AiFeaturesCard` - Gestione features AI per utenti
- `PlatformFeeDisplay` - Visualizzazione fee piattaforma
- `CurrentFeeDisplay` - Fee attuale

#### Integration Components
- `SpedisciOnlineWizard` - Wizard configurazione Spedisci.Online
- `PosteWizard` - Wizard configurazione Poste Italiane
- `UniversalWidgetCard` - Card widget generico

#### Wallet Components
- `RechargeWalletDialog` - Dialog ricarica wallet

#### List Components
- `SupplierPriceListTable` - Tabella listini fornitori
- `CreateCustomerPriceListDialog` - Dialog creazione listino cliente
- `SyncSpedisciOnlineDialog` - Dialog sincronizzazione

### Styling

**Tailwind CSS Colors (Brand):**
```javascript
colors: {
  brand: {
    'yellow-start': '#FFD700',
    'yellow-end': '#FF9500',
    'cyan': '#00B8D4',
    'black': '#000000',
    'gray': '#666666',
  },
  primary: '#FF9500',      // Arancione brand
  'primary-dark': '#FF6B00',
  'primary-light': '#FFB84D',
  secondary: '#00B8D4',    // Azzurro brand
  'secondary-dark': '#0095B0',
  'secondary-light': '#33C5D9',
}
```

**Utility Function (`cn`):**
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Common Patterns:**
```typescript
// Gradient backgrounds
className="bg-gradient-to-r from-[#FFD700] to-[#FF9500]"

// Shadows
className="shadow-sm hover:shadow-md"

// Transitions
className="transition-all duration-200"

// Responsive
className="px-4 sm:px-6 lg:px-8"

// Focus states
className="focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700]"
```

## Examples

### Esempio Dashboard Completa
```typescript
import DashboardNav from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav
        title="Dashboard"
        subtitle="Panoramica piattaforma"
        showBackButton={false}
        actions={
          <Button>Nuova Spedizione</Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Card>
            <CardHeader>
              <CardTitle>Spedizioni</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">156</p>
              <p className="text-sm text-gray-500">Questo mese</p>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card>
            <CardHeader>
              <CardTitle>Ricavi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">€12,450</p>
              <p className="text-sm text-gray-500">Questo mese</p>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card>
            <CardHeader>
              <CardTitle>Utenti Attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">45</p>
              <p className="text-sm text-gray-500">Totale</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### Esempio Form con Smart Input
```typescript
import { useState } from "react";
import { SmartInput, SmartCard } from "@/components";

export function ShipmentForm() {
  const [formData, setFormData] = useState({
    mittenteNome: "",
    mittenteIndirizzo: "",
    mittenteCitta: "",
    mittenteProvincia: "",
    mittenteCap: "",
    mittenteTelefono: "",
    mittenteEmail: "",
  });

  const [validation, setValidation] = useState({
    mittenteNome: false,
    mittenteIndirizzo: false,
    mittenteCitta: false,
    mittenteProvincia: false,
    mittenteCap: false,
    mittenteTelefono: false,
    mittenteEmail: false,
  });

  return (
    <SmartCard title="Mittente" icon={User}>
      <div className="space-y-4">
        <SmartInput
          label="Nome Completo"
          value={formData.mittenteNome}
          onChange={(v) => setFormData({...formData, mittenteNome: v})}
          required
          placeholder="Mario Rossi"
          icon={User}
          isValid={validation.mittenteNome}
          errorMessage={formData.mittenteNome && !validation.mittenteNome ? "Nome troppo corto" : undefined}
        />
        {/* Altri campi... */}
      </div>
    </SmartCard>
  );
}
```

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Icon non appare | Verifica import corretto da lucide-react |
| Styling Tailwind non funziona | Verifica `tailwind.config.js` content paths |
| Dialog non si apre | Verifica `open` prop state |
| Form non invia dati | Verifica `onSubmit` handler e `type="submit"` sul bottone |
| Componenti non renderizzano | Verifica `"use client"` directive per componenti interattivi |

## Related Documentation
- [Frontend Architecture](../2-ARCHITECTURE/FRONTEND.md) - Next.js App Router patterns
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - API routes e Server Actions
- [Workflows](WORKFLOWS.md) - User flows completi

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | AI Agent |

---

*Last Updated: 2026-01-12*
*Status: 🟢 Active*
*Maintainer: Dev Team*
