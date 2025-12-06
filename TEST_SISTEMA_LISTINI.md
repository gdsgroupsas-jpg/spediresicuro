# 🧪 Guida Test Sistema Listini Avanzato

## 📋 Checklist Pre-Test

### 1. Database
- [ ] Esegui migration: `supabase/migrations/020_advanced_price_lists_system.sql`
- [ ] Verifica che le colonne siano state aggiunte:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'price_lists' 
  AND column_name IN ('rules', 'priority', 'is_global', 'assigned_to_user_id');
  ```

### 2. Variabili d'Ambiente
- [ ] Verifica `.env.local` con credenziali Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

### 3. Dipendenze
- [ ] `npm install` eseguito
- [ ] Verifica `xlsx` installato per parsing Excel

## 🚀 Test in Locale

### 1. Avvia Server di Sviluppo
```bash
npm run dev
```

### 2. Test Dashboard Listini

**URL:** `http://localhost:3000/dashboard/listini`

**Cosa verificare:**
- ✅ Pagina carica senza errori
- ✅ Statistiche mostrate correttamente
- ✅ Filtri funzionano
- ✅ Ricerca funziona
- ✅ Tabella listini renderizzata

### 3. Test Creazione Listino

**Passi:**
1. Clicca "Nuovo Listino"
2. Compila form base
3. Aggiungi regole PriceRule
4. Salva

**Verifica:**
- ✅ Listino creato nel database
- ✅ Regole salvate in JSONB
- ✅ Redirect a lista listini

### 4. Test Caricamento Tariffe

**File di test CSV:**
```csv
weight_from,weight_to,base_price,zone_code
0,1,5.00,Z1
1,5,8.00,Z1
5,10,12.00,Z1
```

**Passi:**
1. Vai su dettaglio listino
2. Tab "Carica Tariffe"
3. Trascina file CSV
4. Verifica parsing

**Verifica:**
- ✅ File accettato
- ✅ Dati parsati correttamente
- ✅ Messaggio successo con numero righe

### 5. Test Calcolo Prezzi

**API Test:**
```bash
POST /api/price-lists/calculate
{
  "weight": 2.5,
  "destination": {
    "zip": "20100",
    "province": "MI"
  },
  "courierId": "courier-id",
  "serviceType": "standard"
}
```

**Verifica:**
- ✅ Listino applicabile trovato
- ✅ Regole matchano correttamente
- ✅ Prezzo calcolato: base + sovrapprezzi + margine
- ✅ Audit trail completo

### 6. Test Editor Regole

**Passi:**
1. Vai su dettaglio listino
2. Tab "Regole"
3. Clicca "Modifica"
4. Aggiungi nuova regola
5. Configura condizioni
6. Salva

**Verifica:**
- ✅ Regola aggiunta
- ✅ Campi salvati correttamente
- ✅ Priorità rispettata

### 7. Test Assegnazione Listino

**Passi:**
1. Dashboard Super Admin
2. Seleziona utente
3. Assegna listino
4. Verifica `assigned_price_list_id` su users

**Verifica:**
- ✅ Listino assegnato
- ✅ Utente vede listino come predefinito
- ✅ Calcolo usa listino assegnato

## 🔍 Verifica Funzionalità

### Matching Regole
Testa che le regole matchano correttamente:

```typescript
// Regola 1: Peso 0-5kg, Zona Z1, Margine 10%
// Regola 2: Peso 5-10kg, Zona Z1, Margine 15%
// Regola 3: Peso 0-10kg, Zona Z2, Margine 20%

// Test 1: 3kg, Z1 → Deve matchare Regola 1
// Test 2: 7kg, Z1 → Deve matchare Regola 2
// Test 3: 3kg, Z2 → Deve matchare Regola 3
```

### Gerarchia Listini
Testa priorità:

```typescript
// Utente con assigned_price_list_id → Deve usare quello
// Utente senza → Deve usare listino globale
// Nessuno → Deve usare default
```

### Calcolo Prezzi
Verifica calcolo:

```typescript
// Base: 10€
// Sovrapprezzo carburante: 5% = 0.50€
// Margine: 10% = 1.05€
// Totale: 11.55€
```

## 🐛 Troubleshooting

### Errore: "Listino non trovato"
- Verifica che migration sia stata eseguita
- Controlla che listino esista nel database

### Errore: "Regole non valide"
- Verifica formato JSONB
- Controlla che `rules` sia array di oggetti PriceRule

### Errore: "Calcolo fallito"
- Verifica che listino abbia regole o margine default
- Controlla condizioni matching (peso, zona, ecc.)

### Errore: "Upload file fallito"
- Verifica dimensione file (< 10MB)
- Controlla formato supportato
- Verifica permessi cartella uploads/

## ✅ Checklist Finale

- [ ] Migration eseguita
- [ ] Dashboard listini funziona
- [ ] Creazione listino funziona
- [ ] Editor regole funziona
- [ ] Upload CSV funziona
- [ ] Upload Excel funziona
- [ ] Calcolo prezzi funziona
- [ ] Assegnazione listino funziona
- [ ] Audit trail tracciato
- [ ] Nessun errore console
- [ ] Nessun errore TypeScript

## 🎉 Quando Tutto Funziona

Se tutti i test passano:
1. ✅ Sistema listini avanzato operativo
2. ✅ Calcolo prezzi dinamico funzionante
3. ✅ Dashboard completa e moderna
4. ✅ Caricamento tariffe funzionante
5. ✅ Audit trail completo

**Pronto per produzione!** 🚀
