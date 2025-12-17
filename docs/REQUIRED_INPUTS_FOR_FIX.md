# 📋 Input Richiesti per Fix Produzione

## ⚠️ IMPORTANTE

Per applicare un fix mirato e sicuro, servono questi dati **prima** di procedere.

---

## 📥 Input Richiesti

### 1. Log Vercel Production (CRITICO)

**Cosa serve**:
- Ultimi 50-100 log intorno al timestamp dell'errore
- Cerca pattern: `❌ [API]`, `❌ [SUPABASE]`

**Come ottenerli**:
1. Vai su: https://vercel.com/dashboard
2. Seleziona progetto → **Deployments** → Ultimo deployment
3. Clicca **"View Function Logs"** o **"Logs"**
4. Filtra per timestamp dell'errore
5. Copia tutti i log che contengono:
   - `POST /api/spedizioni`
   - `❌ [API] Errore`
   - `❌ [SUPABASE]`
   - `❌ [API] Errore addSpedizione`

**Formato richiesto**:
```
[2025-01-XX XX:XX:XX] ❌ [API] Errore addSpedizione: ...
[2025-01-XX XX:XX:XX] ❌ [SUPABASE] Errore salvataggio: { message: "...", code: "..." }
```

---

### 2. Browser Network Info (CRITICO)

**Cosa serve**:
- Endpoint: `POST /api/spedizioni`
- Status code (es: `500`, `503`, `400`)
- Response body completo

**Come ottenerli**:
1. Apri browser DevTools (F12)
2. Tab **Network**
3. Prova a creare spedizione
4. Cerca richiesta `POST /api/spedizioni`
5. Clicca sulla richiesta
6. Tab **Response** → copia tutto il body

**Formato richiesto**:
```json
{
  "success": false,
  "error": "...",
  "message": "..."
}
```

**Oppure**:
- Status: `500 Internal Server Error`
- Response: `{ "error": "...", "message": "..." }`

---

### 3. Lista Variabili Ambiente Vercel Production (CRITICO)

**Cosa serve**:
- Solo i **NOMI** delle variabili (NON i valori)
- Verifica che esistano per **Production**

**Come ottenerli**:
1. Vai su: https://vercel.com/dashboard
2. Seleziona progetto → **Settings** → **Environment Variables**
3. Filtra per **Production**
4. Lista tutti i nomi delle variabili presenti

**Formato richiesto**:
```
Variabili ambiente Production:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- ...
```

**⚠️ NON includere i valori! Solo i nomi.**

---

## 🔍 Cosa Verrò a Cercare

### Nei Log Vercel:

1. **Errore configurazione**:
   ```
   ❌ [SUPABASE] Supabase non configurato
   ```
   → Causa: `SUPABASE_SERVICE_ROLE_KEY` mancante

2. **Errore INSERT**:
   ```
   ❌ [SUPABASE] Errore salvataggio: {
     message: "new row violates row-level security policy",
     code: "42501"
   }
   ```
   → Causa: RLS policy mancante o errata

3. **Errore schema**:
   ```
   ❌ [SUPABASE] Errore salvataggio: {
     message: "column \"X\" does not exist",
     code: "42703"
   }
   ```
   → Causa: Colonna mancante nello schema

4. **Errore constraint**:
   ```
   ❌ [SUPABASE] Errore salvataggio: {
     message: "null value in column \"X\" violates not-null constraint",
     code: "23502"
   }
   ```
   → Causa: Campo obbligatorio mancante nel payload

### Nel Browser Network:

1. **Status 503**: Errore database/Supabase
2. **Status 500**: Errore server interno
3. **Status 400**: Errore validazione input
4. **Response body**: Contiene messaggio errore specifico

### Nelle Variabili Ambiente:

1. **`SUPABASE_SERVICE_ROLE_KEY` mancante**: Causa più probabile
2. **Variabili incomplete**: Solo alcune presenti
3. **Variabili non assegnate a Production**: Assegnate solo a Preview/Development

---

## 📤 Come Inviare i Dati

**Opzione 1**: Incolla direttamente qui nel chat

**Opzione 2**: Crea file temporaneo:
- `logs-vercel.txt` (log Vercel)
- `network-response.json` (response browser)
- `env-vars.txt` (nomi variabili)

**⚠️ SICUREZZA**: 
- NON includere valori di variabili ambiente
- NON includere secrets o token
- Solo messaggi di errore e nomi variabili

---

## ⏱️ Timeline

Dopo aver ricevuto questi input:
1. **Analisi** (5 min): Identifico punto esatto di fallimento
2. **Fix** (10 min): Applico fix minimo e sicuro
3. **Test** (5 min): Verifico che non rompa altro
4. **Deploy** (guidato): Istruzioni per redeploy

**Totale**: ~20 minuti dopo ricezione input

---

## 🆘 Se Non Riesci a Ottenere i Log

**Alternativa**: Test endpoint diagnostico

1. Dopo deploy, testa:
   ```bash
   curl https://tuo-dominio.vercel.app/api/test-supabase
   ```

2. Invia output JSON completo

Questo mi darà informazioni sufficienti per identificare il problema.

---

**Prossimo step**: Invia i 3 input richiesti e procedo con il fix mirato.
