# 🔐 Guida Setup OAuth - SpedireSicuro.it

Guida completa per configurare l'autenticazione OAuth con Google, GitHub e Facebook.

## 📋 Provider Supportati

- ✅ **Google OAuth**
- ✅ **GitHub OAuth**
- ✅ **Facebook OAuth**

## 🚀 Setup Google OAuth

### 1. Crea un Progetto Google Cloud

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Vai su **APIs & Services** → **Credentials**

### 2. Crea OAuth 2.0 Client ID

1. Clicca su **Create Credentials** → **OAuth client ID**
2. Se richiesto, configura la schermata di consenso OAuth
3. Tipo applicazione: **Web application**
4. Nome: `SpedireSicuro`
5. **Authorized JavaScript origins:**
   - Sviluppo: `http://localhost:3000`
   - Produzione: `https://yourdomain.com`
6. **Authorized redirect URIs:**
   - Sviluppo: `http://localhost:3000/api/auth/callback/google`
   - Produzione: `https://yourdomain.com/api/auth/callback/google`
7. Clicca **Create**
8. **Copia Client ID e Client Secret**

### 3. Configura Variabili Ambiente

Aggiungi al file `.env.local`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## 🐙 Setup GitHub OAuth

### 1. Crea OAuth App su GitHub

1. Vai su [GitHub Developer Settings](https://github.com/settings/developers)
2. Clicca **New OAuth App**
3. Compila il form:
   - **Application name:** `SpedireSicuro`
   - **Homepage URL:**
     - Sviluppo: `http://localhost:3000`
     - Produzione: `https://yourdomain.com`
   - **Authorization callback URL:**
     - Sviluppo: `http://localhost:3000/api/auth/callback/github`
     - Produzione: `https://yourdomain.com/api/auth/callback/github`
4. Clicca **Register application**
5. **Copia Client ID e Client Secret**

### 2. Configura Variabili Ambiente

Aggiungi al file `.env.local`:

```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## 📘 Setup Facebook OAuth

### 1. Crea App Facebook

1. Vai su [Facebook Developers](https://developers.facebook.com/)
2. Clicca **My Apps** → **Create App**
3. Seleziona **Consumer** come tipo di app
4. Compila nome app e email di contatto
5. Clicca **Create App**

### 2. Configura Facebook Login

1. Nel dashboard app, aggiungi **Facebook Login**
2. Seleziona **Web** come piattaforma
3. Configura **Settings** → **Basic**:
   - **App Domains:**
     - Sviluppo: `localhost`
     - Produzione: `yourdomain.com`
   - **Site URL:**
     - Sviluppo: `http://localhost:3000`
     - Produzione: `https://yourdomain.com`
4. In **Facebook Login** → **Settings**:
   - **Valid OAuth Redirect URIs:**
     - Sviluppo: `http://localhost:3000/api/auth/callback/facebook`
     - Produzione: `https://yourdomain.com/api/auth/callback/facebook`
5. **Copia App ID e App Secret** da **Settings** → **Basic**

### 3. Configura Variabili Ambiente

Aggiungi al file `.env.local`:

```env
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
```

---

## ✅ Verifica Configurazione

### 1. Riavvia il Server

```bash
npm run dev
```

### 2. Testa i Provider

1. Vai su `http://localhost:3000/login`
2. Dovresti vedere i pulsanti OAuth
3. Clicca su un provider per testare

### 3. Controlla Errori

Se un provider non funziona:

- Verifica che le variabili ambiente siano corrette
- Controlla i callback URL nei provider
- Verifica che il server sia riavviato dopo aver aggiunto le variabili

---

## 🔒 Sicurezza

### Best Practices

1. **Non committare mai** `.env.local` nel repository
2. **Usa variabili ambiente diverse** per sviluppo e produzione
3. **Limita i callback URL** solo ai domini autorizzati
4. **Rigenera le chiavi** se compromesse

### Produzione

Per produzione, configura:

- Variabili ambiente su Vercel/piattaforma hosting
- Callback URL con il dominio di produzione
- HTTPS obbligatorio per OAuth

---

## 🐛 Troubleshooting

### "OAuth account not linked"

- Verifica che l'email OAuth corrisponda a un account esistente
- Il sistema crea automaticamente account per nuovi utenti OAuth

### "Invalid redirect URI"

- Verifica che il callback URL sia esattamente come configurato nel provider
- Controlla che non ci siano spazi o caratteri extra

### Provider non visibile

- Se un provider non è configurato, il pulsante non viene mostrato
- Verifica le variabili ambiente

---

## 📚 Risorse

- [NextAuth.js OAuth Docs](https://next-auth.js.org/providers/)
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Docs](https://docs.github.com/en/apps/oauth-apps)
- [Facebook OAuth Docs](https://developers.facebook.com/docs/facebook-login)

---

**Ultimo aggiornamento:** Sistema OAuth completo con Google, GitHub e Facebook ✅
