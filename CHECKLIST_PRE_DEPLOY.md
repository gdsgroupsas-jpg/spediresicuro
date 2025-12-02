# ⚠️ CHECKLIST: Prima di Testare sul Web

## ❌ COSA NON FUNZIONA ANCORA

Ho creato tutto il codice, ma **devi ancora fare questi passaggi** perché funzioni sul web:

---

## 🔴 STEP 1: Eseguire Migration SQL (OBBLIGATORIO)

### Migration Resi
**File:** `supabase/migrations/010_add_return_fields.sql`

**Come fare:**
1. Vai su **Supabase Dashboard** (https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **SQL Editor** (menu laterale)
4. Clicca **"New query"**
5. Copia e incolla tutto il contenuto di `supabase/migrations/010_add_return_fields.sql`
6. Clicca **"Run"** (o premi Ctrl+Enter)

**Verifica:**
```sql
-- Esegui questa query per verificare che i campi siano stati aggiunti:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name IN ('is_return', 'original_shipment_id', 'return_reason', 'return_status');
```

**Dovresti vedere 4 righe con i campi aggiunti.**

---

## 🔴 STEP 2: Verificare Funzioni SQL Gerarchia

Le funzioni per la gerarchia admin dovrebbero esistere già dalla migration 008, ma verifichiamole:

**Verifica funzioni SQL:**
```sql
-- Esegui in Supabase SQL Editor:

-- 1. Verifica se esiste get_all_sub_admins
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'get_all_sub_admins';

-- 2. Verifica se esiste can_create_sub_admin
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'can_create_sub_admin';
```

**Se NON esistono:**
- Esegui `supabase/migrations/008_admin_user_system.sql` completo
- Questo file aggiunge tutte le funzioni necessarie per la gerarchia

---

## 🔴 STEP 3: Installare Dipendenze (se non già fatto)

**Controlla se `@zxing/library` è installato:**
```bash
npm list @zxing/library
```

**Se NON è installato:**
```bash
npm install @zxing/library
```

---

## 🔴 STEP 4: Verificare Configurazione Auth

**Verifica che NextAuth sia configurato:**
- Controlla che esista `.env.local` con le variabili necessarie
- Verifica che `NEXTAUTH_SECRET` sia impostato
- Verifica che `NEXTAUTH_URL` sia impostato

---

## 🔴 STEP 5: Testare le Funzionalità

### Test 1: Pagina Team Management
1. Avvia il server: `npm run dev`
2. Vai su `http://localhost:3000/dashboard/team`
3. **Se vedi errore "Accesso negato":**
   - Verifica di essere loggato come admin
   - Verifica che il tuo account abbia `account_type = 'admin'` nel database

### Test 2: Creare Sotto-Admin
1. Vai su `/dashboard/team`
2. Clicca "Invita Nuovo Sub-Admin"
3. **Se vedi errore sulla killer feature:**
   - Devi attivare la killer feature `multi_level_admin` per il tuo account admin
   - O usare un account superadmin (che può sempre creare)

### Test 3: Scanner Resi
1. Vai su `/dashboard/spedizioni`
2. Clicca "Registra Reso"
3. **Se vedi errore sulla fotocamera:**
   - Il browser deve permettere l'accesso alla fotocamera
   - Usa HTTPS o localhost (non funziona su HTTP normale)

---

## 🟡 PROBLEMI COMUNI E SOLUZIONI

### Problema 1: "Errore: funzione get_all_sub_admins non esiste"

**Soluzione:**
```sql
-- Esegui questa query per creare la funzione:

CREATE OR REPLACE FUNCTION get_all_sub_admins(
  p_admin_id UUID,
  p_max_level INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  account_type account_type,
  admin_level INTEGER,
  parent_admin_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE admin_tree AS (
    SELECT u.id, u.email, u.name, u.account_type, u.admin_level, u.parent_admin_id
    FROM users u
    WHERE u.parent_admin_id = p_admin_id
    AND u.admin_level <= p_max_level
    AND u.admin_level > 0
    UNION ALL
    SELECT u.id, u.email, u.name, u.account_type, u.admin_level, u.parent_admin_id
    FROM users u
    JOIN admin_tree at ON u.parent_admin_id = at.id
    WHERE u.admin_level <= p_max_level
    AND u.admin_level > 0
  )
  SELECT * FROM admin_tree WHERE id != p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Problema 2: "Errore: can_create_sub_admin non esiste"

**Soluzione:**
Esegui l'intera migration `008_admin_user_system.sql` - contiene tutte le funzioni necessarie.

### Problema 3: "Accesso negato alla fotocamera"

**Soluzione:**
- Usa HTTPS (o localhost che è considerato sicuro)
- Permetti l'accesso alla fotocamera quando il browser lo chiede
- Verifica che il browser supporti `getUserMedia`

### Problema 4: "Killer feature multi_level_admin non attiva"

**Soluzione:**
- Se sei superadmin, puoi sempre creare admin (non serve la feature)
- Altrimenti, attiva la feature per il tuo account admin:
  ```sql
  -- Verifica killer feature
  SELECT id, code, name 
  FROM killer_features 
  WHERE code = 'multi_level_admin';
  
  -- Attiva per il tuo account (sostituisci EMAIL)
  INSERT INTO user_features (user_email, feature_id, is_active, activation_type)
  SELECT 'tuo_email@example.com', kf.id, TRUE, 'admin_grant'
  FROM killer_features kf
  WHERE kf.code = 'multi_level_admin'
  ON CONFLICT (user_email, feature_id) 
  DO UPDATE SET is_active = TRUE;
  ```

---

## ✅ CHECKLIST FINALE

Prima di dire "funziona sul web", verifica:

- [ ] Migration `010_add_return_fields.sql` eseguita su Supabase
- [ ] Campi resi verificati nella tabella `shipments`
- [ ] Funzioni SQL gerarchia esistenti (`get_all_sub_admins`, `can_create_sub_admin`)
- [ ] Dipendenza `@zxing/library` installata (`npm install`)
- [ ] Server Next.js avviato (`npm run dev`)
- [ ] Accesso admin verificato (account_type = 'admin')
- [ ] Killer feature `multi_level_admin` attiva (o sei superadmin)
- [ ] Test pagina team management (`/dashboard/team`)
- [ ] Test scanner resi (`/dashboard/spedizioni` → "Registra Reso")

---

## 🚨 SE VEDI ERRORI

1. **Apri la Console del Browser** (F12 → Console)
   - Cerca errori in rosso
   - Copiali e dimmeli

2. **Controlla i Log del Server** (terminal dove hai fatto `npm run dev`)
   - Cerca errori
   - Copiali e dimmeli

3. **Controlla Network Tab** (F12 → Network)
   - Vedi se ci sono richieste fallite
   - Controlla le risposte delle API

---

## 📞 PROSSIMI PASSI

Dopo aver fatto tutti questi step, **testa** e dimmi:
1. ✅ Cosa funziona
2. ❌ Cosa non funziona (con messaggio errore esatto)
3. 🔍 Cosa vedi nella console del browser

Così posso aiutarti a risolvere i problemi specifici!

