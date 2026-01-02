# 🔧 Fix: Anne non funziona da Mobile

## 🎯 Problema

Anne mostra questo errore da mobile/produzione:

```
🔑 Errore autenticazione API: verifica che ANTHROPIC_API_KEY sia corretta
```

**Possibili cause**:

1. La variabile `ANTHROPIC_API_KEY` non è configurata su Vercel (o è configurata male)
2. Problemi di connessione/timeout su mobile (gestione errori migliorata nel fix)
3. Errori di parsing JSON su mobile (gestione errori migliorata nel fix)

## ✅ Fix Applicato

**File modificato**: `components/anne/AnneAssistant.tsx`

**Miglioramenti**:

- ✅ Aggiunto timeout di 60 secondi per evitare richieste bloccate su mobile
- ✅ Migliorata gestione errori di rete (timeout, connessione instabile)
- ✅ Gestione robusta del parsing JSON (legge testo prima di fare parse)
- ✅ Messaggi di errore più specifici per mobile

**Nota**: Se su desktop funziona, la variabile è probabilmente configurata. Il problema era nella gestione degli errori su mobile.

## ✅ Soluzione: Aggiungi ANTHROPIC_API_KEY su Vercel

### Passo 1: Ottieni la Chiave API di Anthropic

Se non hai ancora una chiave API di Anthropic:

1. Vai su: https://console.anthropic.com/
2. Accedi con il tuo account
3. Vai su **API Keys** (o **Settings** > **API Keys**)
4. Clicca **"Create Key"** o **"New Key"**
5. Copia la chiave (inizia con `sk-ant-api03-...`)
6. **⚠️ IMPORTANTE**: Salvala subito, non la vedrai più!

Se hai già la chiave in `.env.local`:

1. Apri il file `.env.local` nella root del progetto
2. Cerca la riga: `ANTHROPIC_API_KEY=sk-ant-api03-...`
3. Copia il valore (senza il nome della variabile)

### Passo 2: Aggiungi la Variabile su Vercel

#### Metodo A: Vercel Dashboard (Consigliato)

1. **Vai su Vercel Dashboard**

   - URL: https://vercel.com/dashboard
   - Accedi con il tuo account

2. **Seleziona il Progetto**

   - Clicca sul progetto **spediresicuro**

3. **Vai su Environment Variables**

   - Clicca su **Settings** (⚙️) nella barra superiore
   - Nel menu laterale, clicca su **Environment Variables**

4. **Aggiungi la Variabile**

   - Clicca su **"Add New"** o **"Add"**
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Incolla la chiave API (es: `sk-ant-api03-ABC123XYZ789...`)
   - **Environment**: Seleziona **tutte e tre** le opzioni:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Clicca **"Save"**

5. **Verifica**
   - Dovresti vedere `ANTHROPIC_API_KEY` nella lista
   - Verifica che sia presente per Production, Preview e Development

#### Metodo B: Vercel CLI (Alternativo)

```bash
# Aggiungi per Production
npx vercel env add ANTHROPIC_API_KEY production
# Quando richiesto, incolla la chiave e premi Enter

# Aggiungi per Preview
npx vercel env add ANTHROPIC_API_KEY preview
# Quando richiesto, incolla la chiave e premi Enter

# Aggiungi per Development
npx vercel env add ANTHROPIC_API_KEY development
# Quando richiesto, incolla la chiave e premi Enter
```

### Passo 3: Riavvia il Deploy

**⚠️ IMPORTANTE**: Dopo aver aggiunto la variabile, devi fare un nuovo deploy!

#### Opzione A: Deploy Automatico (Push su master)

```bash
git add .
git commit -m "fix: aggiunta ANTHROPIC_API_KEY su Vercel"
git push origin master
```

Vercel farà automaticamente un nuovo deploy.

#### Opzione B: Deploy Manuale

```bash
npx vercel --prod
```

Oppure vai su Vercel Dashboard > **Deployments** > Clicca sui 3 puntini (⋮) dell'ultimo deploy > **Redeploy**

### Passo 4: Verifica che Funzioni

1. **Attendi il deploy** (circa 2-3 minuti)
2. **Vai su** https://spediresicuro.vercel.app
3. **Accedi** con il tuo account
4. **Prova Anne** da mobile o desktop
5. **Dovresti vedere** che Anne risponde correttamente senza errori

## 🔍 Verifica Configurazione

Per verificare che la variabile sia configurata correttamente:

```bash
# Lista tutte le variabili d'ambiente su Vercel
npx vercel env ls
```

Dovresti vedere `ANTHROPIC_API_KEY` nella lista con scope Production, Preview, Development.

## ⚠️ Note Importanti

1. **Formato Chiave**: La chiave deve iniziare con `sk-ant-api03-` e non deve avere spazi o virgolette
2. **Sicurezza**: La chiave è automaticamente criptata da Vercel
3. **Deploy Necessario**: Dopo aver aggiunto la variabile, **sempre** fare un nuovo deploy
4. **Tutti gli Ambienti**: Aggiungi la variabile per Production, Preview E Development

## 🐛 Se Ancora Non Funziona

### Verifica 1: Chiave Valida

- Vai su https://console.anthropic.com/
- Verifica che la chiave sia attiva e non scaduta
- Se necessario, crea una nuova chiave

### Verifica 2: Deploy Completato

- Vai su Vercel Dashboard > Deployments
- Verifica che l'ultimo deploy sia completato (status: ✅ Ready)
- Se è ancora in corso, aspetta che finisca

### Verifica 3: Cache Browser

- Prova a fare **hard refresh** su mobile:
  - iPhone Safari: Tieni premuto il pulsante refresh
  - Android Chrome: Menu > Clear cache
- Oppure prova in **incognito/privato**

### Verifica 4: Log Vercel

- Vai su Vercel Dashboard > Deployments > Ultimo deploy > **Functions**
- Clicca su `/api/ai/agent-chat`
- Controlla i log per vedere se ci sono errori

## 📝 Checklist Finale

- [ ] Ho ottenuto la chiave API da Anthropic Console
- [ ] Ho aggiunto `ANTHROPIC_API_KEY` su Vercel Dashboard
- [ ] Ho selezionato tutti e 3 gli ambienti (Production, Preview, Development)
- [ ] Ho fatto un nuovo deploy
- [ ] Ho verificato che Anne funzioni correttamente

---

**Ultimo aggiornamento**: 2025-01-17
**Problema risolto**: Anne non funziona da mobile per mancanza di ANTHROPIC_API_KEY su Vercel
