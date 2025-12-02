# 🔐 Configurazione Google OAuth per Vercel (Produzione)

Guida passo-passo per far funzionare Google OAuth su Vercel quando funziona in locale.

## ⚠️ Problema Comune

Google OAuth funziona in locale ma non online perché:
1. **Redirect URI non configurato** nella Google Console per l'URL di produzione
2. **Variabili d'ambiente non configurate** su Vercel
3. **NEXTAUTH_URL non configurato** correttamente

## 📋 Passo 1: Configura Google Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il tuo progetto
3. Vai su **APIs & Services** → **Credentials**
4. Clicca sul tuo **OAuth 2.0 Client ID**
5. Nella sezione **Authorized redirect URIs**, aggiungi:
   ```
   https://TUO-DOMINIO-VERCEL.vercel.app/api/auth/callback/google
   ```
   Esempio:
   ```
   https://spediresicuro.vercel.app/api/auth/callback/google
   ```
6. Nella sezione **Authorized JavaScript origins**, aggiungi:
   ```
   https://TUO-DOMINIO-VERCEL.vercel.app
   ```
7. Clicca **Save**

## 📋 Passo 2: Configura Variabili Ambiente su Vercel

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Settings** → **Environment Variables**
4. Aggiungi queste variabili:

### Variabili Obbligatorie:

```
NEXTAUTH_URL=https://TUO-DOMINIO-VERCEL.vercel.app
NEXTAUTH_SECRET=la-tua-chiave-segreta-generata
GOOGLE_CLIENT_ID=il-tuo-google-client-id
GOOGLE_CLIENT_SECRET=il-tuo-google-client-secret
```

### ⚠️ IMPORTANTE:

- **NEXTAUTH_URL**: Deve essere l'URL completo del tuo sito Vercel (con https://)
- **NEXTAUTH_SECRET**: Genera una nuova chiave segreta per produzione (non usare quella di sviluppo!)
  - Puoi generarla con: `openssl rand -base64 32`
- **GOOGLE_CLIENT_ID** e **GOOGLE_CLIENT_SECRET**: Usa le stesse credenziali della Google Console

### Ambiente:

- Seleziona **Production** per tutte le variabili
- Opzionalmente puoi aggiungere anche per **Preview** se vuoi testare

## 📋 Passo 3: Verifica Configurazione

Dopo aver configurato tutto:

1. **Redeploy** il progetto su Vercel (o aspetta il deploy automatico dopo push)
2. Vai sul tuo sito Vercel
3. Prova a fare login con Google
4. Se non funziona, controlla i log di Vercel per errori

## 🔍 Debug

Se ancora non funziona:

1. **Controlla i log Vercel**: Vai su **Deployments** → clicca sull'ultimo deploy → **Functions** → cerca errori
2. **Verifica variabili ambiente**: Assicurati che siano tutte configurate correttamente
3. **Verifica Google Console**: Controlla che il redirect URI corrisponda esattamente all'URL Vercel
4. **Controlla console browser**: Apri DevTools → Console e cerca errori

## ✅ Checklist

- [ ] Redirect URI aggiunto in Google Console per URL produzione
- [ ] JavaScript origin aggiunto in Google Console
- [ ] NEXTAUTH_URL configurato su Vercel (con https://)
- [ ] NEXTAUTH_SECRET configurato su Vercel (chiave nuova per produzione)
- [ ] GOOGLE_CLIENT_ID configurato su Vercel
- [ ] GOOGLE_CLIENT_SECRET configurato su Vercel
- [ ] Deploy eseguito dopo aver configurato le variabili
- [ ] Testato login Google sul sito Vercel

## 🆘 Problemi Comuni

### Errore: "redirect_uri_mismatch"
**Soluzione**: Il redirect URI in Google Console non corrisponde all'URL Vercel. Verifica che sia esattamente uguale.

### Errore: "invalid_client"
**Soluzione**: GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET non sono configurati correttamente su Vercel.

### Errore: "NEXTAUTH_URL not set"
**Soluzione**: Aggiungi NEXTAUTH_URL nelle variabili ambiente Vercel con l'URL completo del tuo sito.

### Login funziona ma redirect non funziona
**Soluzione**: Verifica che trustHost sia true nella configurazione NextAuth (già configurato).


