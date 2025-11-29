# ⚡ Setup OAuth Rapido - Comando Unico

## 🚀 Metodo Veloce (Script Interattivo)

Ho creato uno script che ti guida passo-passo nella configurazione!

### Esegui questo comando:

```bash
npm run setup:oauth
```

Lo script ti chiederà:
1. Se vuoi configurare Google OAuth
2. Se vuoi configurare GitHub OAuth
3. Ti guiderà nell'inserimento delle credenziali
4. Aggiornerà automaticamente `.env.local`

---

## 📋 Metodo Manuale (Se Preferisci)

### Passo 1: Ottieni Credenziali Google

1. Vai su: **https://console.cloud.google.com/**
2. Crea OAuth 2.0 Client ID (tipo Web application)
3. **Callback URL:** `http://localhost:3001/api/auth/callback/google`
4. Copia Client ID e Client Secret

### Passo 2: Ottieni Credenziali GitHub

1. Vai su: **https://github.com/settings/developers**
2. Crea nuova OAuth App
3. **Callback URL:** `http://localhost:3001/api/auth/callback/github`
4. Copia Client ID e Client Secret

### Passo 3: Aggiorna .env.local

Apri `.env.local` e sostituisci:

```env
# ❌ SOSTITUISCI QUESTI
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ✅ CON I TUOI VALORI REALI
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678
```

### Passo 4: Riavvia il Server

```bash
npm run dev
```

---

## 💡 Nota Importante

**Le credenziali OAuth sono OPCZIONALI!**

Se non vuoi configurarle ora, l'app funziona comunque con:
- ✅ Login/Registrazione email/password
- ✅ Credenziali demo: `admin@spediresicuro.it` / `admin123`

---

## 🆘 Serve Aiuto?

Vedi le guide complete:
- `GUIDA_CONFIGURAZIONE_OAUTH.md` - Guida dettagliata
- `PROBLEMI_OAUTH_E_SOLUZIONI.md` - Risoluzione problemi



