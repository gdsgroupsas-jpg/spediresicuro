# 🚀 Setup DeepSeek AI Provider

## 📋 Riepilogo

Sistema implementato per permettere al Superadmin di selezionare quale provider AI usare per Anne (Anthropic Claude o DeepSeek).

## ✅ Cosa è stato implementato

1. **Migration Database** (`058_ai_provider_preferences.sql`)
   - Tabella `system_settings` per preferenze globali
   - Funzioni helper `get_ai_provider()` e `get_ai_model()`
   - RLS policies (solo superadmin può modificare)

2. **Adapter Pattern** (`lib/ai/provider-adapter.ts`)
   - Supporto per Anthropic Claude e DeepSeek
   - Interfaccia unificata per entrambi i provider
   - Gestione automatica del formato API

3. **Server Actions** (`actions/ai-settings.ts`)
   - `getAIProviderSetting()` - Legge configurazione corrente
   - `updateAIProviderSetting()` - Aggiorna provider (solo superadmin)
   - `getAvailableAIProviders()` - Lista provider disponibili

4. **UI Superadmin** (`app/dashboard/super-admin/_components/ai-provider-selector.tsx`)
   - Componente per selezionare provider AI
   - Mostra stato API keys
   - Feedback visivo per provider selezionato

5. **Route Agent Chat** (`app/api/ai/agent-chat/route.ts`)
   - Modificata per usare adapter invece di chiamare direttamente Anthropic
   - Supporto automatico per provider configurato

## 🔧 Configurazione Variabili d'Ambiente

### 1. Locale (.env.local)

Aggiungi questa riga al file `.env.local`:

```bash
DEEPSEEK_API_KEY=***REDACTED_DEEPSEEK_KEY***
```

**Nota:** Il file `.env.local` è già nel `.gitignore`, quindi non verrà committato.

### 2. Vercel (Produzione/Preview/Development)

Usa Vercel CLI per aggiungere la variabile:

```bash
# Production
echo "***REDACTED_DEEPSEEK_KEY***" | vercel env add DEEPSEEK_API_KEY production

# Preview
echo "***REDACTED_DEEPSEEK_KEY***" | vercel env add DEEPSEEK_API_KEY preview

# Development
echo "***REDACTED_DEEPSEEK_KEY***" | vercel env add DEEPSEEK_API_KEY development
```

**Alternativa:** Aggiungi manualmente su Vercel Dashboard:
1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto `spediresicuro`
3. Vai su **Settings** → **Environment Variables**
4. Aggiungi:
   - **Name**: `DEEPSEEK_API_KEY`
   - **Value**: `***REDACTED_DEEPSEEK_KEY***`
   - **Environments**: Seleziona Production, Preview, Development

## 🎯 Utilizzo

### Per il Superadmin

1. **Accedi alla Dashboard Superadmin**
   - Vai su `/dashboard/super-admin`
   - Verifica di essere loggato come superadmin

2. **Seleziona Provider AI**
   - Nella sezione "Provider AI per Anne" vedrai:
     - **Anthropic Claude** (default)
     - **DeepSeek**
   - Clicca sul provider che vuoi usare
   - Il sistema salverà automaticamente la preferenza

3. **Verifica Stato**
   - Il componente mostra se l'API key è configurata
   - Se manca l'API key, vedrai un avviso

### Come Funziona

1. **All'avvio di una conversazione con Anne:**
   - Il sistema legge la preferenza dal database (`system_settings`)
   - Crea il client AI appropriato usando l'adapter
   - Usa l'API key corretta (ANTHROPIC_API_KEY o DEEPSEEK_API_KEY)

2. **Fallback:**
   - Se il provider configurato non ha API key → fallback a mock response
   - Se il provider non è configurato → default a Anthropic

## 🔍 Verifica Funzionamento

### Test Locale

1. Aggiungi `DEEPSEEK_API_KEY` a `.env.local`
2. Riavvia il server: `npm run dev`
3. Vai su `/dashboard/super-admin`
4. Seleziona DeepSeek come provider
5. Apri Anne e fai una domanda
6. Verifica nei log del server che usi DeepSeek

### Test Produzione

1. Aggiungi `DEEPSEEK_API_KEY` su Vercel
2. Fai deploy (push su master)
3. Vai su `/dashboard/super-admin` (produzione)
4. Seleziona DeepSeek
5. Testa Anne

## 📊 Architettura

```
┌─────────────────────────────────────────┐
│  Superadmin Dashboard                    │
│  (ai-provider-selector.tsx)             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Server Actions                         │
│  (actions/ai-settings.ts)               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Database                               │
│  (system_settings table)               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Agent Chat Route                       │
│  (app/api/ai/agent-chat/route.ts)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  AI Provider Adapter                    │
│  (lib/ai/provider-adapter.ts)          │
│  - AnthropicClient                     │
│  - DeepSeekClient                       │
└─────────────────────────────────────────┘
```

## ⚠️ Note Importanti

1. **Sicurezza:**
   - Solo superadmin può modificare il provider
   - Le API keys sono in variabili d'ambiente (non nel database)
   - RLS policies proteggono `system_settings`

2. **Performance:**
   - La preferenza viene letta ad ogni richiesta (cacheable in futuro)
   - L'adapter crea il client solo quando necessario

3. **Retrocompatibilità:**
   - Se non configurato, default a Anthropic
   - Il codice legacy continua a funzionare

4. **Regressioni:**
   - ✅ Nessuna regressione: il sistema è retrocompatibile
   - ✅ Fallback automatico se provider non disponibile
   - ✅ Logging dettagliato per debug

## 🐛 Troubleshooting

### "API Key non configurata"
- Verifica che `DEEPSEEK_API_KEY` sia in `.env.local` (locale)
- Verifica che sia su Vercel (produzione)
- Riavvia il server dopo aver aggiunto la variabile

### "Provider non cambia"
- Verifica di essere loggato come superadmin
- Controlla i log del server per errori
- Verifica che la migration `058_ai_provider_preferences.sql` sia stata eseguita

### "Errore API DeepSeek"
- Verifica che l'API key sia valida
- Controlla i log del server per dettagli errore
- Verifica che DeepSeek API sia raggiungibile

## 📝 Prossimi Passi (Opzionali)

- [ ] Cache della preferenza provider (evitare query DB ad ogni richiesta)
- [ ] Supporto per altri provider (OpenAI, Gemini, etc.)
- [ ] Metriche per confrontare performance provider
- [ ] A/B testing automatico tra provider

---

**Implementato il:** 2026-01-XX
**Autore:** AI Agent (Auto)

