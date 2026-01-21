# ✅ Checklist Verifica Configurazione GLM-4.7

## 🔍 Controlli da Fare

### 1. Verifica Campi Compilati

Controlla che tutti questi campi siano compilati correttamente:

- [ ] **Protocol**: `OpenAI Protocol` (selezionato)
- [ ] **OpenAI API Key**: Inserita (dovrebbe iniziare con `f8b8fb1a...`)
- [ ] **Override OpenAI Base URL**: `https://api.z.ai/api/coding/paas/v4`
- [ ] **Model Name**: `GLM-4.7` (esattamente così, maiuscolo)

### 2. Verifica Visibilità Modello

- [ ] Il modello "GLM-4.7" appare nella lista dei modelli disponibili?
- [ ] Puoi selezionarlo dal menu a tendina in alto?
- [ ] Vedi un'icona o indicatore che il modello è attivo?

### 3. Test Funzionalità

- [ ] Prova a fare una domanda al modello (es: "Ciao, funzioni?")
- [ ] Il modello risponde?
- [ ] Vedi errori nella console o messaggi di errore?

### 4. Verifica Errori Comuni

#### ❌ Se vedi "Invalid API Key"

- Controlla che l'API Key sia completa (nessun carattere tagliato)
- Verifica che non ci siano spazi prima/dopo la chiave
- Assicurati che sia la chiave del **GLM Coding Plan**, non quella generale

#### ❌ Se vedi "Model not found" o "Invalid model"

- Verifica che il nome sia esattamente `GLM-4.7` (maiuscolo, con trattino)
- Controlla che l'endpoint sia `/api/coding/paas/v4` (non `/api/paas/v4`)

#### ❌ Se vedi "Connection error" o "Network error"

- Verifica la connessione internet
- Controlla che l'URL sia corretto: `https://api.z.ai/api/coding/paas/v4`

#### ❌ Se il modello non appare nella lista

- Verifica di avere **Cursor Pro** o versione superiore
- Riavvia Cursor dopo la configurazione
- Controlla che il provider sia stato salvato correttamente

### 5. Verifica Account Z.AI

- [ ] Il tuo account Z.AI è attivo?
- [ ] Hai crediti disponibili sul GLM Coding Plan?
- [ ] L'API Key è stata generata correttamente da https://z.ai?

---

## 📝 Cosa Controllare Ora

**Dimmi:**

1. ✅ Il modello appare nella lista? (Sì/No)
2. ✅ Riesci a selezionarlo? (Sì/No)
3. ✅ Quando provi a usarlo, cosa succede?
   - Funziona normalmente?
   - Vedi un errore? (se sì, copia il messaggio esatto)
   - Non succede nulla?

4. ✅ Quali campi hai compilato esattamente?
   - Protocol: `[cosa hai selezionato?]`
   - API Key: `[hai inserito la chiave completa?]`
   - Base URL: `[cosa hai scritto esattamente?]`
   - Model Name: `[cosa hai scritto esattamente?]`

---

## 🔧 Configurazione Corretta (Riferimento)

Se qualcosa non funziona, confronta con questa configurazione corretta:

```
Protocol: OpenAI Protocol
OpenAI API Key: f8b8fb1afbf248249158bad996f6b797.ovSQ6QxU23uqIyov
Override OpenAI Base URL: https://api.z.ai/api/coding/paas/v4
Model Name: GLM-4.7
```

⚠️ **Attenzione a:**

- URL deve essere `/api/coding/paas/v4` (con "coding")
- Nome modello deve essere `GLM-4.7` (maiuscolo, trattino)
- API Key deve essere completa, senza spazi

---

_Compila questa checklist e dimmi cosa vedi!_
