# 🚫 GUIDA ANTI-DUPLICATI - SpedireSicuro.it

> **Obiettivo**: Evitare errori build Vercel e problemi di codice duplicato

---

## ❌ ERRORI COMUNI

### 1. Duplicare Funzioni tra File

**❌ SBAGLIATO:**
```typescript
// app/actions/topups-admin.ts
export async function approveTopUpRequest() { ... }

// app/actions/wallet.ts
export async function approveTopUpRequest() { ... } // DUPLICATO!
```

**Errore Build Vercel:**
```
Type error: Module '"@/app/actions/topups-admin"' has no exported member 'approveTopUpRequest'.
```

**✅ CORRETTO:**
```typescript
// app/actions/wallet.ts (UNICO LUOGO)
export async function approveTopUpRequest() { ... }

// app/actions/topups-admin.ts (NON contiene approveTopUpRequest)
// Solo funzioni di lettura: getTopUpRequestsAdmin, getTopUpRequestAdmin
```

---

## 📁 STRUTTURA FILE CORRETTA

### Server Actions Wallet/Top-Up

#### `app/actions/wallet.ts`
**Contiene SOLO funzioni di modifica:**
- ✅ `approveTopUpRequest(requestId, approvedAmount?)`
- ✅ `rejectTopUpRequest(requestId, reason)`
- ✅ `deleteTopUpRequest(requestId)`
- ✅ `initiateCardRecharge(amount)`
- ✅ `uploadBankTransferReceipt(file, amount)`

**NON contiene:**
- ❌ Funzioni di lettura admin (`getTopUpRequestsAdmin`, `getTopUpRequestAdmin`)

#### `app/actions/topups-admin.ts`
**Contiene SOLO funzioni di lettura:**
- ✅ `getTopUpRequestsAdmin({ status, search, limit, offset })`
- ✅ `getTopUpRequestAdmin(id)`
- ✅ `verifyAdminAccess()`

**NON contiene:**
- ❌ Funzioni di modifica (`approveTopUpRequest`, `rejectTopUpRequest`, `deleteTopUpRequest`)

---

## 🔍 CHECKLIST PRE-COMMIT

Prima di fare commit, verifica:

### 1. Import Corretti nella UI

**File**: `app/dashboard/admin/bonifici/page.tsx`

**✅ CORRETTO:**
```typescript
import { getTopUpRequestsAdmin, getTopUpRequestAdmin } from '@/app/actions/topups-admin';
import { approveTopUpRequest, rejectTopUpRequest, deleteTopUpRequest } from '@/app/actions/wallet';
```

**❌ SBAGLIATO:**
```typescript
import { 
  getTopUpRequestsAdmin, 
  approveTopUpRequest,  // ❌ Non esiste qui!
  rejectTopUpRequest   // ❌ Non esiste qui!
} from '@/app/actions/topups-admin';
```

### 2. Nessun Merge Conflict Marker

**Cerca nel codice:**
```bash
grep -r "<<<<<<< HEAD" app/
grep -r "=======" app/
grep -r ">>>>>>>" app/
```

**Se trovi questi marker:**
1. Risolvi manualmente il conflitto
2. Rimuovi tutti i marker (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Verifica che il codice risultante sia corretto

### 3. Nessuna Funzione Duplicata

**Cerca duplicati:**
```bash
# Cerca approveTopUpRequest in entrambi i file
grep -n "approveTopUpRequest" app/actions/wallet.ts
grep -n "approveTopUpRequest" app/actions/topups-admin.ts

# Se esiste in entrambi → ERRORE! Rimuovi da topups-admin.ts
```

---

## 🛠️ FIX RAPIDO

### Se hai già committato codice duplicato:

1. **Identifica il file corretto:**
   - `approveTopUpRequest` → `app/actions/wallet.ts`
   - `getTopUpRequestsAdmin` → `app/actions/topups-admin.ts`

2. **Rimuovi duplicato:**
   ```bash
   # Apri il file sbagliato
   # Rimuovi la funzione duplicata
   # Salva
   ```

3. **Verifica import nella UI:**
   ```bash
   # Cerca tutti gli import
   grep -r "from '@/app/actions/topups-admin'" app/
   grep -r "from '@/app/actions/wallet'" app/
   ```

4. **Test build locale:**
   ```bash
   npm run build
   # Se compila → OK
   # Se errore → controlla import
   ```

---

## 📋 REGOLE D'ORO

1. **Una funzione = Un solo file**
   - Se una funzione esiste già, NON crearla in un altro file
   - Cerca prima con `grep` o `codebase_search`

2. **Separazione Lettura/Modifica**
   - Lettura admin → `topups-admin.ts`
   - Modifica wallet → `wallet.ts`

3. **Verifica Build Prima di Push**
   ```bash
   npm run build
   # Se fallisce → FIX prima di push
   ```

4. **Nessun Merge Conflict Marker**
   - Se vedi `<<<<<<<`, `=======`, `>>>>>>>` → RISOLVI SUBITO
   - Non committare mai con marker non risolti

---

## 🚨 ERRORI COMUNI VERCEL BUILD

### Errore 1: "Module has no exported member"

**Causa**: Import da file sbagliato

**Fix**: Verifica che la funzione esista nel file da cui la importi

### Errore 2: "stream did not contain valid UTF-8"

**Causa**: Merge conflict marker non risolti (`<<<<<<<`, `=======`, `>>>>>>>`)

**Fix**: Rimuovi tutti i marker e risolvi il conflitto

### Errore 3: "Type error: Cannot find module"

**Causa**: Path import errato o file non esiste

**Fix**: Verifica path e che il file esista

---

## ✅ CHECKLIST FINALE

Prima di push su `master`:

- [ ] `npm run build` compila senza errori
- [ ] Nessun merge conflict marker nel codice
- [ ] Nessuna funzione duplicata tra `wallet.ts` e `topups-admin.ts`
- [ ] Import corretti nella UI (`bonifici/page.tsx`)
- [ ] TypeScript non segnala errori
- [ ] ESLint warnings accettabili (non errori critici)

---

**Ultimo aggiornamento**: Gennaio 2025  
**Versione**: 1.0.0

