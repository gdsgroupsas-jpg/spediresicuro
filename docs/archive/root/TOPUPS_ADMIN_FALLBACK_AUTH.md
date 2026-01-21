# 📋 Fallback auth.users per TopUpRequests Admin

**Data:** 2025-01  
**File:** `app/actions/topups-admin.ts`  
**Modifica:** Arricchimento dati utente con fallback a `auth.users`

---

## 🎯 OBIETTIVO

Mostrare sempre email/nome utente nella pagina `/dashboard/admin/bonifici`, anche se l'utente non esiste in `public.users`.

**Problema:** `top_up_requests.user_id` fa riferimento a `auth.users(id)`, non a `public.users(id)`. Se un utente esiste solo in `auth.users`, non riusciamo a recuperare email/nome.

**Soluzione:** Fallback a `supabaseAdmin.auth.admin.getUserById()` quando email/nome mancano in `public.users`.

---

## 📝 MODIFICHE IMPLEMENTATE

### 1. Cache Locale

```typescript
const cache = new Map<string, { email: string | null; name: string | null }>();
```

**Scopo:** Evitare chiamate duplicate a `getUserById` per lo stesso `user_id` nella stessa query.

### 2. Flusso di Recupero Dati Utente

**Step 1:** Recupera da `public.users`

```typescript
const { data: users } = await supabaseAdmin
  .from('users')
  .select('id, email, name')
  .in('id', userIds);
```

**Step 2:** Per ogni richiesta, se email/nome mancano:

```typescript
// Controlla cache
if (cache.has(req.user_id)) {
  // Usa dati cached
} else {
  // Controlla usersMap (da public.users)
  if (userFromPublic) {
    // Usa dati da public.users
  } else {
    // Fallback: recupera da auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.user_id);
    userEmail = authUser.user.email || null;
    userName = authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || null;
  }
}
```

### 3. Gestione Errori

```typescript
try {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
    req.user_id
  );
  // ...
} catch (authErr: any) {
  // Se fallisce, lascia null (non rompere la pagina)
  console.warn(`Errore recupero auth user ${req.user_id}:`, authErr.message);
}
```

**Comportamento:** Se `getUserById` fallisce, `user_email` e `user_name` restano `null`. La pagina continua a funzionare mostrando `user_id` come fallback.

---

## 🔍 DIFF COMPLETO

### Funzione `getTopUpRequestsAdmin()`

**PRIMA:**

```typescript
// 6. Recupera dati utenti dalla tabella users pubblica
const usersMap = new Map<string, { email: string | null; name: string | null }>();

if (userIds.length > 0) {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, name')
    .in('id', userIds);

  if (!usersError && users) {
    users.forEach((user: any) => {
      usersMap.set(user.id, {
        email: user.email || null,
        name: user.name || null,
      });
    });
  }
}

// 7. Trasforma dati
const requests: TopUpRequestAdmin[] = (data || []).map((req: any) => {
  const user = usersMap.get(req.user_id) || { email: null, name: null };
  return {
    // ...
    user_email: user.email,
    user_name: user.name,
  };
});
```

**DOPO:**

```typescript
// 5. Cache per evitare chiamate duplicate
const cache = new Map<string, { email: string | null; name: string | null }>();

// 6. Recupera dati utenti dalla tabella users pubblica
const usersMap = new Map<string, { email: string | null; name: string | null }>();

if (userIds.length > 0) {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, name')
    .in('id', userIds);

  if (!usersError && users) {
    users.forEach((user: any) => {
      const userData = {
        email: user.email || null,
        name: user.name || null,
      };
      usersMap.set(user.id, userData);
      cache.set(user.id, userData); // Salva in cache
    });
  }
}

// 7. Per ogni richiesta, se email/nome mancano, recupera da auth.users
const requests: TopUpRequestAdmin[] = await Promise.all(
  (data || []).map(async (req: any) => {
    let userEmail: string | null = null;
    let userName: string | null = null;

    // Controlla cache prima
    if (cache.has(req.user_id)) {
      const cached = cache.get(req.user_id)!;
      userEmail = cached.email;
      userName = cached.name;
    } else {
      // Controlla usersMap (da public.users)
      const userFromPublic = usersMap.get(req.user_id);
      if (userFromPublic) {
        userEmail = userFromPublic.email;
        userName = userFromPublic.name;
        cache.set(req.user_id, { email: userEmail, name: userName });
      } else {
        // Fallback: recupera da auth.users
        try {
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
            req.user_id
          );

          if (!authError && authUser?.user) {
            userEmail = authUser.user.email || null;
            userName =
              authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || null;

            // Salva in cache
            cache.set(req.user_id, { email: userEmail, name: userName });
          }
        } catch (authErr: any) {
          // Se fallisce, lascia null (non rompere la pagina)
          console.warn(`Errore recupero auth user ${req.user_id}:`, authErr.message);
        }
      }
    }

    return {
      // ...
      user_email: userEmail,
      user_name: userName,
    };
  })
);
```

### Funzione `getTopUpRequestAdmin()`

**PRIMA:**

```typescript
// 3. Recupera dati utente dalla tabella users pubblica
let userEmail: string | null = null;
let userName: string | null = null;

const { data: user } = await supabaseAdmin
  .from('users')
  .select('email, name')
  .eq('id', data.user_id)
  .single();

if (!userError && user) {
  userEmail = user.email || null;
  userName = user.name || null;
}
```

**DOPO:**

```typescript
// 3. Recupera dati utente dalla tabella users pubblica
let userEmail: string | null = null;
let userName: string | null = null;

const { data: user } = await supabaseAdmin
  .from('users')
  .select('email, name')
  .eq('id', data.user_id)
  .single();

if (!userError && user) {
  userEmail = user.email || null;
  userName = user.name || null;
}

// 4. Se email/nome mancano, recupera da auth.users
if (!userEmail && !userName) {
  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id
    );

    if (!authError && authUser?.user) {
      userEmail = authUser.user.email || null;
      userName =
        authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || null;
    }
  } catch (authErr: any) {
    // Se fallisce, lascia null (non rompere la pagina)
    console.warn(`Errore recupero auth user ${data.user_id}:`, authErr.message);
  }
}
```

---

## ✅ VANTAGGI

1. **Copertura Completa:** Mostra email/nome anche per utenti che esistono solo in `auth.users`
2. **Performance:** Cache locale evita chiamate duplicate nella stessa query
3. **Robustezza:** Gestione errori senza rompere la pagina
4. **Fallback Graceful:** Se `getUserById` fallisce, mostra `user_id` come fallback

---

## 🧪 TEST MANUALE

### Test: Utente Solo in auth.users

**Prerequisiti:**

1. Utente che esiste in `auth.users` ma NON in `public.users`
2. Richiesta `top_up_requests` creata da questo utente

**Passi:**

1. Accedi come admin
2. Vai su `/dashboard/admin/bonifici`
3. Verifica che la richiesta appaia nella lista
4. Verifica che email/nome siano visibili (non `null`)

**Risultato atteso:**

- ✅ Richiesta visibile nella lista
- ✅ Email utente visibile (da `auth.users`)
- ✅ Nome utente visibile (da `user_metadata.full_name` o `user_metadata.name`, se disponibile)
- ✅ Se nome non disponibile, mostra email o `user_id` come fallback

**Query verifica:**

**Opzione 1: Query unica (consigliata)**

```sql
-- Crea top_up_request per il primo utente in auth.users che non è in public.users
INSERT INTO top_up_requests (user_id, amount, file_url, status)
SELECT
  au.id,
  100.00,
  'https://example.com/test.jpg',
  'pending'
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users WHERE id IS NOT NULL)
LIMIT 1;
```

**Opzione 2: Query in due step**

```sql
-- Step 1: Trova utente in auth.users ma non in public.users
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users WHERE id IS NOT NULL)
LIMIT 1;

-- Step 2: Copia l'UUID risultante dalla query sopra (es. '123e4567-e89b-12d3-a456-426614174000')
-- e sostituiscilo nella query qui sotto (NON copiare '<user_id>' letteralmente!)
INSERT INTO top_up_requests (user_id, amount, file_url, status)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- ⚠️ SOSTITUISCI con UUID reale dalla query sopra
  100.00,
  'https://example.com/test.jpg',
  'pending'
);
```

**Nota:** Se non ci sono utenti in `auth.users` che non sono in `public.users`, puoi creare un utente di test:

```sql
-- Crea utente di test in auth.users (via Supabase Dashboard → Authentication → Users → Add User)
-- Poi usa l'UUID generato nella query INSERT sopra
```

**Verifica UI:**

- Apri `/dashboard/admin/bonifici`
- La richiesta deve mostrare email (non `null`)
- Se `user_metadata` contiene `full_name` o `name`, deve essere visibile

---

## ⚠️ NOTE TECNICHE

1. **Cache Locale:** La cache è locale alla funzione, quindi non persiste tra chiamate diverse. Va bene così, l'importante è evitare chiamate duplicate nella stessa query.

2. **user_metadata:** Il nome viene recuperato da `user_metadata.full_name` o `user_metadata.name`. Se entrambi sono `null`, il nome sarà `null` e la UI mostrerà solo email o `user_id`.

3. **Performance:** `getUserById` viene chiamato solo se email/nome mancano in `public.users`. Per utenti esistenti in `public.users`, nessuna chiamata aggiuntiva.

4. **Error Handling:** Se `getUserById` fallisce (es. utente eliminato da `auth.users`), `user_email` e `user_name` restano `null`. La pagina continua a funzionare mostrando `user_id` come fallback.

---

**Fine Documento**
