# 🚀 SETUP GUIDE INDEX - SpediSicuro Platform

**Benvenuto nella guida di setup completa per SpediSicuro Platform!**

---

## ⚠️ ATTENZIONE IMPORTANTE

**Questo è il NUOVO progetto SpediSicuro!**

Esiste un vecchio progetto con nome simile. Prima di procedere con QUALSIASI setup:

- ✅ **VERIFICA** di essere loggato con gli account corretti
- ✅ **CHIEDI** conferma prima di accedere a qualsiasi servizio (Supabase, Google Cloud, GitHub, Vercel)
- ✅ **NON** sovrascrivere progetti/deployment/repository esistenti
- ✅ **USA** nomi diversi se esiste già qualcosa con nome simile (es. `spediresicuro-v2`, `spediresicuro-new`)

---

## 📋 SETUP FILES - Ordine di Esecuzione

Segui questi file MD **IN ORDINE** per configurare completamente la piattaforma:

### 1️⃣ SETUP_00_GIT_GITHUB.md
**Quando**: Prima di tutto (se non hai già un repository)
**Cosa**: Configura Git locale e crea repository GitHub
**Tempo**: ~15 minuti
**Output**: Repository GitHub pronto per CI/CD

**Chiedi PRIMA**:
- Su quale account GitHub vuoi creare il repository?
- Esiste già un repository `spediresicuro`? Se sì, come lo vuoi chiamare?
- Vuoi repository pubblico o privato?

### 2️⃣ SETUP_01_SUPABASE.md
**Quando**: Dopo aver creato il repository
**Cosa**: Crea database PostgreSQL su Supabase con schema completo
**Tempo**: ~20 minuti
**Output**: Database con 19 tabelle + credenziali API

**Chiedi PRIMA**:
- Su quale account Supabase vuoi creare il progetto?
- Esiste già un progetto `spediresicuro`? Se sì, come lo vuoi chiamare?
- Quale region preferisci? (consigliato: Europe Frankfurt)

### 3️⃣ SETUP_02_GOOGLE_OAUTH.md
**Quando**: Dopo aver configurato Supabase
**Cosa**: Configura Google OAuth per login con account Google
**Tempo**: ~15 minuti
**Output**: Google Client ID + Secret

**Chiedi PRIMA**:
- Su quale account Google Cloud vuoi creare il progetto?
- Esiste già un progetto OAuth `SpediSicuro`? Se sì, come lo vuoi chiamare?
- Vuoi configurare anche GitHub/Facebook OAuth? (opzionale)

### 4️⃣ SETUP_03_VERCEL.md
**Quando**: Dopo aver configurato OAuth
**Cosa**: Deploy su Vercel con auto-deploy da GitHub
**Tempo**: ~10 minuti (+ 5 min build)
**Output**: App online su Vercel con URL produzione

**Chiedi PRIMA**:
- Su quale account Vercel vuoi fare il deploy?
- Quale repository GitHub vuoi deployare?
- Esiste già un deployment `spediresicuro`? Se sì, come lo vuoi chiamare?

### 5️⃣ SETUP_04_ENV_FINAL.md
**Quando**: Dopo aver completato tutti i setup precedenti
**Cosa**: Raccoglie tutte le credenziali e crea `.env.local` finale
**Tempo**: ~10 minuti
**Output**: File `.env.local` completo e pronto all'uso

---

## 🎯 Quick Start

Se hai fretta e sai cosa stai facendo:

```bash
# 1. Setup Git (se necessario)
cat SETUP_00_GIT_GITHUB.md

# 2. Setup Supabase
cat SETUP_01_SUPABASE.md

# 3. Setup Google OAuth
cat SETUP_02_GOOGLE_OAUTH.md

# 4. Deploy Vercel
cat SETUP_03_VERCEL.md

# 5. Crea .env.local
cat SETUP_04_ENV_FINAL.md
```

---

## 📊 Checklist Completa

### Prima di Iniziare
- [ ] Ho letto il warning importante (vecchio vs nuovo progetto)
- [ ] Ho accesso agli account necessari (GitHub, Google Cloud, Supabase, Vercel)
- [ ] Ho circa 60-90 minuti per completare tutto
- [ ] Ho un modo sicuro per salvare le credenziali (1Password, Bitwarden, etc.)

### Durante il Setup
- [ ] ✅ SETUP_00: Repository GitHub creato
- [ ] ✅ SETUP_01: Database Supabase configurato (19 tabelle)
- [ ] ✅ SETUP_02: Google OAuth configurato (Client ID + Secret)
- [ ] ✅ SETUP_03: Deploy Vercel completato (app online)
- [ ] ✅ SETUP_04: File `.env.local` creato e testato

### Dopo il Setup
- [ ] ✅ Test login Google funzionante
- [ ] ✅ Test creazione spedizione funzionante
- [ ] ✅ Credenziali salvate in luogo sicuro
- [ ] ✅ `.env.local` NON committato su Git (verificato!)
- [ ] ✅ URL produzione condiviso con team

---

## 🔐 Credenziali da Raccogliere

Durante i setup, raccoglierai queste credenziali:

### Da SETUP_01 (Supabase)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Da SETUP_02 (Google OAuth)
```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
NEXTAUTH_SECRET=xxxxx (genera con openssl)
NEXTAUTH_URL=http://localhost:3000
```

### Da SETUP_03 (Vercel)
```
VERCEL_PRODUCTION_URL=https://spediresicuro.vercel.app
```

**Totale**: 7 variabili obbligatorie + 4 opzionali

---

## 🆘 Supporto e Troubleshooting

### Se qualcosa va storto:
1. **Leggi la sezione TROUBLESHOOTING** nel file MD specifico
2. **Verifica** di aver seguito TUTTI gli step in ordine
3. **Controlla** i logs di errore (browser console, Vercel logs)
4. **Non** procedere al setup successivo se quello corrente non funziona

### Errori Comuni:

#### "Repository already exists"
→ Usa nome diverso: `spediresicuro-new` o `spediresicuro-v2`

#### "OAuth redirect_uri_mismatch"
→ Verifica URI esatti in Google Console (NO trailing slash!)

#### "Supabase connection failed"
→ Verifica credenziali in `.env.local`, riavvia dev server

#### ".env.local tracked by Git"
→ **CRITICO!** Rimuovi immediatamente:
```bash
git rm --cached .env.local
echo ".env.local" >> .gitignore
git commit -m "fix: remove .env.local from tracking"
```

---

## 📚 Documentazione Aggiuntiva

Dopo aver completato il setup, consulta:

- **FERRARI_LOGISTICS_PLATFORM.md** → Architettura completa del progetto (da rinominare)
- **IMPLEMENTATION_SUMMARY.md** → Dettagli implementazione
- **CURSOR.md** → Guida per sviluppatori con Cursor AI
- **ENV_VARIABLES.md** → Lista completa environment variables

---

## 🎓 Per Comet Agent

Se sei un agente Comet che esegue questi setup:

### Comportamento Richiesto:
1. **SEMPRE** chiedi conferma prima di accedere a qualsiasi account
2. **SEMPRE** verifica che non esistano progetti con nomi simili
3. **SEMPRE** restituisci l'output nel formato richiesto dal file MD
4. **MAI** sovrascrivere progetti/deployment esistenti
5. **MAI** procedere se l'utente non conferma

### Formato Domande:
```
🤖 Agent: Prima di procedere con SETUP_XX, ho bisogno di conferme:

1. Su quale account [SERVIZIO] vuoi lavorare? (email: _____)
2. Esiste già un progetto chiamato `spediresicuro` su questo account?
   - [ ] Sì → Come vuoi chiamare il nuovo? _____
   - [ ] No → OK, procedo con `spediresicuro`
3. Altre configurazioni specifiche? _____

Attendo conferma per procedere! ✅
```

### Gestione Errori:
- Se trovi un errore → **STOPPA** e chiedi aiuto
- Se l'utente dice "non sono sicuro" → **STOPPA** e spiega le opzioni
- Se qualcosa sembra sbagliato → **STOPPA** e segnala

---

## ✅ Setup Completato!

Quando vedrai questo messaggio:

```
# ✅ SPEDISICURO PLATFORM - SETUP COMPLETO

La piattaforma è ora:
- ✅ Operativa in sviluppo (localhost)
- ✅ Deployata in produzione (Vercel)
- ✅ Pronta per uso reale
- ✅ Scalabile e performante
- ✅ Costo: $0/mese (free tier everywhere!)

**Congratulazioni! 🎉**
```

Significa che hai finito! La piattaforma è pronta per essere usata.

---

## 📞 Contatti e Supporto

- **Repository**: [GitHub Link dopo SETUP_00]
- **Production URL**: [Vercel URL dopo SETUP_03]
- **Documentazione**: Tutti i file `SETUP_*.md` + `*.md` nella repo

---

**Pronto? Inizia con SETUP_00_GIT_GITHUB.md!** 🚀
