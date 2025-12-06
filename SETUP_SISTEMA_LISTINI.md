# 🚀 Setup Sistema Listini Avanzato

## 📦 Installazione Dipendenze

```bash
# Installa xlsx per parsing Excel (se non già presente)
npm install xlsx

# Verifica installazione
npm list xlsx
```

## 🗄️ Database Setup

### 1. Esegui Migration

**Opzione A: Supabase Dashboard**
1. Vai su Supabase Dashboard → SQL Editor
2. Copia contenuto di `supabase/migrations/020_advanced_price_lists_system.sql`
3. Esegui script

**Opzione B: CLI Supabase**
```bash
supabase db push
```

### 2. Verifica Migration

```bash
npm run verify:reseller-wallet
```

Oppure verifica manuale:
```sql
-- Verifica colonne aggiunte
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'price_lists' 
AND column_name IN ('rules', 'priority', 'is_global', 'assigned_to_user_id', 'default_margin_percent');

-- Verifica funzione
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'get_applicable_price_list';
```

## 🎯 Primi Passi

### 1. Crea Listino Globale (Admin)

1. Vai su `/dashboard/listini`
2. Clicca "Nuovo Listino"
3. Compila:
   - Nome: "Listino Default 2025"
   - Versione: "v1.0"
   - Priorità: "global"
   - Margine default: 10%
4. Aggiungi regole base
5. Salva

### 2. Test Calcolo Prezzi

Usa l'API o il calcolatore nella dashboard per testare:
- Peso: 2.5 kg
- Destinazione: Milano (20100)
- Corriere: qualsiasi
- Servizio: standard

### 3. Assegna Listino a Utente

1. Dashboard Super Admin
2. Seleziona utente
3. Assegna listino creato
4. Verifica che utente veda listino come predefinito

## 📝 Note Importanti

- I listini globali sono visibili a tutti
- I listini assegnati hanno priorità più alta
- Le regole con priorità più alta vengono applicate per prime
- Il sistema usa automaticamente `getApplicablePriceList()` per ogni spedizione

## 🔧 Configurazione Avanzata

### Caricamento Automatico Tariffe

Per abilitare OCR completo:
1. Installa Tesseract.js: `npm install tesseract.js`
2. Configura Google Vision (opzionale)
3. Aggiorna funzioni `parsePDF()` e `parseImageOCR()`

### Performance

- Indici JSONB su `rules` per query rapide
- Cache listini applicabili (opzionale)
- Lazy loading regole complesse

## ✅ Checklist Setup

- [ ] Dipendenze installate (`xlsx`)
- [ ] Migration eseguita
- [ ] Funzione `get_applicable_price_list` creata
- [ ] RLS policies attive
- [ ] Test creazione listino OK
- [ ] Test calcolo prezzi OK
- [ ] Dashboard accessibile

---

**Pronto per l'uso!** 🎉
