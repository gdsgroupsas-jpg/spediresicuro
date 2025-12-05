# 🚀 ANNE - DEPLOY ONLINE (Vercel)

## ✅ COSA FARE PER RENDERE ANNE ONLINE

### 1. Configura Variabili Ambiente su Vercel

Vai su https://vercel.com → Il tuo progetto → Settings → Environment Variables

Aggiungi queste variabili:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Come ottenere la chiave:**
1. Vai su https://console.anthropic.com/
2. Accedi o crea account
3. Vai su "API Keys" → "Create Key"
4. Copia la chiave (inizia con `sk-ant-...`)

**Importante:**
- Seleziona tutti gli ambienti: Production, Preview, Development
- Dopo aver aggiunto, fai un nuovo deploy

---

### 2. Verifica Database Supabase (Production)

Assicurati di aver eseguito gli script SQL sul database di **produzione**:

1. Vai su https://supabase.com → Il tuo progetto
2. Vai su SQL Editor
3. Esegui questi script in ordine:
   - `002_anne_setup.sql` (se non già fatto)
   - `003_fix_security_issues.sql` (se non già fatto)

**Verifica rapida:**
```sql
-- Controlla che audit_logs esista
SELECT COUNT(*) FROM audit_logs;

-- Controlla che le viste esistano
SELECT * FROM admin_monthly_stats LIMIT 1;
SELECT * FROM top_customers LIMIT 1;
```

---

### 3. Trigger Nuovo Deploy

Dopo aver aggiunto le variabili ambiente:

**Opzione A: Deploy automatico (se hai Git)**
```bash
# Fai un piccolo commit per triggerare deploy
git add .
git commit -m "Deploy Anne"
git push
```

**Opzione B: Deploy manuale**
1. Vai su Vercel Dashboard
2. Vai su "Deployments"
3. Clicca sui 3 puntini dell'ultimo deploy
4. Clicca "Redeploy"
5. Seleziona "Use existing Build Cache" = NO (per ricostruire tutto)

---

### 4. Verifica Deploy

Dopo il deploy:

1. Vai sul tuo sito online (es. https://spediresicuro.it)
2. Fai login
3. Vai al dashboard
4. Cerca il pulsante **"AI Assistant"** nella barra navigazione
5. Clicca e verifica che Anne si apra

---

### 5. Test Anne Online

Prova queste domande:

**Per utenti normali:**
- "Calcola il prezzo per spedire 2kg a Roma"
- "Voglio tracciare una spedizione"

**Per admin:**
- "Analizza il business dell'ultimo mese"
- "Controlla gli ultimi errori di sistema"

---

## 🔍 VERIFICA FUNZIONAMENTO ONLINE

### Se Anne non si apre online:

1. **Controlla Console Browser** (F12 → Console)
   - Cerca errori in rosso
   - Controlla se c'è errore 401 (non autenticato)

2. **Controlla Network Tab** (F12 → Network)
   - Clicca su "AI Assistant"
   - Cerca chiamata a `/api/ai/agent-chat`
   - Controlla status code:
     - 200 = OK ✅
     - 401 = Non autenticato
     - 500 = Errore server
     - 429 = Rate limit

3. **Verifica Vercel Logs:**
   - Vai su Vercel Dashboard → Il tuo progetto → Logs
   - Cerca errori recenti
   - Se vedi "ANTHROPIC_API_KEY is not defined" = variabile non configurata

### Se Anne dice "configura API key":

**Problema:** La variabile `ANTHROPIC_API_KEY` non è configurata su Vercel o non è valida

**Soluzione:**
1. Vai su Vercel → Settings → Environment Variables
2. Verifica che `ANTHROPIC_API_KEY` sia presente
3. Se c'è, verifica che il valore sia corretto (inizia con `sk-ant-...`)
4. Fai un nuovo deploy dopo aver aggiunto/modificato

### Se vedi errori 500 (Internal Server Error):

**Possibili cause:**
1. Database Supabase non configurato (tabelle mancanti)
2. API key Anthropic non valida
3. Errore nel codice

**Soluzione:**
1. Controlla Vercel Logs per vedere l'errore esatto
2. Verifica che gli script SQL siano stati eseguiti su Supabase production
3. Verifica che `ANTHROPIC_API_KEY` sia valida

---

## 📋 CHECKLIST DEPLOY ONLINE

Prima di dire che Anne è online, verifica:

- [ ] `ANTHROPIC_API_KEY` configurata su Vercel (Settings → Environment Variables)
- [ ] Variabile disponibile per Production, Preview, Development
- [ ] Script SQL eseguiti su Supabase **production**:
  - [ ] `002_anne_setup.sql` eseguito
  - [ ] `003_fix_security_issues.sql` eseguito
- [ ] Nuovo deploy fatto su Vercel (dopo aver aggiunto variabili)
- [ ] Deploy completato con successo (verde su Vercel)
- [ ] Sito online accessibile
- [ ] Login funzionante
- [ ] Pulsante "AI Assistant" visibile nel dashboard
- [ ] Modal di Anne si apre
- [ ] Anne risponde (non dice "configura API key")

---

## 🎯 STATO ATTUALE

**Anne è IMPLEMENTATA al 100%** ✅

**Per renderla ONLINE serve:**
1. ✅ Aggiungere `ANTHROPIC_API_KEY` su Vercel
2. ✅ Eseguire script SQL su Supabase production (se non già fatto)
3. ✅ Fare nuovo deploy su Vercel
4. ✅ Testare online

---

## 🆘 PROBLEMI COMUNI ONLINE

### "Non autenticato" quando apro Anne online
- **Causa:** Problema con NextAuth session
- **Soluzione:** Fai logout e login di nuovo

### "Rate limit exceeded"
- **Causa:** Troppe richieste (max 20/minuto per utente)
- **Soluzione:** Aspetta 1 minuto e riprova

### Anne non vede le spedizioni
- **Causa:** Spedizioni non nel database o `user_id` sbagliato
- **Soluzione:** Verifica che le spedizioni siano in Supabase con `user_id` corretto

### Deploy fallisce su Vercel
- **Causa:** Errori di build o variabili mancanti
- **Soluzione:** 
  1. Controlla Vercel Logs
  2. Verifica che tutte le dipendenze siano in `package.json`
  3. Assicurati che `react-markdown` sia installato

---

## 📝 NOTE IMPORTANTI

1. **Variabili Ambiente:**
   - Le variabili su Vercel sono separate da quelle locali
   - Devi aggiungerle manualmente su Vercel Dashboard
   - Dopo averle aggiunte, fai sempre un nuovo deploy

2. **Database:**
   - Gli script SQL devono essere eseguiti sul database di **produzione**
   - Non basta eseguirli solo in locale

3. **Cache:**
   - Dopo il deploy, potrebbe servire un refresh forzato (Ctrl+F5)
   - I browser cacheano JavaScript, quindi potrebbe servire svuotare cache

---

**Anne è pronta per il deploy online! Configura Vercel e testa! 🚀**

