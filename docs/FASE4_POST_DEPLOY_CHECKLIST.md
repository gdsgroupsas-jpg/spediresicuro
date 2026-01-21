# ✅ Fase 4: Post-Deploy Checklist

**Data:** 2025-01-07  
**Status:** 📋 **DA VERIFICARE DOPO DEPLOY**

---

## 🚀 Deploy Status

- [x] **Commit su master:** ✅ Completato
  - `14e57b3` - Backend: getAllClientsForUser() e getSubUsers() aggiornato
  - `70930cc` - Frontend: vista gerarchica clienti per superadmin
  - `65b4bde` - Docs: report completo Fase 4

- [ ] **Deploy Vercel:** ⏳ In attesa (automatico dopo push)
  - Verifica: Vercel Dashboard → Deployments → Ultimo deployment su master
  - URL: https://spediresicuro.it (o `.vercel.app`)

---

## ✅ Checklist Post-Deploy

### 1. Verifica Deploy Vercel

- [ ] Vai su Vercel Dashboard → Deployments
- [ ] Verifica che ultimo deployment su `master` sia "Ready" e "Production"
- [ ] Controlla build logs per errori
- [ ] Verifica URL produzione: https://spediresicuro.it

### 2. Test Superadmin - Vista Gerarchica

- [ ] Login come superadmin su produzione
- [ ] Vai su `/dashboard/reseller-team`
- [ ] **Verifica:**
  - [ ] Vedi sezione "Reseller" con card expandable
  - [ ] Vedi sezione "BYOC" (se ci sono clienti BYOC)
  - [ ] Stats cards mostrano: Reseller, Sub-Users, BYOC, Wallet Totale
  - [ ] Click su ResellerCard → si espande mostrando Sub-Users nested
  - [ ] Sub-Users mostrano: nome, email, wallet, data registrazione
  - [ ] BYOC clients mostrati in sezione dedicata

### 3. Test Reseller - Vista Originale

- [ ] Login come reseller su produzione
- [ ] Vai su `/dashboard/reseller-team`
- [ ] **Verifica:**
  - [ ] Vedi vista originale (solo propri Sub-Users)
  - [ ] Stats cards mostrano: Clienti Totali, Wallet Totale, Spedizioni, Fatturato
  - [ ] Tabella Sub-Users funziona correttamente
  - [ ] Creazione nuovo Sub-User funziona (se permesso)

### 4. Test Access Control

- [ ] Login come user standard (non reseller, non superadmin)
- [ ] Vai su `/dashboard/reseller-team`
- [ ] **Verifica:**
  - [ ] Vedi messaggio "Accesso Negato" o redirect a dashboard

### 5. Test Performance

- [ ] Verifica tempi di caricamento pagina `/dashboard/reseller-team` (superadmin)
- [ ] Verifica che expand/collapse ResellerCard sia fluido
- [ ] Controlla console browser per errori JavaScript

### 6. Test Regressione

- [ ] Verifica che altre pagine dashboard funzionino correttamente
- [ ] Verifica che creazione spedizioni funzioni
- [ ] Verifica che gestione wallet funzioni
- [ ] Verifica che altre funzionalità reseller funzionino

---

## 🐛 Se Qualcosa Non Funziona

### Errore: "Solo Superadmin/Admin possono visualizzare tutti i clienti"

**Causa:** Capability `can_view_all_clients` non assegnata o `account_type` non è `superadmin`

**Fix:**

1. Verifica in Supabase che utente abbia `account_type = 'superadmin'`
2. Oppure assegna capability `can_view_all_clients`:
   ```sql
   INSERT INTO account_capabilities (user_id, capability_name, granted_by)
   SELECT id, 'can_view_all_clients', id
   FROM users
   WHERE account_type = 'superadmin'
   ON CONFLICT DO NOTHING;
   ```

### Errore: "Errore nel caricamento dei clienti"

**Causa:** Query database fallisce o RLS policy blocca accesso

**Fix:**

1. Controlla log Vercel per errore specifico
2. Verifica RLS policies su tabella `users`
3. Verifica che `supabaseAdmin` client abbia service role key configurata

### Errore: Vista non cambia (superadmin vede ancora vista reseller)

**Causa:** Cache React Query o verifica superadmin fallisce

**Fix:**

1. Hard refresh browser (Ctrl+Shift+R)
2. Verifica che `/api/user/info` restituisca `account_type: 'superadmin'`
3. Controlla console browser per errori fetch

---

## 📊 Metriche Successo

- ✅ Superadmin vede struttura gerarchica completa
- ✅ Reseller mantiene vista originale (non breaking)
- ✅ Performance: caricamento < 2 secondi
- ✅ Nessun errore console browser
- ✅ Nessuna regressione funzionalità esistenti

---

## ✅ Conclusione

Dopo aver completato tutti i test, segna come completato:

- [ ] **Deploy verificato:** ✅ / ❌
- [ ] **Test superadmin:** ✅ / ❌
- [ ] **Test reseller:** ✅ / ❌
- [ ] **Test access control:** ✅ / ❌
- [ ] **Test performance:** ✅ / ❌
- [ ] **Test regressione:** ✅ / ❌

**Status Finale:** ✅ **COMPLETATO** / ❌ **PROBLEMI RISCONTRATI**

**Note aggiuntive:**

```
[Spazio per note su eventuali problemi o osservazioni]
```
