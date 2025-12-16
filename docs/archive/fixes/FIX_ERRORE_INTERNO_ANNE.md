# 🔧 Fix "Errore interno del server" - Anne

## 🎯 Problema

Anne mostra "Errore interno del server" quando provi a inviare un messaggio.

## 🔍 Diagnosi

### 1. **Controlla i Log del Server**

Quando vedi "Errore interno del server", **guarda immediatamente la console del server** (dove hai avviato `npm run dev`). Vedrai log dettagliati che ti dicono esattamente cosa è andato storto:

```
❌ [Anne] Errore Generale: {
  message: "...",
  name: "...",
  stack: "...",
  ...
}
❌ [Anne] Context: {
  hasSession: true/false,
  userId: "...",
  userRole: "...",
  hasApiKey: true/false,
  apiKeyLength: X
}
```

### 2. **Errori Comuni e Soluzioni**

#### Errore: "ANTHROPIC_API_KEY NON TROVATA"
**Causa**: La chiave non è in `.env.local` o il server non è stato riavviato.

**Soluzione**:
1. Verifica che `.env.local` contenga: `ANTHROPIC_API_KEY=sk-ant-...`
2. Riavvia il server: `Ctrl+C` e poi `npm run dev`

#### Errore: "401 Unauthorized" o "Invalid API Key"
**Causa**: Chiave API non valida o scaduta.

**Soluzione**:
1. Vai su https://console.anthropic.com/
2. Verifica che la chiave sia attiva
3. Crea una nuova chiave se necessario
4. Aggiorna `.env.local` e riavvia il server

#### Errore: "Cannot read property 'X' of undefined"
**Causa**: Problema con la sessione utente o dati mancanti.

**Soluzione**:
1. Fai logout e login di nuovo
2. Verifica che la sessione sia valida
3. Controlla i log per vedere quale proprietà manca

#### Errore: "Network error" o "ECONNREFUSED"
**Causa**: Problema di connessione a Anthropic API.

**Soluzione**:
1. Verifica la connessione internet
2. Controlla se ci sono firewall o proxy che bloccano le richieste
3. Prova a riavviare il server

### 3. **Verifica Configurazione Completa**

```bash
# 1. Verifica che .env.local esista
dir .env.local

# 2. Verifica che ANTHROPIC_API_KEY sia presente
findstr "ANTHROPIC_API_KEY" .env.local

# 3. Verifica formato (deve essere esattamente così):
# ANTHROPIC_API_KEY=sk-ant-api03-...
# (senza spazi, senza virgolette, non commentata)
```

### 4. **Test Diretto**

Puoi testare se la chiave funziona direttamente:

```bash
# Sostituisci YOUR_API_KEY con la tua chiave
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

Se funziona, riceverai una risposta JSON. Se non funziona, vedrai un errore che ti dice cosa c'è che non va.

## 📝 Checklist Debug

- [ ] Server riavviato dopo aver modificato `.env.local`
- [ ] `.env.local` contiene `ANTHROPIC_API_KEY=sk-ant-...`
- [ ] La riga NON è commentata (non inizia con `#`)
- [ ] Non ci sono spazi prima/dopo il `=`
- [ ] Log del server mostrano "ANTHROPIC_API_KEY presente: true"
- [ ] Chiave API valida su console.anthropic.com
- [ ] Sessione utente valida (fai logout/login se necessario)
- [ ] Connessione internet attiva
- [ ] Nessun firewall/proxy che blocca le richieste

## 🆘 Se Ancora Non Funziona

1. **Copia TUTTI i log** del server quando invii un messaggio ad Anne
2. **Copia il messaggio di errore completo** che vedi nel modal di Anne
3. **Verifica** che la chiave funzioni con il test curl sopra
4. **Controlla** che non ci siano errori di sintassi in `.env.local`

---

**Ultimo aggiornamento**: Dicembre 2024
