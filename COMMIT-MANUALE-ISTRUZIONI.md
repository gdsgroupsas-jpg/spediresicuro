# ⚠️ COMMIT MANUALE NECESSARIO

## Problema
PowerShell non mostra output, quindi i comandi git non funzionano correttamente.

## Soluzione: Esegui questi comandi MANUALMENTE

### 1. Apri PowerShell o CMD nella cartella del progetto
```
cd d:\spediresicuro-master
```

### 2. Verifica modifiche
```
git status
```

### 3. Aggiungi tutti i file
```
git add -A
```

### 4. Verifica cosa verrà committato
```
git status
```

### 5. Crea commit
```
git commit -m "Fix: Script SQL 021 corretto sintassi RAISE NOTICE, date 2025, fix accountType completo"
```

### 6. Push su GitHub
```
git push origin master
```

### 7. Verifica che sia andato a buon fine
```
git log --oneline -1
```

---

## File che DOVREBBERO essere committati:

1. ✅ `supabase/migrations/021_verify_fix_account_type_config.sql`
   - Data: 6 Dicembre 2025 (non 2024)
   - RAISE NOTICE in blocco DO $$ ... END $$;

2. ✅ `components/dashboard-nav.tsx`
   - Fix caricamento accountType da data.user.account_type

3. ✅ `app/api/user/info/route.ts`
   - Logging migliorato

4. ✅ Altri file di debug/documentazione

---

## Se il push fallisce per autenticazione:

1. Vai su GitHub → Settings → Developer settings → Personal access tokens
2. Crea un nuovo token con permessi `repo`
3. Usa il token come password quando git chiede credenziali

OPPURE

Usa SSH invece di HTTPS:
```
git remote set-url origin git@github.com:gdsgroupsas-jpg/spediresicuro.git
```

---

**IMPORTANTE:** Dopo il commit, verifica che l'hash sia cambiato da `766a981` a un nuovo hash.
