# Frontend Architecture - SpedireSicuro

## Overview

Questa documentazione descrive l'architettura frontend di SpedireSicuro, basata su Next.js 14 App Router con TypeScript, Tailwind CSS e Shadcn/UI.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Node.js 18+
- Next.js 14 knowledge
- React hooks familiarity
- TypeScript basics

## Quick Reference

| Sezione                     | Pagina                          | Link                                       |
| --------------------------- | ------------------------------- | ------------------------------------------ |
| Next.js App Router          | docs/2-ARCHITECTURE/FRONTEND.md | [App Router](#nextjs-app-router)           |
| Server vs Client Components | docs/2-ARCHITECTURE/FRONTEND.md | [Components](#server-vs-client-components) |
| Form Patterns               | docs/2-ARCHITECTURE/FRONTEND.md | [Forms](#form-patterns)                    |
| State Management            | docs/2-ARCHITECTURE/FRONTEND.md | [State](#state-management)                 |
| Styling                     | docs/2-ARCHITECTURE/FRONTEND.md | [Styling](#styling)                        |

## Content

### Next.js App Router

**Directory Structure:**

```
app/
├── dashboard/           # Dashboard routes
│   ├── admin/          # Admin pages
│   ├── spedizioni/     # Shipment management
│   ├── wallet/         # Wallet pages
│   └── page.tsx        # Dashboard home
├── api/                # API routes (REST)
├── auth/               # Authentication callbacks
├── login/              # Login page
├── preventivo/         # Quote page
└── page.tsx            # Landing page
```

**Key Patterns:**

1. **File-based Routing:** Ogni cartella in `app/` crea una route
2. **Dynamic Routes:** `[id]` per routes dinamiche (es. `/dashboard/spedizioni/[id]`)
3. **Layouts:** `layout.tsx` per shared UI tra route
4. **Route Groups:** `(group)` per organizzare senza influire sull'URL

**Esempio Pagina Dashboard:**

```typescript
// app/dashboard/page.tsx
"use client"; // Client Component per interattività

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div>Caricamento...</div>;
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Contenuto dashboard */}
    </div>
  );
}
```

### Server vs Client Components

**Server Components (Default):**

- Renderizzato sul server
- No JavaScript inviato al client
- Accesso diretto al database
- `async/await` supportato

```typescript
// Server Component (default, no "use client")
export async function ServerComponent() {
  const supabase = createClient();
  const { data } = await supabase.from("users").select("*");

  return <div>{data?.length} utenti</div>;
}
```

**Client Components:**

- Interattività (onClick, useState, useEffect)
- Browser APIs (window, document)
- `"use client"` directive obbligatoria

```typescript
"use client";

import { useState } from "react";

export function ClientComponent() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((c) => c + 1)}>Clicks: {count}</button>
  );
}
```

**Quando usare:**

- ✅ Server: Pagine statiche, tabelle dati, SEO content
- ✅ Client: Form interattivi, modali, stateful UI

### Componenti React Custom

**Conventioni:**

- PascalCase per componenti: `SmartInput.tsx`
- Kebab-case per file: `smart-input.tsx` (Next.js 14)
- Collocati in `components/` con sottocartelle tematiche

**Esempio Componente SmartInput (da `app/dashboard/spedizioni/nuova/page.tsx`):**

```typescript
interface SmartInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: any;
  isValid?: boolean;
  errorMessage?: string;
}

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
}: SmartInputProps) {
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
          className={`w-full px-4 ${
            Icon ? "pl-10" : ""
          } pr-10 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
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

### Shadcn/UI Integration

**Setup:**

- Componenti UI in `components/ui/`
- Basati su Radix UI + Tailwind CSS
- Copia-manutenzione (non npm install)

**Componenti Disponibili:**

```typescript
// components/ui/button.tsx
import { cn } from "@/lib/utils";

export function Button({ className, ...props }) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg font-medium transition-colors",
        className
      )}
      {...props}
    />
  );
}
```

**Esempi:**

- `button.tsx` - Buttons variati
- `dialog.tsx` - Modali
- `dropdown-menu.tsx` - Dropdown menus
- `input.tsx`, `textarea.tsx` - Form inputs
- `tabs.tsx` - Tab navigation
- `card.tsx` - Card containers

### Form Patterns con react-hook-form

**Pattern Standard:**

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema validazione
const formSchema = z.object({
  email: z.string().email("Email non valida"),
  name: z.string().min(2, "Nome troppo corto"),
});

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      name: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Invio dati
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("email")} />
      {form.formState.errors.email && (
        <p>{form.formState.errors.email.message}</p>
      )}
      <button type="submit">Invia</button>
    </form>
  );
}
```

**Esempio Reale (da `app/dashboard/spedizioni/nuova/page.tsx`):**

```typescript
// Validazione campi
const validation = useMemo(() => {
  return {
    mittenteNome: formData.mittenteNome.length >= 2,
    mittenteIndirizzo: formData.mittenteIndirizzo.length >= 5,
    mittenteCitta: formData.mittenteCitta.length >= 2,
    mittenteCap: formData.mittenteCap.length >= 5,
    // ... altri campi
  };
}, [formData]);

// Progress bar
const progress = useMemo(() => {
  const requiredFields = [
    formData.mittenteNome,
    formData.mittenteIndirizzo,
    // ... altri campi obbligatori
  ];
  const filled = requiredFields.filter((f) => f && f.length > 0).length;
  return Math.round((filled / requiredFields.length) * 100);
}, [formData]);
```

### State Management

**React Hooks (Default):**

- `useState` per state locale
- `useContext` per state globale semplice
- `useEffect` per side effects

**React Query (TanStack Query):**

- Gestione cache server state
- Mutazioni e refetching
- Loading/error states automatici

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";

// Fetch data
const {
  data: shipments,
  isLoading,
  error,
} = useQuery({
  queryKey: ["shipments"],
  queryFn: async () => {
    const response = await fetch("/api/shipments");
    return response.json();
  },
});

// Mutate data
const createShipment = useMutation({
  mutationFn: async (data) => {
    const response = await fetch("/api/shipments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["shipments"] });
  },
});
```

**Context Pattern:**

```typescript
// context.tsx
const MyContext = createContext<{ value: string } | null>(null);

export function MyProvider({ children }) {
  return (
    <MyContext.Provider value={{ value: "shared" }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) throw new Error("useMyContext must be used within MyProvider");
  return context;
}
```

### Styling

**Tailwind CSS Configuration:**

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          "yellow-start": "#FFD700",
          "yellow-end": "#FF9500",
          cyan: "#00B8D4",
        },
        primary: "#FF9500",
        secondary: "#00B8D4",
      },
    },
  },
  plugins: [],
};
```

**Utility Functions:**

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Common Patterns:**

```typescript
// Gradient backgrounds
className="bg-gradient-to-r from-[#FFD700] to-[#FF9500]"

// Responsive
className="px-4 sm:px-6 lg:px-8"

// Conditional styles
className={cn(
  "px-4 py-2 rounded-lg",
  isActive && "bg-blue-500 text-white"
)}
```

## Examples

### Esempio Pagina Completa (Nuova Spedizione)

```typescript
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

interface FormData {
  mittenteNome: string;
  mittenteIndirizzo: string;
  // ... altri campi
}

export default function NuovaSpedizionePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    mittenteNome: "",
    mittenteIndirizzo: "",
    // ... inizializzazione
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validazione
  const validation = useMemo(
    () => ({
      mittenteNome: formData.mittenteNome.length >= 2,
      mittenteIndirizzo: formData.mittenteIndirizzo.length >= 5,
    }),
    [formData]
  );

  // Progress
  const progress = useMemo(() => {
    const filled = Object.entries(formData).filter(
      ([_, v]) => v && v.length > 0
    ).length;
    return Math.round((filled / Object.keys(formData).length) * 100);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/spedizioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/dashboard/spedizioni");
      }
    } catch (error) {
      console.error("Errore:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1>Nuova Spedizione</h1>
        {/* Form fields */}
        <form onSubmit={handleSubmit}>
          <input
            value={formData.mittenteNome}
            onChange={(e) =>
              setFormData({ ...formData, mittenteNome: e.target.value })
            }
            placeholder="Nome mittente"
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generazione..." : "Genera Spedizione"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Common Issues

| Issue                          | Soluzione                                                 |
| ------------------------------ | --------------------------------------------------------- |
| Hydration mismatch             | Usa `useEffect` per browser-only code                     |
| "use client" mancante          | Aggiungi `"use client"` in cima ai componenti interattivi |
| Classi Tailwind non funzionano | Verifica `tailwind.config.js` content paths               |
| Imports non risolti            | Usa alias `@/` per path dal root                          |

## Related Documentation

- [Backend Architecture](BACKEND.md) - API routes e Server Actions
- [UI Components Overview](../4-UI-COMPONENTS/OVERVIEW.md) - Sistema componenti
- [API Documentation](../3-API/OVERVIEW.md) - API endpoints

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_
_Status: 🟢 Active_
_Maintainer: Dev Team_
