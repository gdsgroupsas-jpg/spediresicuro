# 🔧 Fix Definitivo OAuth Google - Errore 401 invalid_client

## 🔴 PROBLEMA ATTUALE

Errore visualizzato:
- **Errore 401: invalid_client**
- **"The OAuth client was not found"**
- **flowName=GeneralOAuthFlow**

## ✅ SOLUZIONE PASSO-PASSO

### Passo 1: Verifica Credenziali in .env.local

Apri `.env.local` e verifica che contenga:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:3000
```

**⚠️ IMPORTANTE:** 
- Nessuno spazio prima o dopo il `=`
- Nessuna virgoletta intorno ai valori
- Porta corretta (3000, non 3001)

### Passo 2: Verifica in Google Cloud Console

#### 2.1 Vai su Google Cloud Console
1. Apri: **https://console.cloud.google.com/**
2. Seleziona progetto: **"spedire-sicuro-geocoding"**

#### 2.2 Verifica OAuth Client ID
1. Menu → **APIs & Services** → **Credentials**
2. Clicca sul tuo **OAuth 2.0 Client ID**
3. **VERIFICA che il Client ID corrisponda:**
   ```
   345930037956-4jor1tdut2tfqksjmdq81e4qte4kl250.apps.googleusercontent.com
   ```
4. **VERIFICA che il Client Secret corrisponda:**
   ```
   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
   ```

#### 2.3 Configura Callback URL (CRITICO!)
1. Nella stessa pagina del Client ID, scorri fino a **"Authorized redirect URIs"**
2. **DEVE contenere ESATTAMENTE:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
3. **Se non c'è o è diverso:**
   - Clicca **"+ ADD URI"**
   - Inserisci: `http://localhost:3000/api/auth/callback/google`
   - **Nessuno spazio, nessun carattere extra**
   - Clicca **"SAVE"**

#### 2.4 Aggiungi Utente di Prova (CRITICO!)
1. Menu → **APIs & Services** → **OAuth consent screen**
2. Scorri fino a **"Test users"**
3. **VERIFICA che `gdsgroupsas@gmail.com` sia nella lista**
4. **Se NON c'è:**
   - Clicca **"+ ADD USERS"**
   - Inserisci: `gdsgroupsas@gmail.com`
   - Clicca **"ADD"**

### Passo 3: Verifica Tipo di App OAuth

1. In **OAuth consent screen**, verifica:
   - **User Type:** "External" (per testing)
   - **Publishing status:** "Testing" (OK per sviluppo)
   
2. Se è in "Testing", **SOLO gli utenti di prova** possono accedere

### Passo 4: Riavvia il Server

Dopo ogni modifica:

```bash
# Ferma il server (Ctrl+C)
# Riavvia
npm run dev
```

### Passo 5: Test Completo

1. Vai su: `http://localhost:3000/login`
2. Clicca "Continua con Google"
3. **Se vedi ancora errore:**
   - Apri la console del browser (F12)
   - Controlla eventuali errori
   - Verifica che il redirect URL sia corretto

---

## 🐛 Troubleshooting Avanzato

### Errore persiste dopo tutte le verifiche?

#### Opzione 1: Ricrea OAuth Client (se necessario)

1. In Google Cloud Console → **Credentials**
2. **Elimina** il Client ID esistente (se sicuro)
3. Crea nuovo **OAuth 2.0 Client ID**:
   - Tipo: **Web application**
   - Nome: "SpedireSicuro Local"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copia nuovo Client ID e Secret
5. Aggiorna `.env.local`
6. Riavvia server

#### Opzione 2: Verifica che non ci siano spazi/caratteri extra

```bash
# Verifica .env.local
Get-Content .env.local | Select-String "GOOGLE_CLIENT"
```

Dovresti vedere:
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**NON deve essere:**
```
GOOGLE_CLIENT_ID = "your-google-client-id..."
GOOGLE_CLIENT_ID=your-google-client-id... (con spazi)
```

#### Opzione 3: Verifica Porta del Server

Assicurati che il server sia effettivamente su porta 3000:

```bash
# Controlla output del server
npm run dev
```

Dovresti vedere:
```
✓ Ready on http://localhost:3000
```

Se è su porta 3001, aggiorna tutto di conseguenza.

---

## ✅ Checklist Finale

Prima di testare, verifica TUTTO:

- [ ] `GOOGLE_CLIENT_ID` in `.env.local` corrisponde a Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` in `.env.local` corrisponde a Google Cloud Console
- [ ] `NEXTAUTH_URL=http://localhost:3000` in `.env.local`
- [ ] Callback URL in Google Cloud Console: `http://localhost:3000/api/auth/callback/google`
- [ ] `gdsgroupsas@gmail.com` aggiunto come Test user
- [ ] Nessuno spazio o carattere extra nelle credenziali
- [ ] Server riavviato dopo modifiche
- [ ] Server in esecuzione su porta 3000

---

## 🆘 Se Nulla Funziona

1. **Verifica log del server:**
   - Controlla eventuali errori nella console del server
   - Cerca messaggi relativi a OAuth

2. **Verifica log del browser:**
   - Apri DevTools (F12)
   - Tab "Console" e "Network"
   - Cerca errori durante il click su "Continua con Google"

3. **Test con account diverso:**
   - Se possibile, prova con un altro account Google
   - Verifica che sia nella lista Test users

---

**Ultimo aggiornamento:** Fix definitivo errore 401 invalid_client ✅



