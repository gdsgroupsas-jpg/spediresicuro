# 🔧 Fix: Anne non funziona da Mobile

## 🎯 Problema

Anne mostra questo errore da mobile/produzione:

```
🔑 Errore autenticazione API: verifica che ANTHROPIC_API_KEY sia corretta
```

**Oppure nei log Vercel vedi**:

```
❌ [Anne] Errore Claude API: {
  message: '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}',
  status: 401,
  type: 'api_error'
}
```

**Possibili cause**:

1. ❌ **CHIAVE INVALIDA/SCADUTA** (più comune) - La chiave su Vercel è invalida o scaduta
2. La variabile `ANTHROPIC_API_KEY` non è configurata su Vercel (o è configurata male)
3. Problemi di connessione/timeout su mobile (gestione errori migliorata nel fix)
4. Errori di parsing JSON su mobile (gestione errori migliorata nel fix)

## ✅ Fix Applicato

**File modificato**: `components/anne/AnneAssistant.tsx`

**Miglioramenti**:

- ✅ Aggiunto timeout di 60 secondi per evitare richieste bloccate su mobile
- ✅ Migliorata gestione errori di rete (timeout, connessione instabile)
- ✅ Gestione robusta del parsing JSON (legge testo prima di fare parse)
- ✅ Messaggi di errore più specifici per mobile

**Nota**: Se su desktop funziona, la variabile è probabilmente configurata. Il problema era nella gestione degli errori su mobile.

## ✅ Soluzione: Aggiorna ANTHROPIC_API_KEY su Vercel

### ⚠️ IMPORTANTE: Se vedi errore 401 "invalid x-api-key"

**La chiave su Vercel è invalida o scaduta!** Devi aggiornarla.

### Passo 1: Ottieni una Nuova Chiave API di Anthropic

1. **Vai su**: https://console.anthropic.com/
2. **Accedi** con il tuo account
3. **Vai su API Keys** (o **Settings** > **API Keys**)
4. **Verifica chiavi esistenti**:
   - Se vedi una chiave esistente, controlla se è attiva
   - Se è scaduta o non funziona, **creane una nuova**
5. **Crea nuova chiave**:
   - Clicca **"Create Key"** o **"New Key"**
   - Dai un nome descrittivo (es: "SpedireSicuro Production")
   - Copia la chiave (inizia con `sk-ant-api03-...`)
   - **⚠️ IMPORTANTE**: Salvala subito, non la vedrai più!

**Se hai già la chiave in `.env.local` e funziona in locale**:

1. Apri il file `.env.local` nella root del progetto
2. Cerca la riga: `ANTHROPIC_API_KEY=sk-ant-api03-...`
3. Copia il valore (senza il nome della variabile)
4. **Usa questa stessa chiave** su Vercel (se funziona in locale, funzionerà anche in produzione)

### Passo 2: Aggiorna la Variabile su Vercel

#### Metodo A: Vercel Dashboard (Consigliato)

1. **Vai su Vercel Dashboard**

   - URL: https://vercel.com/dashboard
   - Accedi con il tuo account

2. **Seleziona il Progetto**

   - Clicca sul progetto **spediresicuro**

3. **Vai su Environment Variables**

   - Clicca su **Settings** (⚙️) nella barra superiore
   - Nel menu laterale, clicca su **Environment Variables**

4. **Trova e Aggiorna la Variabile**

   - **Se `ANTHROPIC_API_KEY` esiste già** (caso più comune - chiave invalida):

     - Clicca sui **3 puntini** (⋮) accanto a `ANTHROPIC_API_KEY`
     - Clicca **"Edit"**
     - **Sostituisci il valore** con la nuova chiave valida
     - Verifica che **Environment** includa tutte e tre: Production, Preview, Development
     - Clicca **"Save"**

   - **Se `ANTHROPIC_API_KEY` NON esiste**:
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

**⚠️ IMPORTANTE**: Se la variabile esiste già, devi prima rimuoverla e poi aggiungerla di nuovo.

```bash
# 1. Rimuovi la variabile esistente (per tutti gli ambienti)
npx vercel env rm ANTHROPIC_API_KEY production
npx vercel env rm ANTHROPIC_API_KEY preview
npx vercel env rm ANTHROPIC_API_KEY development

# 2. Aggiungi la nuova chiave valida
npx vercel env add ANTHROPIC_API_KEY production
# Quando richiesto, incolla la nuova chiave valida e premi Enter

npx vercel env add ANTHROPIC_API_KEY preview
# Quando richiesto, incolla la stessa chiave e premi Enter

npx vercel env add ANTHROPIC_API_KEY development
# Quando richiesto, incolla la stessa chiave e premi Enter
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

### Verifica 1: Chiave Valida (⚠️ PIÙ IMPORTANTE)

**Se vedi errore 401 "invalid x-api-key", la chiave è sicuramente invalida!**

1. **Vai su** https://console.anthropic.com/
2. **Verifica chiavi esistenti**:
   - Controlla se la chiave è attiva
   - Se è scaduta o revocata, **creane una nuova**
3. **Crea nuova chiave** se necessario:
   - Clicca "Create Key"
   - Copia la nuova chiave
   - **Aggiorna su Vercel** con la nuova chiave
4. **Testa la chiave** (opzionale):
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: TUA_NUOVA_CHIAVE" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
   ```
   Se funziona, riceverai una risposta JSON. Se non funziona, la chiave è invalida.

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
