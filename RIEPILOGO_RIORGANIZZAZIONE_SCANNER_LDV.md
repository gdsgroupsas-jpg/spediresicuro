# 📋 RIEPILOGO: Riorganizzazione Scanner LDV

## 🎯 OBIETTIVI RICHIESTO

1. ✅ **Spostare scanner dalla dashboard admin alla lista spedizioni**
2. ✅ **Creare killer feature a pagamento** per scanner LDV import
3. ✅ **Verifica duplicati LDV** prima di importare
4. ✅ **Importare spedizioni** invece di solo ritiro
5. ✅ **Possibilità di cancellare** singolo import
6. ✅ **Presente anche nella sezione resi** (futuro)
7. ✅ **Rimuovere da dashboard admin** (operativo, non serve lì)

---

## ✅ COMPLETATO

### 1. **Killer Feature SQL Migration**
- ✅ Creato `supabase/migrations/011_add_ldv_scanner_feature.sql`
- ✅ Feature `ldv_scanner_import` a pagamento
- ✅ Solo superadmin può concederla

### 2. **Rimosso da Dashboard Admin**
- ✅ Rimosso import ScannerLDV
- ✅ Rimosso pulsante scanner
- ✅ Rimosso modal scanner
- ✅ Rimosso stato `showScannerModal`

### 3. **Server Action Import LDV**
- ✅ Creato `actions/ldv-import.ts`
- ✅ Funzione `importShipmentFromLDV()` 
- ✅ Funzione `checkLDVDuplicate()` per verificare duplicati
- ✅ Verifica killer feature prima di importare
- ✅ Verifica duplicati LDV
- ✅ Crea spedizione in stato draft

---

## 🔄 DA COMPLETARE

### 1. **Componente ScannerLDVImport**
**File:** `components/ScannerLDVImport.tsx` (NUOVO)

**Funzionalità:**
- Scanner fotocamera per leggere LDV
- Verifica duplicati prima di importare
- Mostra warning se LDV già esiste
- Importa spedizione in stato draft
- Feedback visivo successo/errore

**Basato su:** `components/ScannerLDV.tsx`
**Modifiche rispetto a ScannerLDV:**
- Chiama `importShipmentFromLDV()` invece di `confirmPickupScan()`
- Verifica duplicati prima di importare
- Messaggio diverso: "Importa Spedizione" invece di "Ritiro"

### 2. **Aggiungere alla Lista Spedizioni**
**File:** `app/dashboard/spedizioni/page.tsx`

**Modifiche:**
- Aggiungere dynamic import per ScannerLDVImport
- Aggiungere pulsante "Importa via Scanner LDV"
- Verificare killer feature prima di mostrare pulsante
- Mostrare badge/messaggio se feature non attiva

### 3. **Aggiungere Cancellazione Import**
**File:** `app/dashboard/spedizioni/page.tsx`

**Modifiche:**
- Aggiungere pulsante "Elimina" per spedizioni importate via scanner
- Verificare `importSource === 'ldv_scanner'`
- Soft delete della spedizione

### 4. **Aggiungere alla Sezione Resi** (FUTURO)
- Quando implementata la pagina resi, aggiungere scanner anche lì

---

## 📝 NOTE TECNICHE

### Verifica Killer Feature

Prima di mostrare lo scanner, verificare:
```typescript
const hasFeature = await fetch('/api/features/check?feature=ldv_scanner_import')
```

Se non ha la feature:
- Nascondere pulsante scanner
- Oppure mostrare pulsante disabilitato con tooltip "Feature a pagamento"

### Verifica Duplicati

La Server Action `checkLDVDuplicate()` verifica:
- LDV nel campo `ldv`
- LDV nel campo `tracking_number`
- Esclude spedizioni cancellate (`deleted = false`)

### Import Spedizione

Quando importata via scanner:
- Stato: `draft` (mancano dati completi)
- Flag: `imported = true`
- Source: `importSource = 'ldv_scanner'`
- LDV salvata nel campo `ldv`
- Tracking generato automaticamente

---

## 🚀 PROSSIMI PASSI

1. **Creare componente ScannerLDVImport**
2. **Aggiungere alla lista spedizioni**
3. **Aggiungere verifica killer feature**
4. **Testare import e verifica duplicati**
5. **Aggiungere cancellazione import**

---

## 📋 FILE DA CREARE/MODIFICARE

### Nuovi File:
- ✅ `supabase/migrations/011_add_ldv_scanner_feature.sql`
- ✅ `actions/ldv-import.ts`
- ⏳ `components/ScannerLDVImport.tsx` (da creare)

### File Modificati:
- ✅ `app/dashboard/admin/page.tsx` (rimosso scanner)
- ⏳ `app/dashboard/spedizioni/page.tsx` (aggiungere scanner)

---

## ⚠️ IMPORTANTE

1. **Eseguire migration SQL** `011_add_ldv_scanner_feature.sql` su Supabase
2. **Attivare feature per utenti** tramite superadmin
3. **Testare verifica duplicati** prima di completare
4. **Ottimizzare performance** (già fatto con dynamic import)


