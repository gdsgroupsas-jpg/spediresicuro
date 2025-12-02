# 📍 Guida Setup Sistema Autocompletamento Geo-Locations

Questa guida spiega come configurare e utilizzare il sistema di autocompletamento geografico per comuni italiani.

---

## 🎯 Cosa Fa Questo Sistema

Il sistema permette agli utenti di:
- Cercare comuni italiani digitando nome, provincia o CAP
- Ottenere risultati istantanei (<50ms) grazie a full-text search
- Selezionare automaticamente città, provincia e CAP con un solo click
- Gestire comuni con più CAP (es. Roma ha molti CAP)

---

## 📋 Prerequisiti

1. **Account Supabase** (gratuito): https://supabase.com
2. **Progetto Supabase** creato
3. **Variabili ambiente** configurate

---

## 🚀 Setup Passo-Passo

### 1. Configurare Supabase

1. Vai su https://app.supabase.com
2. Crea un nuovo progetto (o usa uno esistente)
3. Vai su **SQL Editor**
4. Copia e incolla il contenuto di `supabase/schema.sql`
5. Esegui lo script SQL (creerà la tabella `geo_locations`)

### 2. Configurare Variabili Ambiente

Aggiungi queste variabili al file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Dove trovarle:**
- Vai su Supabase Dashboard → **Settings** → **API**
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (⚠️ segreta!)

### 3. Installare Dipendenze

```bash
npm install
```

Questo installerà:
- `@supabase/supabase-js` - Client Supabase
- `cmdk` - Componente combobox
- `ts-node` e `dotenv` - Per script di seeding

### 4. Popolare il Database

Esegui lo script di seeding per scaricare e inserire tutti i comuni italiani:

```bash
npm run seed:geo
```

**Cosa fa lo script:**
- Scarica dati da GitHub (8000+ comuni italiani)
- Trasforma i dati nel formato database
- Inserisce in batch da 1000 (per evitare timeout)
- Mostra progresso in tempo reale

**Tempo stimato:** 1-2 minuti

**Output atteso:**
```
🚀 Avvio seeding geo-locations...
📥 Download dati comuni da GitHub...
✅ Scaricati 8000+ comuni
🔄 Trasformazione dati...
✅ Trasformati 8000+ comuni
📦 Inserimento in batch...
✅ Batch 1/9 completato: 1000/8000 comuni
...
🎉 Seeding completato con successo!
```

### 5. Verificare il Setup

Testa l'API direttamente:

```bash
# Avvia il server
npm run dev

# In un altro terminale, testa l'API
curl "http://localhost:3000/api/geo/search?q=Roma"
```

Dovresti vedere una risposta JSON con i risultati.

---

## 🎨 Utilizzo nel Codice

### Componente Base

```tsx
import AsyncLocationCombobox from '@/components/ui/async-location-combobox';
import type { OnLocationSelect } from '@/types/geo';

function MyForm() {
  const handleLocationSelect: OnLocationSelect = (location) => {
    console.log('Città:', location.city);
    console.log('Provincia:', location.province);
    console.log('CAP:', location.cap);
    console.log('Tutti i CAP:', location.caps);
  };

  return (
    <AsyncLocationCombobox
      onSelect={handleLocationSelect}
      placeholder="Cerca città..."
    />
  );
}
```

### Con React Hook Form

```tsx
import { useForm } from 'react-hook-form';
import AsyncLocationCombobox from '@/components/ui/async-location-combobox';

function MyForm() {
  const { setValue, watch } = useForm();

  const handleLocationSelect: OnLocationSelect = (location) => {
    setValue('citta', location.city);
    setValue('provincia', location.province);
    setValue('cap', location.cap || '');
  };

  return (
    <AsyncLocationCombobox
      onSelect={handleLocationSelect}
      defaultValue={{
        city: watch('citta'),
        province: watch('provincia'),
        cap: watch('cap'),
      }}
    />
  );
}
```

---

## 🔧 API Endpoint

### GET `/api/geo/search?q=query`

**Parametri:**
- `q` (string, obbligatorio): Query di ricerca (min 2 caratteri)

**Risposta:**
```json
{
  "results": [
    {
      "city": "Roma",
      "province": "RM",
      "region": "Lazio",
      "caps": ["00100", "00118", "00119"],
      "displayText": "Roma (RM) - 00100, 00118, 00119"
    }
  ],
  "count": 1,
  "query": "Roma"
}
```

**Cache:** 1 ora (header `Cache-Control`)

**Limite:** Max 20 risultati per performance

---

## 🎯 Funzionalità Componente

### ✅ Ricerca in Tempo Reale
- Debounce 300ms (evita troppe chiamate API)
- Ricerca su nome, provincia, CAP
- Full-text search ottimizzato

### ✅ Multi-CAP Support
- Se comune ha 1 CAP → seleziona automaticamente
- Se comune ha più CAP → mostra dropdown secondario
- Utente sceglie CAP specifico

### ✅ UX Ottimizzata
- Skeleton loader durante ricerca
- Gestione errori network
- Messaggio "Nessun risultato"
- Keyboard navigation (↑↓ Enter Esc)
- Click outside per chiudere

### ✅ Accessibilità
- ARIA labels
- Focus management
- Screen reader friendly

---

## 📊 Performance

- **Ricerca:** <50ms (grazie a GIN index su tsvector)
- **Cache:** 1 ora (dati geografici cambiano raramente)
- **Limite risultati:** 20 (per mantenere UI snappy)

---

## 🐛 Troubleshooting

### Errore: "Tabella geo_locations non trovata"
**Soluzione:** Esegui lo schema SQL in Supabase SQL Editor

### Errore: "Variabili ambiente mancanti"
**Soluzione:** Verifica che `.env.local` contenga tutte le variabili Supabase

### Errore: "Errore durante la ricerca"
**Soluzione:** 
1. Verifica connessione Supabase
2. Controlla che la tabella sia popolata (`npm run seed:geo`)
3. Verifica RLS (Row Level Security) su Supabase

### Nessun risultato nella ricerca
**Soluzione:**
1. Verifica che il database sia popolato
2. Controlla la query (min 2 caratteri)
3. Prova con nomi comuni (es. "Roma", "Milano")

---

## 📚 File Creati

```
supabase/
  └── schema.sql                    # Schema database

scripts/
  └── seed-geo.ts                   # Script seeding

app/api/geo/search/
  └── route.ts                      # API endpoint ricerca

components/ui/
  └── async-location-combobox.tsx   # Componente UI

types/
  └── geo.ts                        # Tipi TypeScript

lib/
  └── supabase.ts                   # Client Supabase
```

---

## 🔄 Aggiornare Dati

Se i dati dei comuni cambiano:

1. Esegui di nuovo lo script:
```bash
npm run seed:geo
```

Lo script usa `upsert`, quindi aggiorna i dati esistenti senza duplicati.

---

## 🎉 Pronto!

Il sistema è ora configurato e pronto all'uso. Puoi utilizzare `AsyncLocationCombobox` in qualsiasi form del progetto.

**Esempio completo:** Vedi `app/dashboard/spedizioni/nuova/page.tsx`



