# 🔑 Aggiornamento ANTHROPIC_API_KEY

## ✅ Completato

- **Locale (.env.local):** ✅ Aggiornato con nuova chiave

## 📝 Da Fare Manualmente su Vercel

La nuova chiave API Anthropic è:
```
***REDACTED_ANTHROPIC_KEY***
```

### Passi per Aggiornare su Vercel Dashboard

1. **Vai su Vercel Dashboard**
   - URL: https://vercel.com/dashboard
   - Seleziona progetto: `spediresicuro`

2. **Vai su Settings → Environment Variables**

3. **Trova `ANTHROPIC_API_KEY`**
   - Clicca sui **3 puntini** (⋮) accanto alla variabile
   - Seleziona **Edit**

4. **Aggiorna il valore**
   - Incolla la nuova chiave:
     ```
     ***REDACTED_ANTHROPIC_KEY***
     ```
   - Assicurati che sia selezionato per: **Production**, **Preview**, **Development**
   - Clicca **Save**

5. **Redeploy (opzionale ma consigliato)**
   - Vai su **Deployments**
   - Clicca sui **3 puntini** (⋮) dell'ultimo deployment
   - Seleziona **Redeploy**
   - Questo assicura che la nuova variabile venga caricata

## 🔍 Verifica

Dopo l'aggiornamento, verifica che funzioni:

1. **Test Locale:**
   ```bash
   npm run dev
   ```
   - Apri Anne e fai una domanda
   - Verifica nei log che non ci siano errori di autenticazione

2. **Test Produzione:**
   - Dopo il redeploy, testa Anne in produzione
   - Verifica che risponda correttamente

## ⚠️ Note

- La variabile è già presente su Vercel (creata 32 giorni fa)
- Deve solo essere **aggiornata** con il nuovo valore
- Non serve rimuoverla e ricrearla

---

**Data aggiornamento:** 2026-01-XX
**Chiave aggiornata:** ANTHROPIC_API_KEY

