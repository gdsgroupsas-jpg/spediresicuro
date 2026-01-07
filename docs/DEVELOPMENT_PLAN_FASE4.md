# 🚀 Development Plan - Fase 4: Gestione Clienti UI

**Data:** 2025-01-XX  
**Priorità:** 🔴 **ALTA**  
**Status:** 📋 **PIANIFICATO**

---

## 🎯 Obiettivo

Creare sezione **"Gestione Clienti"** unificata che mostri:
- **Superadmin/Admin:** Tutti i clienti in modo gerarchico (Reseller → Sub-Users, BYOC standalone)
- **Reseller:** Solo i propri Sub-Users (comportamento attuale)

**Problema attuale:** Superadmin vede tutti gli utenti ma in modo "piatto", non gerarchico.

---

## 📋 Analisi Situazione Attuale

### Pagine Esistenti

1. **`/dashboard/reseller-team`** (Reseller)
   - ✅ Mostra solo sub-users del reseller corrente
   - ✅ Funziona correttamente
   - ❌ Non accessibile a superadmin per vedere tutti i clienti

2. **`/dashboard/super-admin`** (Superadmin)
   - ✅ Mostra tutti gli utenti
   - ❌ Vista "piatta" (non gerarchica)
   - ❌ Non mostra relazione Reseller → Sub-Users

### Problema Identificato

- Superadmin non può vedere struttura gerarchica completa
- Manca vista unificata per "Gestione Clienti"
- `/dashboard/reseller-team` non supporta superadmin

---

## 🏗️ Soluzione Proposta

### Opzione A: Estendere `/dashboard/reseller-team` (Consigliato)

**Vantaggi:**
- ✅ Riutilizza codice esistente
- ✅ Unica pagina per tutti (superadmin + reseller)
- ✅ Meno duplicazione

**Implementazione:**
1. Modificare `getSubUsers()` per supportare superadmin
2. Creare `getAllClientsHierarchical()` per superadmin
3. Aggiornare UI per mostrare gerarchia quando superadmin
4. Mantenere comportamento attuale per reseller

### Opzione B: Creare nuova pagina `/dashboard/clients` (Alternativa)

**Vantaggi:**
- ✅ Separazione netta
- ✅ Non tocca codice esistente

**Svantaggi:**
- ❌ Duplicazione codice
- ❌ Due pagine simili

**Raccomandazione:** ✅ **Opzione A** (estendere esistente)

---

## 📝 Piano di Sviluppo

### Step 1: Backend - Funzione `getAllClientsForUser()`

**File:** `actions/admin-reseller.ts` (nuova funzione)

```typescript
export async function getAllClientsForUser(): Promise<{
  success: boolean;
  clients?: ClientHierarchy[];
  error?: string;
}>

interface ClientHierarchy {
  reseller: User;
  subUsers: User[];
  totalSubUsers: number;
  totalWalletBalance: number;
}

interface BYOCClient {
  user: User;
  type: 'byoc';
}
```

**Logica:**
- Se superadmin → restituisce tutti i reseller con sub-users + BYOC
- Se reseller → restituisce solo i suoi sub-users (comportamento attuale)

### Step 2: Backend - Aggiornare `getSubUsers()`

**File:** `actions/admin-reseller.ts`

- Aggiungere supporto superadmin
- Se superadmin → chiama `getAllClientsForUser()`
- Se reseller → comportamento attuale

### Step 3: Frontend - Componente Gerarchico

**File:** `app/dashboard/reseller-team/_components/clients-hierarchy-view.tsx` (NUOVO)

- Vista gerarchica per superadmin
- Mostra Reseller → Sub-Users nested
- Mostra BYOC standalone
- Expand/collapse per reseller

### Step 4: Frontend - Aggiornare Page

**File:** `app/dashboard/reseller-team/page.tsx`

- Rilevare se superadmin o reseller
- Mostrare vista gerarchica se superadmin
- Mostrare vista attuale se reseller

### Step 5: Test e Verifica

- Test superadmin vede tutti i clienti
- Test reseller vede solo sub-users
- Test gerarchia corretta
- Test regressioni

---

## 🔧 Dettagli Implementazione

### 1. Query Database per Superadmin

```sql
-- Recupera tutti i reseller con sub-users
SELECT 
  r.id as reseller_id,
  r.email as reseller_email,
  r.name as reseller_name,
  COUNT(su.id) as sub_users_count,
  COALESCE(SUM(su.wallet_balance), 0) as total_wallet
FROM users r
LEFT JOIN users su ON su.parent_id = r.id AND su.is_reseller = false
WHERE r.is_reseller = true
GROUP BY r.id, r.email, r.name
ORDER BY r.created_at DESC;

-- Recupera tutti i BYOC
SELECT id, email, name, wallet_balance, created_at
FROM users
WHERE account_type = 'byoc'
ORDER BY created_at DESC;
```

### 2. Struttura Dati

```typescript
interface ClientsData {
  resellers: Array<{
    reseller: User;
    subUsers: User[];
    stats: {
      totalSubUsers: number;
      totalWalletBalance: number;
      totalShipments: number;
    };
  }>;
  byocClients: User[];
  stats: {
    totalResellers: number;
    totalSubUsers: number;
    totalBYOC: number;
    totalWalletBalance: number;
  };
}
```

### 3. UI Component

```typescript
<ClientsHierarchyView>
  {/* Resellers Section */}
  {resellers.map(reseller => (
    <ResellerCard key={reseller.id} expandable>
      <ResellerHeader reseller={reseller} />
      <SubUsersList subUsers={reseller.subUsers} />
    </ResellerCard>
  ))}
  
  {/* BYOC Section */}
  <BYOCSection clients={byocClients} />
</ClientsHierarchyView>
```

---

## ✅ Checklist Implementazione

### Backend
- [ ] Creare `getAllClientsForUser()` in `actions/admin-reseller.ts`
- [ ] Aggiornare `getSubUsers()` per supportare superadmin
- [ ] Creare query SQL ottimizzata
- [ ] Test backend con superadmin
- [ ] Test backend con reseller (regressione)

### Frontend
- [ ] Creare `ClientsHierarchyView` component
- [ ] Creare `ResellerCard` component (expandable)
- [ ] Creare `BYOCSection` component
- [ ] Aggiornare `reseller-team/page.tsx`
- [ ] Aggiornare access control (superadmin + reseller)

### Testing
- [ ] Test superadmin vede tutti i clienti
- [ ] Test reseller vede solo sub-users
- [ ] Test gerarchia corretta
- [ ] Test regressioni
- [ ] Test performance (query ottimizzate)

---

## 🚀 Ordine di Esecuzione

1. **Backend First** (testabile via API)
   - Step 1: `getAllClientsForUser()`
   - Step 2: Aggiornare `getSubUsers()`

2. **Frontend Second** (dopo backend testato)
   - Step 3: Componenti UI
   - Step 4: Integrazione page

3. **Testing Finale**
   - Step 5: Test completi

---

## ⚠️ Note Importanti

1. **Non Breaking:** Mantenere comportamento attuale per reseller
2. **Performance:** Query ottimizzate con JOIN e aggregazioni
3. **RLS:** Verificare che RLS policies permettano superadmin di vedere tutto
4. **Capability:** Usare `can_view_all_clients` per controllo accesso

---

## 📊 Stima Tempo

- **Backend:** ~2-3 ore
- **Frontend:** ~3-4 ore
- **Testing:** ~1-2 ore
- **Totale:** ~6-9 ore

---

**Status:** 📋 **PRONTO PER SVILUPPO**

**Prossimo Step:** Iniziare con Step 1 (Backend - `getAllClientsForUser()`)
