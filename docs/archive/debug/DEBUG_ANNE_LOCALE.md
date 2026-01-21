# 🔍 Debug Anne in Locale - Guida Completa

## ✅ Se la Chiave API è Corretta

Se hai verificato che `ANTHROPIC_API_KEY` è corretta in `.env.local`, ma Anne ancora non funziona, segui questi passaggi:

## 🔍 Passo 1: Verifica Riavvio Server

**IMPORTANTE**: Dopo aver modificato `.env.local`, **sempre riavviare** il server:

```bash
# 1. Ferma il server (Ctrl+C nella console dove gira npm run dev)
# 2. Riavvia
npm run dev
```

## 🔍 Passo 2: Controlla i Log del Server

Quando invii un messaggio ad Anne, **guarda la console del server** (dove hai avviato `npm run dev`). Dovresti vedere:

### ✅ Se Funziona:

```
🔍 [Anne Module] Verifica Environment Variables:
   ANTHROPIC_API_KEY presente: true
   ANTHROPIC_API_KEY lunghezza: 100+
   ANTHROPIC_API_KEY primi 20 char: sk-ant-api03-...

🤖 [Anne] Chiamata Claude API in corso...
   API Key presente: SI (lunghezza: 100+)
   Model: claude-3-haiku-20240307
   Messages count: X

✅ [Anne] Risposta Claude ricevuta: X blocks
```

### ❌ Se NON Funziona:

#### Caso 1: API Key Non Trovata

```
❌ [Anne Module] ANTHROPIC_API_KEY NON TROVATA!
```

**Soluzione**: Riavvia il server dopo aver aggiunto la chiave.

#### Caso 2: Errore 401 (Autenticazione)

```
❌ [Anne] Errore Claude API: { message: "...", status: 401, ... }
❌ [Anne] API Key presente: true
```

**Possibili cause**:

- Chiave API non valida o scaduta
- Chiave copiata male (spazi, caratteri mancanti)
- Chiave di un account diverso

**Soluzione**:

1. Vai su https://console.anthropic.com/
2. Verifica che la chiave sia attiva
3. Crea una nuova chiave se necessario
4. Copia e incolla di nuovo in `.env.local`
5. Riavvia il server

#### Caso 3: Errore 429 (Rate Limit)

```
❌ [Anne] Errore Claude API: { message: "...", status: 429, ... }
```

**Soluzione**: Aspetta qualche minuto e riprova. Hai raggiunto il limite di richieste.

#### Caso 4: Errore 400 (Bad Request)

```
❌ [Anne] Errore Claude API: { message: "...", status: 400, ... }
```

**Possibili cause**:

- Problema con il formato dei messaggi
- Modello non disponibile con la tua API key

**Soluzione**: Controlla i log completi per vedere il messaggio di errore specifico.

## 🔍 Passo 3: Test Diretto API

Puoi testare direttamente l'API con curl:

```bash
curl -X POST http://localhost:3000/api/ai/agent-chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TUO_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Ciao"}]}'
```

**Nota**: Devi essere autenticato. Meglio testare dal browser aprendo Anne.

## 🔍 Passo 4: Verifica Modello API

Il codice usa `claude-3-haiku-20240307`. Se la tua API key non ha accesso a questo modello, potresti avere errori.

**Verifica**:

1. Vai su https://console.anthropic.com/
2. Controlla quali modelli sono disponibili per il tuo account
3. Se necessario, modifica il modello in `app/api/ai/agent-chat/route.ts` (riga 191)

## 🔍 Passo 5: Verifica Formato Chiave

La chiave deve essere esattamente:

```
ANTHROPIC_API_KEY=sk-ant-api03-ABC123XYZ789...
```

**Controlla**:

- ✅ Non ci sono spazi prima o dopo il `=`
- ✅ Non inizia con `#` (non è commentata)
- ✅ Non ci sono virgolette attorno al valore
- ✅ La chiave inizia con `sk-ant-api03-`

## 📝 Checklist Completa

- [ ] `.env.local` esiste nella root del progetto
- [ ] `ANTHROPIC_API_KEY=sk-ant-...` è presente in `.env.local`
- [ ] La riga NON è commentata (non inizia con `#`)
- [ ] Non ci sono spazi prima/dopo il `=`
- [ ] Il server è stato **riavviato** dopo aver aggiunto/modificato la chiave
- [ ] I log del server mostrano "ANTHROPIC_API_KEY presente: true"
- [ ] La chiave è valida su console.anthropic.com
- [ ] Non hai raggiunto il rate limit (429)

## 🆘 Se Ancora Non Funziona

1. **Copia i log completi** del server quando invii un messaggio ad Anne
2. **Verifica** che la chiave funzioni su console.anthropic.com
3. **Prova** a creare una nuova chiave API
4. **Controlla** che non ci siano errori di rete o firewall

---

**Ultimo aggiornamento**: Dicembre 2024
