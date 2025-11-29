# 🚀 Guida Completa: Creazione Nuove API

**Guida passo-passo per creare nuove API in SpedireSicuro.it**

---

## 📋 INDICE

1. [Struttura API Routes](#struttura-api-routes)
2. [Template Base](#template-base)
3. [Convenzioni](#convenzioni)
4. [Esempi Pratici](#esempi-pratici)
5. [Best Practices](#best-practices)
6. [Testing](#testing)

---

## 📁 STRUTTURA API ROUTES

### Next.js 14 App Router

Le API routes in Next.js 14 usano la struttura **App Router**:

```
app/
└── api/
    └── [nome-endpoint]/
        └── route.ts          # Handler GET, POST, PUT, DELETE, etc.
```

**Esempio:**
```
app/
└── api/
    └── spedizioni/
        └── route.ts          # GET /api/spedizioni, POST /api/spedizioni
    └── spedizioni/
        └── [id]/
            └── route.ts      # GET /api/spedizioni/123, PUT /api/spedizioni/123
```

---

## 🎯 TEMPLATE BASE

### Template Completo per Nuova API

```typescript
/**
 * API Route: [Nome Funzionalità]
 * 
 * Endpoint: [GET|POST|PUT|DELETE] /api/[nome-endpoint]
 * 
 * [Descrizione cosa fa questa API]
 */

import { NextRequest, NextResponse } from 'next/server';

// Tipi per request/response
interface RequestBody {
  // Definisci qui i campi del body
}

interface ResponseData {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Handler GET - [Descrizione]
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Validazione parametri query (se necessario)
    const { searchParams } = new URL(request.url);
    const param = searchParams.get('param');

    // 2. Validazione
    if (!param) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametro mancante',
          message: 'Il parametro "param" è obbligatorio',
        },
        { status: 400 }
      );
    }

    // 3. Business logic
    const result = await doSomething(param);

    // 4. Risposta successo
    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore API [nome]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

/**
 * Handler POST - [Descrizione]
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Leggi body
    const body: RequestBody = await request.json();

    // 2. Validazione
    if (!body.campoObbligatorio) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dati mancanti',
          message: 'Il campo "campoObbligatorio" è obbligatorio',
        },
        { status: 400 }
      );
    }

    // 3. Business logic
    const result = await createSomething(body);

    // 4. Risposta successo
    return NextResponse.json(
      {
        success: true,
        message: 'Operazione completata con successo',
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Errore API [nome]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

/**
 * Handler PUT - [Descrizione]
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    // ... implementazione
  } catch (error) {
    // ... error handling
  }
}

/**
 * Handler DELETE - [Descrizione]
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    // ... implementazione
  } catch (error) {
    // ... error handling
  }
}
```

---

## 📐 CONVENZIONI

### 1. Naming

- **Cartelle:** kebab-case (`app/api/calcolo-prezzo/route.ts`)
- **File:** sempre `route.ts` (Next.js 14 App Router)
- **Funzioni:** camelCase (`getSpedizioneById`)

### 2. Struttura Response

**Successo:**
```typescript
{
  success: true,
  data: { /* dati */ },
  message?: "Messaggio opzionale"
}
```

**Errore:**
```typescript
{
  success: false,
  error: "Tipo errore",
  message: "Messaggio dettagliato"
}
```

### 3. Status Codes

- `200` - Successo (GET, PUT)
- `201` - Creato (POST)
- `400` - Bad Request (validazione fallita)
- `401` - Unauthorized (autenticazione richiesta)
- `404` - Not Found (risorsa non trovata)
- `500` - Internal Server Error (errore server)

### 4. Error Handling

**Sempre:**
- ✅ Try-catch in ogni handler
- ✅ Log errori con `console.error`
- ✅ Messaggio errore user-friendly
- ✅ Status code appropriato

### 5. Validazione

**Sempre validare:**
- ✅ Campi obbligatori
- ✅ Tipi di dati
- ✅ Range valori (es. peso > 0)
- ✅ Formato dati (es. email valida)

---

## 💡 ESEMPI PRATICI

### Esempio 1: API Semplice GET

```typescript
/**
 * API Route: Health Check
 * Endpoint: GET /api/health
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    },
    { status: 200 }
  );
}
```

### Esempio 2: API con Query Parameters

```typescript
/**
 * API Route: Ricerca Città
 * Endpoint: GET /api/geo/search?q=Roma
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query non valida',
          message: 'La query deve essere di almeno 2 caratteri',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('geo_locations')
      .select('*')
      .ilike('nome', `%${query}%`)
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: data || [],
        count: data?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore ricerca città:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore ricerca',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
```

### Esempio 3: API POST con Validazione

```typescript
/**
 * API Route: Crea Spedizione
 * Endpoint: POST /api/spedizioni
 */
import { NextRequest, NextResponse } from 'next/server';
import { addSpedizione } from '@/lib/database';

interface CreateSpedizioneBody {
  mittenteNome: string;
  destinatarioNome: string;
  peso: number;
  tipoSpedizione?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSpedizioneBody = await request.json();

    // Validazione
    if (!body.mittenteNome || !body.destinatarioNome) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dati mancanti',
          message: 'Nome mittente e destinatario sono obbligatori',
        },
        { status: 400 }
      );
    }

    if (!body.peso || body.peso <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dati non validi',
          message: 'Il peso deve essere maggiore di 0',
        },
        { status: 400 }
      );
    }

    // Business logic
    const spedizione = {
      mittente: { nome: body.mittenteNome },
      destinatario: { nome: body.destinatarioNome },
      peso: body.peso,
      tipoSpedizione: body.tipoSpedizione || 'standard',
      // ... altri campi
    };

    const result = addSpedizione(spedizione);

    return NextResponse.json(
      {
        success: true,
        message: 'Spedizione creata con successo',
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Errore creazione spedizione:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
```

### Esempio 4: API con Dynamic Route

```typescript
/**
 * API Route: Spedizione per ID
 * Endpoint: GET /api/spedizioni/[id]
 * 
 * File: app/api/spedizioni/[id]/route.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSpedizioneById } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID mancante',
          message: 'L\'ID della spedizione è obbligatorio',
        },
        { status: 400 }
      );
    }

    const spedizione = getSpedizioneById(id);

    if (!spedizione) {
      return NextResponse.json(
        {
          success: false,
          error: 'Non trovato',
          message: `Spedizione con ID ${id} non trovata`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: spedizione,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore API spedizione:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
```

---

## ✅ BEST PRACTICES

### 1. Commenti e Documentazione

```typescript
/**
 * API Route: [Nome]
 * 
 * Endpoint: [METODO] /api/[path]
 * 
 * [Descrizione dettagliata]
 * 
 * @param request - NextRequest con body/query params
 * @returns NextResponse con dati o errore
 */
```

### 2. TypeScript

- ✅ **Sempre** tipi espliciti per body/response
- ✅ **Interfacce** per oggetti complessi
- ✅ **Mai** `any` (usa `unknown` se necessario)

### 3. Validazione

- ✅ Validare **sempre** input
- ✅ Messaggi errore **chiari** e **user-friendly**
- ✅ Status code **appropriati**

### 4. Error Handling

- ✅ Try-catch in **ogni** handler
- ✅ Log errori con **dettagli** (console.error)
- ✅ Non esporre **dettagli tecnici** al client

### 5. Response Consistency

- ✅ **Sempre** stesso formato response
- ✅ Campo `success` boolean
- ✅ Campo `error` per errori
- ✅ Campo `data` per dati

---

## 🧪 TESTING

### Test Manuale con cURL

```bash
# GET
curl http://localhost:3000/api/health

# POST
curl -X POST http://localhost:3000/api/spedizioni \
  -H "Content-Type: application/json" \
  -d '{"mittenteNome":"Mario","destinatarioNome":"Luigi","peso":5}'
```

### Test con Browser

1. Apri: `http://localhost:3000/api/health`
2. Dovresti vedere JSON response

### Test con Postman/Thunder Client

1. Crea nuova richiesta
2. Imposta metodo (GET, POST, etc.)
3. Imposta URL: `http://localhost:3000/api/[endpoint]`
4. Per POST: aggiungi body JSON
5. Invia richiesta

---

## 📝 CHECKLIST CREAZIONE API

Prima di considerare completata una nuova API:

- [ ] File creato in `app/api/[nome]/route.ts`
- [ ] Handler implementato (GET, POST, etc.)
- [ ] Validazione input implementata
- [ ] Error handling completo (try-catch)
- [ ] Response format consistente
- [ ] Status codes appropriati
- [ ] Commenti/documentazione aggiunti
- [ ] Testato manualmente
- [ ] Nessun errore TypeScript
- [ ] Nessun errore ESLint

---

## 🚀 PROCEDURA RAPIDA

### Step 1: Crea File

```bash
# Crea cartella e file
mkdir app/api/[nome-endpoint]
touch app/api/[nome-endpoint]/route.ts
```

### Step 2: Copia Template

Copia il template base e adatta al tuo caso.

### Step 3: Implementa Logica

- Aggiungi validazione
- Implementa business logic
- Gestisci errori

### Step 4: Test

- Testa con browser/Postman
- Verifica errori TypeScript
- Verifica errori ESLint

### Step 5: Commit

```bash
git add app/api/[nome-endpoint]/route.ts
git commit -m "feat: aggiunta API [nome-endpoint]"
```

---

## 🆘 PROBLEMI COMUNI

### Errore: "Route not found"

**Causa:** File non in posizione corretta o nome sbagliato

**Soluzione:**
- Verifica che il file sia in `app/api/[nome]/route.ts`
- Verifica che si chiami esattamente `route.ts`
- Riavvia il server: `npm run dev`

### Errore: "Cannot read property of undefined"

**Causa:** Body non parsato correttamente

**Soluzione:**
```typescript
// Assicurati di fare await
const body = await request.json();
```

### Errore TypeScript

**Causa:** Tipi mancanti o errati

**Soluzione:**
- Definisci interfacce per body/response
- Usa tipi espliciti

---

**Ora sei pronto per creare nuove API!** 🚀

**Dimmi quale API vuoi creare e ti guido passo-passo!**

