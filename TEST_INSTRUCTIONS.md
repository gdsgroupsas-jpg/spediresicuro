# 🧪 ISTRUZIONI TEST MANUALE - Fix Multi-Contratto

## ⚠️ NOTA IMPORTANTE

L'ambiente di sviluppo corrente **non ha accesso alla rete esterna** per motivi di sicurezza, quindi i test automatici con chiamate API reali non possono essere eseguiti qui.

**Errore riscontrato:**

```
Error: getaddrinfo EAI_AGAIN pxwmposcsvsusjxdjues.supabase.co
curl: (56) CONNECT tunnel failed, response 403
```

## ✅ COSA È STATO COMPLETATO

### 1. **Tutti i fix implementati e committati** ✅

- Commit `9f38d0f`: Fix metadata MERGE logic
- Commit `4784b5e`: Rimosso fallback pericoloso `courier_id`
- Commit `a513a18`: Documentazione PR completa
- Commit `8f0e609`: Script di test e query di validazione

### 2. **Script di test pronti** ✅

- `scripts/test-multi-contract-real.ts` - Test completo con API reali
- `scripts/test-connection.ts` - Test connessione Supabase
- `VALIDATION_QUERIES.sql` - Query SQL per validazione manuale

### 3. **Ambiente configurato** ✅

- `.env.local` creato con credenziali Supabase
- npm dependencies installate (1073 packages)
- TypeScript configurato

### 4. **Documentazione completa** ✅

- `PR_INSTRUCTIONS.md` - Template completo per Pull Request
- Commit messages dettagliati con analisi tecnica

---

## 🚀 PROSSIMI STEP (ESECUZIONE MANUALE)

### STEP 1: Esegui Test in Ambiente con Rete

**Opzione A: Ambiente locale con Node.js**

```bash
# 1. Assicurati di essere sul branch corretto
git checkout claude/audit-listini-sync-bug-tXnmq

# 2. Verifica che .env.local esista
cat .env.local

# 3. Esegui il test multi-contratto
npx tsx scripts/test-multi-contract-real.ts
```

**Opzione B: Vercel CLI (se hai accesso)**

```bash
vercel env pull .env.local
npm run ts-node scripts/test-multi-contract-real.ts
```

**Opzione C: Produzione Vercel**

Se il progetto è già deployato, puoi testare direttamente in produzione dopo il merge.

---

### STEP 2: Interpreta i Risultati del Test

**Risultato Atteso (✅ SUCCESS):**

```
🚀 TEST MULTI-CONTRATTO SYNC - REAL API CALLS
════════════════════════════════════════════════════════════════════════════════

✅ Utente: testspediresicuro+postaexpress@gmail.com
   Account Type: reseller (o byoc_user)
   Is Reseller: true

📋 Configurazioni Spedisci.Online trovate: 2
   1. Contratto Principale
      ID: abc12345...
   2. Contratto Secondario
      ID: def67890...

📊 STATO DOPO LA SYNC
════════════════════════════════════════════════════════════════════════════════

Listini fornitore totali: 4

📋 Listini per Contratto:

   ConfigID: abc12345...
      • Poste Italiane - Contratto 1
        Carrier: poste_italiane
        Updated: 05/01/2026, 15:30:00
      • BRT - Contratto 1
        Carrier: brt
        Updated: 05/01/2026, 15:30:15

   ConfigID: def67890...
      • Poste Italiane - Contratto 2
        Carrier: poste_italiane
        Updated: 05/01/2026, 15:30:30
      • BRT - Contratto 2
        Carrier: brt
        Updated: 05/01/2026, 15:30:45

✅ VALIDAZIONE
════════════════════════════════════════════════════════════════════════════════

📊 Contratti configurati: 2
📦 Contratti con listini: 2

✅ SUCCESS! Ogni contratto ha i propri listini separati

   ✅ ConfigID abc12345 → 2 corriere/i: poste_italiane, brt
   ✅ ConfigID def67890 → 2 corriere/i: poste_italiane, brt

════════════════════════════════════════════════════════════════════════════════
🎉 TEST PASSED - Multi-contratto funziona correttamente!
════════════════════════════════════════════════════════════════════════════════
```

**Risultato Errato (❌ FAIL):**

Se vedi questo, il fix NON ha funzionato:

```
❌ FAIL! Alcuni contratti non hanno listini separati
   Expected: 2, Got: 1
```

Oppure:

```
⚠️ ConfigID abc12345 non ha corrieri
```

---

### STEP 3: Validazione SQL (Manuale)

Esegui queste query nel pannello Supabase per verificare manualmente:

**Query 1: Conta listini per contratto**

```sql
SELECT
  COALESCE(metadata->>'courier_config_id', 'N/A') as config_id,
  COUNT(*) as numero_listini,
  STRING_AGG(DISTINCT metadata->>'carrier_code', ', ') as corrieri,
  STRING_AGG(DISTINCT name, ', ') as nomi_listini
FROM price_lists
WHERE created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND list_type = 'supplier'
GROUP BY metadata->>'courier_config_id'
ORDER BY MIN(created_at);
```

**Risultato atteso:** 2+ righe, una per ogni contratto

**Query 2: Verifica metadata completo**

```sql
SELECT
  id,
  name,
  metadata->>'carrier_code' as carrier,
  metadata->>'courier_config_id' as config_id,
  metadata->>'synced_at' as last_sync,
  created_at,
  updated_at
FROM price_lists
WHERE created_by = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND list_type = 'supplier'
ORDER BY updated_at DESC;
```

**Risultato atteso:** Tutti i listini hanno `carrier` E `config_id` non NULL

**Altre query:** Vedi `VALIDATION_QUERIES.sql` per le query complete

---

### STEP 4: Crea Pull Request

Una volta che il test ha passato con successo:

1. **Apri questo URL nel browser:**

   ```
   https://github.com/gdsgroupsas-jpg/spediresicuro/compare/master...claude/audit-listini-sync-bug-tXnmq
   ```

2. **Clicca "Create Pull Request"**

3. **Copia il contenuto da `PR_INSTRUCTIONS.md`:**
   - Titolo dalla riga 23
   - Descrizione dalle righe 32-339

4. **Aggiungi labels:**
   - `priority: critical`
   - `type: bug`
   - `security-reviewed`
   - `ready-to-merge`

5. **Assegna reviewer:** @gdsgroupsas

---

### STEP 5: Deploy e Validazione Post-Deploy

Dopo il merge della PR:

1. **Attendi deploy automatico** (Vercel)

2. **Monitora logs** per 1 ora dopo deploy

3. **Esegui validazione produzione:**

```sql
-- Verifica metadata integrity in production
SELECT
  id,
  name,
  metadata->>'carrier_code' as carrier,
  metadata->>'courier_config_id' as config,
  created_at
FROM price_lists
WHERE list_type = 'supplier'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Risultato atteso:** Tutti i price_lists hanno `carrier_code` popolato

---

## 🔧 TROUBLESHOOTING

### Problema: Test script fallisce con errore di connessione

**Soluzione:** Verifica che il file `.env.local` esista e contenga:

```bash
cat .env.local
```

Se mancante, crealo:

```bash
echo 'NEXT_PUBLIC_SUPABASE_URL="https://pxwmposcsvsusjxdjues.supabase.co"' > .env.local
echo 'SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."' >> .env.local
```

### Problema: "User not found"

**Verifica:** L'email testspediresicuro+postaexpress@gmail.com esiste nel database?

```sql
SELECT id, email, account_type FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com';
```

### Problema: "No configurations found"

**Verifica:** L'utente ha configurazioni Spedisci.Online attive?

```sql
SELECT id, name, provider_id, is_active
FROM courier_configs
WHERE owner_user_id = (
  SELECT id FROM users WHERE email = 'testspediresicuro+postaexpress@gmail.com'
)
AND provider_id = 'spedisci_online';
```

---

## 📊 RECAP TECNICO

### Bug Risolti

1. **Metadata Overwrite** (`actions/spedisci-online-rates.ts:656-719`)
   - **Prima:** `update({ metadata: { courier_config_id: configId } })` → sovrascriveva tutto
   - **Dopo:** Merge con `...existingMetadata` → preserva `carrier_code`

2. **Fallback Pericoloso** (`actions/spedisci-online-rates.ts:619-631`)
   - **Prima:** Cercava per `courier_id` dopo fallimento ricerca metadata
   - **Dopo:** Rimosso completamente quando `configId` presente

3. **Query Limit** (`actions/spedisci-online-rates.ts:571`)
   - **Prima:** `limit(20)`
   - **Dopo:** `limit(100)`

4. **Security Hardening** (`actions/spedisci-online-rates.ts:378-389`)
   - Validazione `carrierCode` per prevenire JSONB injection

### File Modificati

- `actions/spedisci-online-rates.ts` (+76 lines, -16 lines)

### Test e Documentazione Creati

- `scripts/test-multi-contract-real.ts` - Test automatico
- `scripts/test-connection.ts` - Test connessione
- `VALIDATION_QUERIES.sql` - 5 query di validazione
- `PR_INSTRUCTIONS.md` - Template PR completo
- `TEST_INSTRUCTIONS.md` - Questo file

---

## ✅ CHECKLIST FINALE

- [x] Fix implementati e testati localmente (sintassi)
- [x] Commit con messaggi dettagliati
- [x] Script di test pronti
- [x] Query di validazione pronte
- [x] Documentazione PR completa
- [x] Security audit completato
- [ ] **Test con API reali eseguito (MANUALE - vedi sopra)**
- [ ] **Validazione SQL eseguita (MANUALE - vedi sopra)**
- [ ] **Pull Request creata**
- [ ] **Deploy in produzione**
- [ ] **Validazione post-deploy**

---

## 🔗 LINK UTILI

- **Crea PR:** https://github.com/gdsgroupsas-jpg/spediresicuro/compare/master...claude/audit-listini-sync-bug-tXnmq
- **Commit principale:** https://github.com/gdsgroupsas-jpg/spediresicuro/commit/9f38d0f
- **Repository:** https://github.com/gdsgroupsas-jpg/spediresicuro

---

## 📞 CONTATTI

Per problemi durante il test o deploy, contattare:

- **Product Owner:** @gdsgroupsas
- **Email Test:** testspediresicuro+postaexpress@gmail.com

---

**File generato:** `TEST_INSTRUCTIONS.md`
**Data:** 2026-01-05
**Autore:** Claude (AI Assistant)
**Branch:** `claude/audit-listini-sync-bug-tXnmq`
