# 🔄 Ricrea Utenti Demo in Supabase

## 🎯 Situazione

Hai cancellato tutti gli utenti in Supabase e devi ricrearli.

## ✅ Soluzione Rapida: Usa l'Endpoint API

### Metodo 1: Usa cURL (Terminale)

Apri un terminale e esegui:

**Locale:**
```bash
curl -X POST http://localhost:3000/api/test/create-admin-user
```

**Vercel (Produzione):**
```bash
curl -X POST https://spediresicuro.vercel.app/api/test/create-admin-user
```

### Metodo 2: Usa il Browser (Semplice)

1. **Apri il browser**
2. **Vai su:**
   ```
   http://localhost:3000/api/test/create-admin-user
   ```
   (locale) oppure
   ```
   https://spediresicuro.vercel.app/api/test/create-admin-user
   ```
   (Vercel)

3. **Vedrai** un JSON con le informazioni degli utenti esistenti

4. **Per crearli**, usa un'estensione del browser come "REST Client" o "Thunder Client" per fare una richiesta POST

### Metodo 3: Usa Postman o Thunder Client

1. **Apri Postman o Thunder Client**
2. **Crea una nuova richiesta POST**
3. **URL:**
   ```
   http://localhost:3000/api/test/create-admin-user
   ```
4. **Metodo:** POST
5. **Invia la richiesta**

Dovresti ricevere una risposta tipo:
```json
{
  "success": true,
  "message": "Inizializzazione completata: 2 utenti creati, 0 già esistenti",
  "adminUser": {
    "id": "...",
    "email": "admin@spediresicuro.it",
    "name": "Admin",
    "role": "admin"
  },
  "stats": {
    "created": 2,
    "skipped": 0
  }
}
```

---

## ✅ Metodo Alternativo: Crea Manualmente in Supabase

Se l'endpoint API non funziona, puoi crearli manualmente:

### Passo 1: Accedi a Supabase

1. Vai su: https://supabase.com/dashboard
2. Seleziona il tuo progetto

### Passo 2: Vai alla Tabella Users

1. Menu laterale → **Table Editor**
2. Clicca su **users**

### Passo 3: Crea Utente Admin

1. Clicca su **Insert row** (o **Aggiungi riga**)
2. Compila i campi:
   - `id`: Lascia vuoto (si genera automaticamente) oppure usa `1`
   - `email`: `admin@spediresicuro.it`
   - `password`: `admin123`
   - `name`: `Admin`
   - `role`: `admin`
   - `provider`: Lascia vuoto
   - `provider_id`: Lascia vuoto
   - `image`: Lascia vuoto
   - `created_at`: Lascia vuoto (si crea automaticamente)
   - `updated_at`: Lascia vuoto (si crea automaticamente)
3. Clicca **Save**

### Passo 4: Crea Utente Demo

1. Clicca di nuovo su **Insert row**
2. Compila i campi:
   - `id`: Lascia vuoto oppure usa `2`
   - `email`: `demo@spediresicuro.it`
   - `password`: `demo123`
   - `name`: `Demo User`
   - `role`: `user`
   - `provider`: Lascia vuoto
   - `provider_id`: Lascia vuoto
   - `image`: Lascia vuoto
   - `created_at`: Lascia vuoto
   - `updated_at`: Lascia vuoto
3. Clicca **Save**

---

## ✅ Verifica che Funzioni

Dopo aver creato gli utenti:

1. Vai su `/login`
2. Prova a fare login con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. Dovrebbe funzionare! 🎉

---

## 📋 Utenti da Creare

### Utente Admin
- **Email:** `admin@spediresicuro.it`
- **Password:** `admin123`
- **Nome:** `Admin`
- **Ruolo:** `admin`

### Utente Demo
- **Email:** `demo@spediresicuro.it`
- **Password:** `demo123`
- **Nome:** `Demo User`
- **Ruolo:** `user`

---

## ❌ Se Non Funziona

### Problema: Endpoint API non risponde

**Soluzione:**
1. Verifica che il server sia avviato (`npm run dev`)
2. Verifica che l'URL sia corretto
3. Controlla la console del browser per errori

### Problema: Errore creazione utente

**Soluzione:**
1. Verifica che Supabase sia configurato correttamente
2. Verifica che la tabella `users` esista
3. Crea gli utenti manualmente in Supabase Dashboard

---

**Nota**: L'endpoint API crea automaticamente entrambi gli utenti (admin e demo) in una sola chiamata!

