# Fix Anne - Configurazione ANTHROPIC_API_KEY su Vercel

## Problema
Anne risponde con "al momento non posso accedere all'AI avanzata" perché manca `ANTHROPIC_API_KEY` nelle variabili d'ambiente di Vercel.

## Soluzione

### 1. Accedi a Vercel Dashboard
```
https://vercel.com/gdsgroupsas-jpgs-projects/spediresicuro/settings/environment-variables
```

### 2. Aggiungi variabile d'ambiente

**Nome variabile:**
```
ANTHROPIC_API_KEY
```

**Valore:**
```
[LA TUA CHIAVE API ANTHROPIC - inizia con sk-ant-api...]
```

**Environments:**
- ✅ Production
- ✅ Preview  
- ✅ Development

### 3. Redeploy il progetto

Dopo aver salvato la variabile, fai un redeploy:

**Opzione A - Dal Dashboard:**
1. Vai su "Deployments"
2. Clicca sui 3 puntini dell'ultimo deployment
3. Clicca "Redeploy"

**Opzione B - Da Git:**
```bash
git commit --allow-empty -m "trigger: Redeploy per ANTHROPIC_API_KEY"
git push origin master
```

### 4. Verifica che funzioni

Dopo il deploy (1-2 minuti):
1. Apri https://spediresicuro.vercel.app
2. Fai login
3. Clicca su "AI Assistant" 
4. Scrivi "Ciao Anne"
5. Dovrebbe rispondere con l'AI vera (non più messaggio "non posso accedere")

## Note
- Il modello usato è `claude-3-haiku-20240307` (economico e veloce)
- Non usare `claude-3-5-sonnet` perché la tua API key non ha accesso a quel modello
- Costo: ~$0.25 per 1M token input, $1.25 per 1M token output
