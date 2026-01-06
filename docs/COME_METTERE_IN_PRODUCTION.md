# 🚀 Come Mettere la PR #33 in Production

## 📋 Situazione Attuale

**Branch:** `fix/reseller-roles-and-fee-improvements`  
**PR:** #33 (aperta)  
**Deploy Vercel:** Preview (non production)

**Perché è in Preview?**
- Vercel crea automaticamente un **preview deployment** per ogni branch/PR
- Il preview serve per testare le modifiche prima di metterle in production
- La production è collegata solo al branch `master`

---

## 🎯 Come Metterla in Production

### Opzione 1: Merge su Master (Consigliato)

**Passi:**

1. **Verifica che tutto sia pronto:**
   ```bash
   # Assicurati di essere sul branch corretto
   git checkout fix/reseller-roles-and-fee-improvements
   
   # Verifica che non ci siano modifiche non committate
   git status
   
   # Verifica che il build funzioni
   npm run build
   ```

2. **Merge su GitHub:**
   - Vai su: https://github.com/gdsgroupsas-jpg/spediresicuro/pull/33
   - Clicca **"Merge pull request"**
   - Conferma il merge
   - (Opzionale) Elimina il branch dopo il merge

3. **Vercel deploy automatico:**
   - Vercel rileva automaticamente il push su `master`
   - Crea un nuovo deployment su production
   - Il deploy avviene in ~2-5 minuti

4. **Verifica:**
   - Vai su Vercel Dashboard → Deployments
   - Verifica che il nuovo deployment sia "Ready" e "Production"
   - Controlla l'URL di production: https://spediresicuro.it

---

### Opzione 2: Merge Locale + Push

**Se preferisci fare il merge localmente:**

```bash
# 1. Assicurati di essere su master
git checkout master

# 2. Aggiorna master con le ultime modifiche
git pull origin master

# 3. Merge del branch
git merge fix/reseller-roles-and-fee-improvements

# 4. Risolvi eventuali conflitti (se ci sono)
# (In questo caso non dovrebbero esserci)

# 5. Push su master
git push origin master

# 6. Vercel deploy automatico
# Vercel rileva il push e fa deploy automatico
```

---

## ⚠️ Importante: Migration Database

**PRIMA del merge, assicurati che la migration sia applicata:**

La PR include la migration `080_add_reseller_to_account_type_enum.sql` che aggiunge `'reseller'` all'enum `account_type`.

**Verifica:**
1. Vai su Supabase Dashboard → SQL Editor
2. Esegui la migration se non è già stata eseguita:
   ```sql
   -- Verifica se 'reseller' esiste già
   SELECT enumlabel 
   FROM pg_enum 
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_type')
   AND enumlabel = 'reseller';
   ```

**Se non esiste:**
- Esegui la migration `supabase/migrations/080_add_reseller_to_account_type_enum.sql`
- Oppure eseguila manualmente prima del deploy

---

## 🔍 Verifica Post-Deploy

Dopo il merge e il deploy, verifica:

1. **Build Vercel:**
   - ✅ Build completato senza errori
   - ✅ Deployment "Ready" e "Production"

2. **Funzionalità:**
   - ✅ Login funziona
   - ✅ Dashboard carica correttamente
   - ✅ Creazione reseller funziona (se sei superadmin)
   - ✅ Badge ruoli mostrano colori corretti
   - ✅ Platform fee = 0 funziona
   - ✅ Autocomplete città non si riapre dopo selezione

3. **Database:**
   - ✅ Enum `account_type` include `'reseller'`
   - ✅ Utenti reseller hanno `account_type='reseller'`

---

## 📊 Timeline Tipica

```
1. Merge PR su GitHub
   ↓ (~30 secondi)
2. GitHub webhook notifica Vercel
   ↓ (~10 secondi)
3. Vercel inizia build
   ↓ (~2-5 minuti)
4. Build completato
   ↓ (~1 minuto)
5. Deploy su production
   ↓
✅ Sito aggiornato!
```

**Totale:** ~3-7 minuti

---

## 🚨 Se Qualcosa Va Storto

### Rollback Rapido (Vercel)

1. Vai su Vercel Dashboard → Deployments
2. Trova l'ultimo deployment funzionante (prima del merge)
3. Clicca "..." → "Promote to Production"
4. Il sito torna alla versione precedente

### Rollback Git (se necessario)

```bash
# Revert dell'ultimo commit su master
git revert HEAD
git push origin master
```

---

## ✅ Checklist Pre-Merge

- [ ] Build locale funziona (`npm run build`)
- [ ] Test passano (se ci sono)
- [ ] Migration database applicata (se necessaria)
- [ ] Preview deployment funziona correttamente
- [ ] Nessun errore nei log Vercel preview
- [ ] Documentazione aggiornata
- [ ] CHANGELOG.md aggiornato

---

## 🎯 Conclusione

**Per mettere in production:**
1. Merge PR #33 su `master` (via GitHub o locale)
2. Vercel fa deploy automatico
3. Verifica che tutto funzioni

**Tempo totale:** ~5-10 minuti (inclusa verifica)

**Nota:** Il preview deployment è già disponibile e funzionante. Il merge su master è l'unico passo necessario per portarlo in production.
