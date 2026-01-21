# Dashboard Redesign & Anne Assistant - Documentazione

## 📋 Panoramica

Questo documento descrive il redesign completo della dashboard di SpedireSicuro.it, includendo:

1. **Sistema di Navigazione Dinamico** - Configurazione centralizzata basata su ruoli
2. **Anne Assistant** - Assistente virtuale con AI (fantasmino floating)
3. **UX Improvements** - Miglioramenti all'esperienza utente e navigazione

## 🎯 Obiettivi Raggiunti

### ✅ Navigazione Modulare

- Configurazione centralizzata in `lib/config/navigationConfig.ts`
- Menu dinamici basati su ruolo utente (user, admin, superadmin)
- Sezioni collapsibili per ridurre il clutter visivo
- Supporto feature flags (reseller, team, ecc.)

### ✅ Anne - Assistente Virtuale

- Fantasmino floating in basso a destra
- Chat panel espandibile
- Suggerimenti proattivi contestuali
- Integrazione con Claude AI (Anthropic)
- Personalizzazione tramite localStorage

### ✅ UX Migliorata

- Riduzione della densità informativa
- Navigazione intuitiva con raggruppamenti logici
- Animazioni smooth con Framer Motion
- Design responsive e accessibile

---

## 📁 Struttura File

### Nuovi File Creati

```
lib/config/
  └── navigationConfig.ts          # Configurazione navigazione dinamica

components/anne/
  ├── AnneAssistant.tsx            # Componente fantasmino floating
  ├── AnneContext.tsx              # Context provider per suggerimenti
  └── index.ts                     # Export centralizzato

app/api/anne/
  └── chat/route.ts                # Endpoint API per Anne (Claude AI)

docs/
  └── dashboard-redesign.md        # Questa documentazione
```

### File Modificati

```
components/
  ├── dashboard-sidebar.tsx        # Aggiornato per usare navigationConfig
  └── dashboard-layout-client.tsx  # Integrato Anne Assistant
```

---

## 🛠️ Configurazione Navigazione

### File: `lib/config/navigationConfig.ts`

La configurazione di navigazione è centralizzata e permette di:

- Definire menu per ruoli specifici
- Creare sezioni collapsibili
- Assegnare varianti di stile (default, gradient, ai, ecc.)
- Gestire badge e descrizioni

#### Esempio di Configurazione

```typescript
import { getNavigationForUser } from '@/lib/config/navigationConfig';

// Ottieni menu per utente
const navigation = getNavigationForUser('admin', {
  isReseller: true,
  hasTeam: false,
});

// navigation.mainActions -> Azioni principali (AI Assistant, ecc.)
// navigation.sections -> Sezioni del menu
```

#### Struttura Dati

```typescript
interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  variant?: 'default' | 'primary' | 'gradient' | 'ai';
  description?: string;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  requiredRole?: UserRole[];
  requiredFeature?: 'reseller' | 'team';
}
```

### Aggiungere una Nuova Voce di Menu

1. Apri `lib/config/navigationConfig.ts`
2. Trova la sezione appropriata (es. `logisticsSection`, `adminSection`)
3. Aggiungi il nuovo item:

```typescript
{
  id: 'new-feature',
  label: 'Nuova Funzione',
  href: '/dashboard/nuova-funzione',
  icon: Star,
  description: 'Descrizione della funzione',
  variant: 'default',
}
```

4. La voce apparirà automaticamente nella sidebar e mobile nav

### Creare una Nuova Sezione

```typescript
const myNewSection: NavSection = {
  id: 'my-section',
  label: 'La Mia Sezione',
  collapsible: true,
  defaultExpanded: false,
  requiredRole: ['admin'], // Opzionale
  items: [
    {
      id: 'item-1',
      label: 'Item 1',
      href: '/dashboard/item-1',
      icon: Circle,
    },
  ],
};

// Aggiungi alla funzione getNavigationForUser
sections.push(myNewSection);
```

---

## 🤖 Anne Assistant

### Componente: `AnneAssistant.tsx`

Anne è un assistente virtuale che appare come un fantasmino floating. Caratteristiche:

#### Features

1. **Fantasmino Animato**
   - Icona Ghost in basso a destra
   - Glow effect e pulse animation
   - Tooltip al hover

2. **Chat Panel Espandibile**
   - Dimensioni: 320px (default) → 384px (espanso)
   - Altezza: 384px (default) → 600px (espanso)
   - Messaggi con markdown support

3. **Suggerimenti Proattivi**
   - Analisi del contesto (pagina corrente, ruolo)
   - Saluto automatico al primo accesso
   - Suggerimenti contestuali basati su comportamento

4. **Personalizzazione**
   - Preferenze salvate in localStorage
   - 3 livelli di notifiche: minimal, normal, proactive
   - Toggle per suggerimenti automatici

#### Preferenze Utente

```typescript
interface AnnePreferences {
  showSuggestions: boolean; // Mostra suggerimenti contestuali
  autoGreet: boolean; // Saluto automatico
  notificationLevel: 'minimal' | 'normal' | 'proactive';
}
```

Salvate in: `localStorage.getItem('anne-preferences')`

### Context: `AnneContext.tsx`

Gestisce lo stato globale di Anne attraverso l'app.

#### Hook Disponibili

```typescript
// Usa il context
const { currentSuggestion, dismissSuggestion } = useAnneContext();

// Traccia azioni utente
const { trackAction } = useAnneTracking();

trackAction('created-shipment', {
  courier: 'DHL',
  cost: 15.5,
});
```

#### Suggerimenti Proattivi

Anne analizza automaticamente:

- Numero di interazioni utente
- Pagina corrente
- Ruolo utente
- Cronologia azioni

E suggerisce azioni pertinenti in base al contesto.

### API Endpoint: `/api/anne/chat`

#### POST Request

```typescript
POST /api/anne/chat

Body:
{
  "message": "Come faccio a creare una spedizione?",
  "userId": "user-123",
  "userRole": "user",
  "currentPage": "/dashboard/spedizioni",
  "context": {
    "previousMessages": [...]
  }
}

Response:
{
  "message": "Per creare una spedizione...",
  "timestamp": "2025-12-07T10:30:00Z"
}
```

#### GET Request (Suggerimenti)

```typescript
GET /api/anne/chat?page=/dashboard&role=user

Response:
{
  "suggestion": "💡 Da qui puoi monitorare...",
  "timestamp": "2025-12-07T10:30:00Z"
}
```

#### Personalizzazione System Prompt

Il system prompt di Anne è personalizzato in base a:

- Ruolo utente (user, admin, superadmin)
- Pagina corrente
- Contesto conversazione

Per modificarlo: `app/api/anne/chat/route.ts` → funzione `buildAnneSystemPrompt()`

---

## 🎨 Varianti di Stile

### Nav Item Variants

Definiti in `navigationConfig.ts`:

```typescript
const navItemVariants = {
  default: {
    active: 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600...',
    inactive: 'text-gray-700 hover:bg-gray-50...',
  },
  gradient: {
    active: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white...',
    inactive: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white...',
  },
  ai: {
    active: 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white...',
    inactive: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white...',
  },
};
```

Uso:

```typescript
{
  id: 'ai-button',
  label: 'AI Assistant',
  href: '#ai',
  icon: Bot,
  variant: 'ai', // 👈 Applica stile AI
}
```

---

## 🚀 Estendere Anne

### Aggiungere Nuovi Suggerimenti

Modifica `AnneContext.tsx` → funzione `generateContextualSuggestion()`:

```typescript
const pageSuggestions: Record<string, AnneSuggestion> = {
  '/dashboard/my-new-page': {
    id: 'tip-new-page',
    type: 'feature',
    message: '🎉 Benvenuto nella nuova pagina!',
    page: pathname,
    priority: 'high',
    dismissible: true,
  },
};
```

### Aggiungere Quick Actions

Modifica `AnneAssistant.tsx` → array `quickActions`:

```typescript
const quickActions = [
  {
    icon: <Rocket size={16} />,
    label: '🚀 Nuova Azione',
    action: 'Esegui questa azione per me',
  },
];
```

### Modificare Personalità Anne

Modifica `app/api/anne/chat/route.ts`:

```typescript
const basePrompt = `Sei Anne, un assistente...
PERSONALITÀ:
- Sei più formale / informale
- Usi molte emoji / poche emoji
- Rispondi in modo conciso / dettagliato
...`;
```

---

## 📱 Responsive Design

### Breakpoints

- **Mobile**: `< 1024px` - Bottom navigation + Mobile menu drawer
- **Desktop**: `>= 1024px` - Sidebar fissa

### Anne su Mobile

Anne si adatta automaticamente:

- Icona fantasmino: 64px → 56px
- Chat panel: Max width 95vw
- Input touch-friendly (min 44px tap target)

---

## 🧪 Testing

### Test Navigazione

```bash
# Avvia dev server
npm run dev

# Testa come utente normale
# Login → Verifica voci menu visibili

# Testa come admin
# Promuovi account → Verifica sezioni admin

# Testa come reseller
# Abilita flag reseller → Verifica sezione reseller
```

### Test Anne

1. **Test Fantasmino**
   - Verifica apparizione icona in basso a destra
   - Click → Panel si espande
   - Verifica animazioni smooth

2. **Test Chat**
   - Invia messaggio
   - Verifica risposta da API Claude
   - Testa markdown rendering

3. **Test Suggerimenti**
   - Naviga tra pagine diverse
   - Verifica suggerimenti contestuali
   - Testa dismissione suggerimenti

4. **Test Preferenze**
   - Modifica preferenze nel panel settings
   - Ricarica pagina → Verifica persistenza
   - Testa livelli di notifica

---

## 🔧 Troubleshooting

### Anne non appare

1. Verifica che `ANTHROPIC_API_KEY` sia configurata in `.env`
2. Controlla che l'utente sia loggato (`session?.user`)
3. Verifica console browser per errori
4. Controlla che framer-motion sia installato: `npm list framer-motion`

### Navigazione non si aggiorna

1. Verifica che `accountType` sia caricato correttamente
2. Controlla `/api/user/info` risponda correttamente
3. Verifica ruoli in database

### Errori API Anne

```bash
# Verifica API Key
echo $ANTHROPIC_API_KEY

# Test endpoint
curl -X POST http://localhost:3000/api/anne/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","userId":"1","userRole":"user"}'
```

---

## 📦 Dipendenze

### Nuove Dipendenze

Nessuna! Il progetto usa librerie già installate:

- ✅ `framer-motion` (già presente)
- ✅ `@anthropic-ai/sdk` (già presente)
- ✅ `lucide-react` (già presente)
- ✅ `react-markdown` (già presente)

### Verifica Installazione

```bash
npm list framer-motion @anthropic-ai/sdk lucide-react react-markdown
```

Se mancanti:

```bash
npm install framer-motion @anthropic-ai/sdk lucide-react react-markdown
```

---

## 🎓 Best Practices

### Navigazione

1. **Sempre usa navigationConfig** - Non hardcodare mai menu
2. **Testa con tutti i ruoli** - user, admin, superadmin
3. **Mantieni sezioni logiche** - Max 4-5 items per sezione
4. **Usa descrizioni** - Aiutano accessibilità e tooltip

### Anne

1. **Non abusare dei suggerimenti** - Max 1 ogni 5-10 interazioni
2. **Contesto è re** - Più contesto dai ad Anne, migliori sono le risposte
3. **Gestisci errori API** - Sempre fallback graceful
4. **Rispetta privacy** - Tracking locale, nessun dato sensibile

---

## 📈 Metriche & Analytics

### Tracking Anne

Anne traccia automaticamente:

- Numero interazioni utente
- Suggerimenti visualizzati/dismissati
- Pagine visitate

Dati salvati in: `localStorage.getItem('anne-tracking')`

### Analisi Utilizzo

```typescript
// Leggi tracking dati
const tracking = JSON.parse(localStorage.getItem('anne-tracking') || '[]');

// Analizza
const totalInteractions = tracking.length;
const pagesVisited = new Set(tracking.map((t) => t.metadata?.page)).size;
```

---

## 🔐 Sicurezza

### API Key Management

⚠️ **IMPORTANTE**: `ANTHROPIC_API_KEY` deve essere in `.env` e **MAI** committata!

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Rate Limiting

L'endpoint Anne **NON** ha rate limiting nativo. Implementa se necessario:

```typescript
// app/api/anne/chat/route.ts
import { ratelimit } from '@/lib/redis';

// Aggiungi check
const { success } = await ratelimit.limit(userId);
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

---

## 🎉 Conclusione

Il redesign della dashboard introduce:

✅ Navigazione modulare e configurabile
✅ Anne - Assistente virtuale intelligente
✅ UX migliorata e intuitiva
✅ Architettura scalabile e manutenibile

### Prossimi Passi

1. Raccogliere feedback utenti su Anne
2. Espandere suggerimenti proattivi
3. Aggiungere analytics avanzati
4. A/B test varianti UI

---

## 📞 Supporto

Per domande o problemi:

1. Controlla questa documentazione
2. Verifica i commenti nel codice
3. Consulta il README principale del progetto

**File di riferimento rapido:**

- Config navigazione: `lib/config/navigationConfig.ts`
- Anne Assistant: `components/anne/AnneAssistant.tsx`
- API Anne: `app/api/anne/chat/route.ts`
- Layout: `components/dashboard-layout-client.tsx`

---

_Documentazione creata il 07/12/2025_
_Versione Dashboard: 2.0_
