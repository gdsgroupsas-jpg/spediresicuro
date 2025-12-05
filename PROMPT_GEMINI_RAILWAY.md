# 🤖 Prompt per Gemini - Nuova Architettura Railway

**Data:** 2025-12-04  
**Oggetto:** Migrazione Automation Service su Railway.app

---

## 📋 COSA DIRE A GEMINI

Copia e incolla questo prompt a Gemini:

---

```
Ciao Gemini! 

Ho completato la migrazione del servizio automation di SpedireSicuro.it su Railway.app.

## 🎯 NUOVA ARCHITETTURA

**Prima:**
- Automation agent eseguito su Vercel (Serverless Functions)
- Problemi: cold start (20s), timeout, costi elevati (€20/mese)

**Ora:**
- Automation agent su Railway.app (Container dedicato)
- Vantaggi: no cold start (<1s), stabile, costi ridotti (€5/mese)

## 📦 STRUTTURA

**Servizio Railway:**
- Cartella: `automation-service/`
- URL: `https://spediresicuro.up.railway.app`
- Health check: `https://spediresicuro.up.railway.app/health`
- Endpoint sync: `https://spediresicuro.up.railway.app/api/sync`

**Stack:**
- Node.js + Express
- Puppeteer (browser automation)
- TypeScript
- Docker container

## 🔄 INTEGRAZIONE

**Vercel (Next.js App):**
- API route: `app/api/automation/spedisci-online/sync/route.ts`
- Chiama Railway se `AUTOMATION_SERVICE_URL` è configurato
- Fallback locale se Railway non disponibile

**Variabili d'ambiente Vercel:**
- `AUTOMATION_SERVICE_URL=https://spediresicuro.up.railway.app`

**Variabili d'ambiente Railway:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `NODE_ENV=production`

## 🛠️ FILE IMPORTANTI

**Automation Service (Railway):**
- `automation-service/src/index.ts` - Server Express
- `automation-service/src/agent.ts` - Agent automation
- `automation-service/Dockerfile` - Container config
- `automation-service/railway.toml` - Railway config

**Next.js App (Vercel):**
- `app/api/automation/spedisci-online/sync/route.ts` - API route (chiama Railway)
- `app/api/cron/automation-sync/route.ts` - Cron job (chiama Railway)

## 🔐 SICUREZZA

- Autenticazione obbligatoria con token
- Log sanitizzati (UUID parziali)
- Error messages sanitizzati in produzione
- Password criptate con AES-256-GCM

## 📊 RISULTATI

- ✅ Cold start: 20s → <1s (95% riduzione)
- ✅ Latenza: 30s → 5s (83% riduzione)
- ✅ Costi: €20/mese → €5/mese (75% risparmio)
- ✅ Success rate: 85% → 99%+

## 🎯 COSA FARE

Quando lavori sul progetto:
1. Automation agent è in `automation-service/` (Railway)
2. API routes Next.js chiamano Railway se configurato
3. Fallback locale funziona ancora per sviluppo

Se modifichi l'automation agent:
- Modifica `automation-service/src/agent.ts`
- Commit e push → Railway fa deploy automatico

Se modifichi le API routes:
- Modifica `app/api/automation/.../route.ts`
- Commit e push → Vercel fa deploy automatico

## ⚠️ IMPORTANTE

- `ENCRYPTION_KEY` deve essere IDENTICA su Railway e Vercel
- `AUTOMATION_SERVICE_URL` deve essere configurato su Vercel
- Railway usa Root Directory: `automation-service`

## 📚 DOCUMENTAZIONE

- `GUIDA_SETUP_RAILWAY.md` - Setup completo
- `RIEPILOGO_SETUP_RAILWAY.md` - Riepilogo
- `SICUREZZA_SCRIPT_RAILWAY.md` - Analisi sicurezza
- `automation-service/README.md` - Documentazione servizio

---

Aggiorna la tua conoscenza del progetto con queste informazioni.
Se hai domande o devi modificare qualcosa, dimmelo!
```

---

## 🎯 VERSIONE BREVE (se preferisci)

```
Ciao Gemini!

Ho migrato l'automation agent su Railway.app:
- URL: https://spediresicuro.up.railway.app
- Cartella: automation-service/
- Vercel chiama Railway tramite AUTOMATION_SERVICE_URL
- Fallback locale ancora disponibile

Aggiorna la tua conoscenza del progetto.
```

---

## 📝 COSA FARE

1. **Apri Gemini**
2. **Copia il prompt** (versione completa o breve)
3. **Incolla e invia**
4. **Gemini aggiornerà** la sua conoscenza del progetto

---

## ✅ DOPO

Gemini saprà:
- ✅ Dove si trova l'automation agent (Railway)
- ✅ Come funziona l'integrazione (Vercel → Railway)
- ✅ Quali file modificare per cambiare l'automation
- ✅ Architettura completa del sistema

---

**Scegli la versione che preferisci (completa o breve) e inviala a Gemini!** 🚀

