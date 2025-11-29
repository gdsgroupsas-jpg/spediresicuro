# 🐛 Debug OAuth Google - Verifica Completa

## 🔍 Verifica Step-by-Step

### 1. Verifica Credenziali in .env.local

Esegui questo comando per verificare:

```powershell
Get-Content .env.local | Select-String "GOOGLE_CLIENT"
```

**Dovresti vedere:**
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**⚠️ IMPORTANTE:**
- Client ID deve terminare con **250** (numero), NON **25o** (lettera O)
- Nessuno spazio prima o dopo il `=`
- Nessuna virgoletta

### 2. Verifica in Google Cloud Console

#### A. Verifica Client ID e Secret

1. Vai su: **https://console.cloud.google.com/**
2. Progetto: **"spedire-sicuro-geocoding"**
3. **APIs & Services** → **Credentials**
4. Clicca sul tuo **OAuth 2.0 Client ID**
5. **Confronta:**
   - Client ID nella console = Client ID in `.env.local`?
   - Client Secret nella console = Client Secret in `.env.local`?

#### B. Verifica Callback URL (CRITICO!)

Nella stessa pagina del Client ID:

1. Scorri fino a **"Authorized redirect URIs"**
2. **DEVE contenere ESATTAMENTE:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
3. **Se non c'è o è diverso:**
   - Clicca **"+ ADD URI"**
   - Inserisci: `http://localhost:3000/api/auth/callback/google`
   - **Nessuno spazio, nessun carattere extra**
   - Clicca **"SAVE"**
   - ⚠️ **Aspetta 1-2 minuti** per la propagazione

#### C. Verifica Utente di Prova (CRITICO!)

1. **APIs & Services** → **OAuth consent screen**
2. Scorri fino a **"Test users"**
3. **VERIFICA che `gdsgroupsas@gmail.com` sia nella lista**
4. **Se NON c'è:**
   - Clicca **"+ ADD USERS"**
   - Inserisci: `gdsgroupsas@gmail.com`
   - Clicca **"ADD"**

### 3. Verifica Server

#### A. Porta Corretta

Il server deve essere su porta **3000**:

```bash
npm run dev
```

Dovresti vedere:
```
✓ Ready on http://localhost:3000
```

#### B. Variabili Ambiente Caricate

Verifica che NextAuth legga le variabili:

Aggiungi temporaneamente questo in `lib/auth-config.ts` (dopo la riga 54):

```typescript
console.log('Google OAuth Config:', {
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  clientIdLength: process.env.GOOGLE_CLIENT_ID?.length,
  clientIdEndsWith: process.env.GOOGLE_CLIENT_ID?.slice(-10),
  hasSecret: !!process.env.GOOGLE_CLIENT_SECRET,
});
```

Poi riavvia e controlla i log del server.

### 4. Verifica Browser

#### A. Console del Browser

1. Apri DevTools (F12)
2. Tab **"Console"**
3. Tab **"Network"**
4. Clicca "Continua con Google"
5. **Cerca errori** nella console
6. **Cerca la richiesta** a `accounts.google.com` nella tab Network
7. **Clicca sulla richiesta** e verifica:
   - URL completo
   - Parametri della richiesta
   - Risposta (se c'è)

#### B. URL di Redirect

Quando clicchi "Continua con Google", l'URL dovrebbe essere simile a:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=your-google-client-id.apps.googleusercontent.com&redirect_uri=http://localhost:3000/api/auth/callback/google&...
```

**Verifica:**
- `client_id` corrisponde al tuo Client ID?
- `redirect_uri` è `http://localhost:3000/api/auth/callback/google`?

### 5. Test Alternativo

#### Prova a Ricreare il Client OAuth

Se nulla funziona, prova a ricreare il Client OAuth:

1. In Google Cloud Console → **Credentials**
2. **Elimina** il Client ID esistente (se sicuro)
3. Crea nuovo **OAuth 2.0 Client ID**:
   - Tipo: **Web application**
   - Nome: "SpedireSicuro Local Dev"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copia nuovo Client ID e Secret
5. Aggiorna `.env.local`
6. Riavvia server

---

## 🆘 Checklist Finale

Prima di testare, verifica TUTTO:

- [ ] Client ID in `.env.local` termina con **250** (non 25o)
- [ ] Client ID in `.env.local` = Client ID in Google Cloud Console
- [ ] Client Secret in `.env.local` = Client Secret in Google Cloud Console
- [ ] Callback URL in Google Cloud Console: `http://localhost:3000/api/auth/callback/google`
- [ ] `gdsgroupsas@gmail.com` aggiunto come Test user
- [ ] `NEXTAUTH_URL=http://localhost:3000` in `.env.local`
- [ ] Server riavviato dopo modifiche
- [ ] Server in esecuzione su porta 3000
- [ ] Nessuno spazio o carattere extra nelle credenziali
- [ ] Aspettato 1-2 minuti dopo modifiche in Google Cloud Console

---

## 📋 Cosa Controllare nei Log

### Log del Server

Cerca errori come:
- `invalid_client`
- `redirect_uri_mismatch`
- `access_denied`

### Log del Browser

Cerca errori nella console JavaScript o nella tab Network.

---

**Ultimo aggiornamento:** Debug completo OAuth Google ✅



