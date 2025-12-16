# 🧪 Guida Test Locale - Sistema Configurazioni Corrieri

## ✅ Checklist Pre-Test

### 1. Verifica Setup Base
```bash
# Verifica variabili ambiente
npm run check:env:simple

# Verifica TypeScript
npm run type-check

# Verifica Supabase
npm run verify:supabase
```

### 2. Verifica Migration Database
Assicurati che la migration `010_courier_configs_system.sql` sia stata eseguita:
- ✅ Tabella `courier_configs` creata
- ✅ Colonna `assigned_config_id` aggiunta a `users`
- ✅ Policy RLS configurate
- ✅ Unique index per default config creato

**Verifica rapida:**
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM courier_configs;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'assigned_config_id';
```

---

## 🚀 Setup Test Locale

### 1. Avvia Server di Sviluppo
```bash
npm run dev
```

L'applicazione sarà disponibile su: **http://localhost:3000**

### 2. Login come Admin
1. Vai su `http://localhost:3000/login`
2. Accedi con un account admin
3. Verifica che il ruolo sia `admin` nel database

---

## 📋 Test Step-by-Step

### Test 1: Creare Prima Configurazione

1. **Vai alla Dashboard Admin:**
   ```
   http://localhost:3000/dashboard/admin/configurations
   ```

2. **Clicca "Nuova Configurazione"**

3. **Compila il form:**
   - **Nome**: `Configurazione Test Locale`
   - **Provider**: `Spedisci.Online`
   - **API Key**: Inserisci una chiave API valida (o di test)
   - **Base URL**: `https://ecommerceitalia.spedisci.online/api/v2`
   - **Mapping Contratti**: 
     - Servizio: `poste` → Codice: `TEST123`
     - Servizio: `gls` → Codice: `TEST456`
   - **Default**: ✅ Spunta se vuoi usarla come fallback
   - **Attiva**: ✅ Spunta

4. **Clicca "Salva"**

5. **Verifica:**
   - ✅ La configurazione appare nella lista
   - ✅ Badge "Default" visibile (se impostata)
   - ✅ Badge "Attiva" visibile

### Test 2: Verifica Configurazione nel Database

```sql
-- In Supabase SQL Editor
SELECT 
  id,
  name,
  provider_id,
  is_active,
  is_default,
  created_at
FROM courier_configs
ORDER BY created_at DESC;
```

Dovresti vedere la configurazione appena creata.

### Test 3: Creare Spedizione (Usa Config DB)

1. **Vai a creare spedizione:**
   ```
   http://localhost:3000/dashboard/spedizioni/nuova
   ```

2. **Compila i dati spedizione**

3. **Scegli corriere** (es. Spedisci.Online)

4. **Crea spedizione**

5. **Verifica nei log:**
   - Apri la console del browser (F12)
   - Cerca messaggi tipo: `✅ Configurazione DB trovata` o `⚠️ Configurazione DB non trovata, uso fallback env`

### Test 4: Test Fallback a Variabili d'Ambiente

1. **Disattiva tutte le configurazioni nel DB:**
   ```sql
   UPDATE courier_configs SET is_active = false;
   ```

2. **Crea una nuova spedizione**

3. **Verifica:**
   - Il sistema dovrebbe usare le variabili d'ambiente come fallback
   - Controlla i log per conferma

4. **Riattiva la configurazione:**
   ```sql
   UPDATE courier_configs SET is_active = true WHERE name = 'Configurazione Test Locale';
   ```

### Test 5: Assegnare Configurazione a Utente Specifico

1. **Ottieni ID configurazione:**
   ```sql
   SELECT id, name FROM courier_configs WHERE name = 'Configurazione Test Locale';
   ```

2. **Assegna a utente:**
   ```sql
   UPDATE users 
   SET assigned_config_id = 'UUID-CONFIG-QUI'
   WHERE email = 'tuo-email@example.com';
   ```

3. **Crea spedizione con quell'utente**

4. **Verifica:**
   - Il sistema usa la configurazione assegnata
   - Controlla i log per conferma

### Test 6: Generazione LDV Interna

1. **Crea una spedizione** (o usa una esistente)

2. **Ottieni ID spedizione**

3. **Testa generazione LDV interna:**
   ```typescript
   // In browser console o componente React
   const response = await fetch('/api/test/ldv-internal', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       shipmentId: 'ID-SPEDIZIONE-QUI',
       format: 'pdf' 
     })
   });
   
   const blob = await response.blob();
   const url = URL.createObjectURL(blob);
   window.open(url);
   ```

   Oppure crea un pulsante temporaneo nella pagina spedizioni per testare.

---

## 🐛 Troubleshooting

### Errore: "Accesso negato" nella pagina configurazioni

**Soluzione:**
1. Verifica che l'utente sia admin:
   ```sql
   SELECT email, role FROM users WHERE email = 'tuo-email@example.com';
   ```
2. Se non è admin, aggiorna:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'tuo-email@example.com';
   ```

### Errore: "Configurazione non trovata" durante creazione spedizione

**Soluzione:**
1. Verifica che esista una config default:
   ```sql
   SELECT * FROM courier_configs WHERE is_default = true AND is_active = true;
   ```
2. Se non esiste, crea una o imposta una come default

### Errore: "Provider non disponibile"

**Soluzione:**
1. Verifica che la factory supporti il provider
2. Controlla `lib/couriers/factory.ts`
3. Verifica che le credenziali siano valide

### LDV interna non genera

**Soluzione:**
1. Verifica che la spedizione esista
2. Controlla che l'utente abbia accesso
3. Verifica che i dati spedizione siano completi
4. Controlla i log del server

---

## 📊 Verifica Funzionamento

### Log da Controllare

**Console Browser (F12):**
- `✅ Configurazione DB trovata per utente: ...`
- `⚠️ Configurazione DB non trovata, uso fallback env`
- `✅ Provider istanziato con successo`

**Server Logs:**
- `✅ Configurazione creata: ...`
- `✅ Provider recuperato tramite factory`
- `✅ LDV interna generata: ...`

### Query di Verifica

```sql
-- Verifica configurazioni
SELECT 
  name,
  provider_id,
  is_active,
  is_default,
  created_at
FROM courier_configs
ORDER BY created_at DESC;

-- Verifica utenti con config assegnata
SELECT 
  u.email,
  u.role,
  cc.name as config_name
FROM users u
LEFT JOIN courier_configs cc ON u.assigned_config_id = cc.id
WHERE u.assigned_config_id IS NOT NULL;

-- Verifica policy RLS
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'courier_configs';
```

---

## ✅ Checklist Test Completati

- [ ] Configurazione creata nella dashboard admin
- [ ] Configurazione visibile nella lista
- [ ] Spedizione creata usando config DB
- [ ] Fallback a env funziona
- [ ] Assegnazione utente funziona
- [ ] LDV interna genera correttamente
- [ ] Policy RLS funzionano (solo admin può modificare)
- [ ] Unique index previene doppie default

---

## 🎯 Test Avanzati (Opzionali)

### Test Multi-Configurazione
1. Crea 2 configurazioni per lo stesso provider
2. Imposta una come default
3. Assegna l'altra a un utente specifico
4. Verifica che l'utente usi la sua config, gli altri la default

### Test Performance
1. Crea 10+ configurazioni
2. Verifica che le query siano veloci
3. Controlla gli indici nel database

### Test Sicurezza
1. Prova ad accedere a `/dashboard/admin/configurations` con utente non-admin
2. Verifica che venga negato l'accesso
3. Prova a modificare config tramite API senza essere admin

---

**Buon testing! 🚀**

