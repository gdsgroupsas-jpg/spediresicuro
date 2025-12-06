# 🔍 Analisi e Miglioramento Prompt Gemini

## 📋 CONTESTO

Prompt di Gemini per implementare:
1. Gerarchia Multi-Livello Admin
2. OCR/Barcode per Resi

**Analisi**: Cosa è già stato fatto vs cosa chiede il prompt

---

## ✅ COSA È GIÀ STATO FATTO

### 1. **Database Model** ✅
- ✅ **Campo `parent_admin_id`** già aggiunto in `users` (non `profiles`)
- ✅ **Campo `account_type`** (user/admin/superadmin) già aggiunto
- ✅ **Campo `admin_level`** (0-5) già aggiunto
- ✅ **Killer feature `multi_level_admin`** già creata
- ✅ **Funzioni SQL** per gerarchia già create:
  - `get_all_sub_admins()`
  - `can_create_sub_admin()`
  - `get_admin_level()`

### 2. **Sistema Registrazione** ✅
- ✅ Form registrazione con scelta account_type
- ✅ API registrazione aggiornata
- ✅ Funzione createUser aggiornata

---

## ⚠️ DIFFERENZE TRA PROMPT E REALTÀ

### **Problema 1: Struttura Database**
- **Prompt dice**: `profiles` con campo `parent_user_id`
- **Realtà**: Esiste `users` con campo `parent_admin_id` (già fatto!)
- **Soluzione**: Il prompt va adattato per usare `users` e `parent_admin_id`

### **Problema 2: Nome Campo**
- **Prompt dice**: `parent_user_id`
- **Realtà**: `parent_admin_id` (più specifico, già fatto)
- **Soluzione**: Usare `parent_admin_id` nel prompt

### **Problema 3: RLS Policies**
- **Prompt dice**: Aggiornare RLS per gerarchia
- **Realtà**: RLS esiste ma non gestisce gerarchia
- **Soluzione**: Implementare RLS per gerarchia o usare filtri lato codice

### **Problema 4: Ruolo Sub-Admin**
- **Prompt dice**: Creare utente con `role = 'sub_admin'`
- **Realtà**: Usiamo `account_type = 'admin'` con `parent_admin_id`
- **Soluzione**: Non serve `sub_admin`, usare gerarchia con `parent_admin_id`

---

## 🎯 COSA MANCA E DA IMPLEMENTARE

### **A. Sistema Gerarchia Admin**

#### ✅ Già Fatto:
- [x] Campi database (`parent_admin_id`, `account_type`, `admin_level`)
- [x] Funzioni SQL gerarchia
- [x] Killer feature `multi_level_admin`

#### ❌ Da Fare:
1. **Server Action `createSubAdmin`**
   - Creare `actions/admin.ts`
   - Funzione per invitare/creare sotto-admin
   - Verificare permessi e profondità gerarchica

2. **Pagina Team Management**
   - Creare `/app/dashboard/team/page.tsx`
   - Lista sotto-admin
   - Statistiche aggregate
   - Invito nuovi sotto-admin

3. **RLS Policies Aggiornate**
   - Filtrare spedizioni per gerarchia
   - Implementare con funzioni SQL o filtri lato codice

4. **Query Filtrate per Gerarchia**
   - Modificare query spedizioni per includere sotto-admin
   - Usare funzione `get_all_sub_admins()` per ottenere ID

---

### **B. OCR/Barcode per Resi**

#### ✅ Già Fatto:
- [x] Scanner LDV esistente (`components/ScannerLDV.tsx`)
- [x] Sistema OCR esistente (Google Vision, Claude, Tesseract)
- [x] Tabella `shipments` con struttura completa

#### ❌ Da Fare:
1. **Campi Resi in Database**
   - Aggiungere `is_return`, `original_shipment_id`, `return_reason`, `return_status`
   - Migration SQL

2. **Tipi TypeScript**
   - Aggiornare `types/shipments.ts`
   - Aggiungere campi resi

3. **Componente ReturnScanner**
   - Basato su `ScannerLDV.tsx`
   - Modificato per resi

4. **Server Action `processReturnScan`**
   - Cerca spedizione originale
   - Crea nuova spedizione reso
   - Aggiorna stato originale

5. **UI Resi**
   - Pulsante "Registra Reso" in dashboard
   - Lista resi gestiti

---

## 🔧 MIGLIORAMENTI AL PROMPT

### **Miglioramento 1: Allineare con Struttura Esistente**

```diff
- Crea una Server Action `actions/admin.ts` chiamata `createSubAdmin(childEmail: string, parentId: string)`
+ Crea una Server Action `actions/admin.ts` chiamata `createSubAdmin(childEmail: string, parentEmail: string)`
+ Usa la tabella `users` (non `profiles`)
+ Usa il campo `parent_admin_id` (già esistente)
+ Verifica che parent abbia killer feature `multi_level_admin` attiva
+ Verifica profondità gerarchica ≤ 5 usando funzione SQL `can_create_sub_admin()`
```

### **Miglioramento 2: Integrare con Sistema Killer Features**

```diff
- Verificare che l'utente chiamante abbia il permesso (es. `role` non 'user')
+ Verificare che l'utente chiamante:
+   1. Abbia `account_type = 'admin'` o `account_type = 'superadmin'`
+   2. Abbia killer feature `multi_level_admin` attiva (tramite `user_has_feature()`)
+   3. Superadmin può sempre creare admin di livello 1
```

### **Miglioramento 3: Allineare Campi Resi**

```diff
- Aggiorna `Spedizione` per includere:
-   - `is_return`: boolean
-   - `original_shipment_id`: string
-   - `return_reason`: string
-   - `return_status`: 'requested' | 'processing' | 'completed'
+ Aggiorna `types/shipments.ts` (non `types/index.ts`) per includere:
+   - `is_return?: boolean`
+   - `original_shipment_id?: string` (UUID o tracking)
+   - `return_reason?: string`
+   - `return_status?: 'requested' | 'processing' | 'completed' | 'cancelled'`
+   - Usa migration SQL per aggiungere campi alla tabella `shipments`
```

### **Miglioramento 4: RLS Gerarchia**

```diff
- Aggiorna Policy RLS per consentire SELECT di spedizioni discendenti
+ Opzione A: RLS con funzione ricorsiva (complesso)
+ Opzione B: Filtro lato codice usando funzione SQL `get_all_sub_admins()`
+ Scegliere Opzione B (più pratico):
+   - Nelle query spedizioni, ottenere tutti gli ID discendenti
+   - Filtrare `shipments.user_id IN (parent_id, ...descendant_ids)`
```

---

## 📝 PROMPT MIGLIORATO

Vedi file `PROMPT_MIGLIORATO_GEMINI.md` per versione completa migliorata.

---

## ✅ CHECKLIST IMPLEMENTAZIONE

### **Gerarchia Admin:**
- [x] Campi database aggiunti
- [x] Funzioni SQL create
- [x] Killer feature creata
- [ ] Server Action `createSubAdmin` (da fare)
- [ ] Pagina `/dashboard/team/page.tsx` (da fare)
- [ ] Query filtrate per gerarchia (da fare)
- [ ] RLS policies aggiornate (da fare - opzionale)

### **OCR Resi:**
- [x] Scanner LDV esistente (base)
- [x] Sistema OCR esistente
- [ ] Campi resi in database (da fare)
- [ ] Tipi TypeScript aggiornati (da fare)
- [ ] Componente `ReturnScanner.tsx` (da fare)
- [ ] Server Action `processReturnScan` (da fare)
- [ ] UI resi (da fare)

---

## 🚀 PROSSIMO PASSO

Creare versione migliorata del prompt e implementare le parti mancanti.




