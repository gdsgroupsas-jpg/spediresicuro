# 🤖 PROMPT PER AGENTE AI - CONTROLLO RAILWAY

## 📋 COPIA E INCOLLA QUESTO PROMPT COMPLETO

```
Ciao! Ho bisogno che tu controlli la configurazione Railway per il mio progetto "automation-service".

## 🎯 CONTESTO PROGETTO

**Repository GitHub**: `gdsgroupsas-jpg/spediresicuro`
**Branch**: `master`
**Servizio Railway**: `spediresicuro` (automation-service)
**URL Produzione**: `spediresicuro.up.railway.app`
**Porta**: 8080

## 📁 STRUTTURA PROGETTO

Il progetto ha questa struttura:
```
spediresicuro/
├── automation-service/          # Servizio da deployare su Railway
│   ├── src/
│   │   ├── agent.ts            # File principale (fix TypeScript applicato)
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile              # Dockerfile per Railway
├── app/                        # Next.js app (deploy su Vercel, NON Railway)
└── ...
```

## ✅ COSA È STATO FATTO

1. **Fix TypeScript**: Corretto errore `NodeListOf<HTMLTableCellElement>` in `agent.ts` (linea 705-709)
   - Cambiato: `const cells = row.querySelectorAll('td');`
   - In: `const cellsNodeList = row.querySelectorAll('td'); const cells = Array.from(cellsNodeList);`

2. **Fix Dockerfile**: Corretto percorso COPY per Railway build context
   - Da: `COPY src ./src`
   - A: `COPY automation-service/src ./src`
   - (E stesso per package.json, tsconfig.json)

3. **Rimossi file config**: Eliminati `railway.toml` e `railway.json` (conflitti)

4. **Tutto pushato**: Ultimi commit su GitHub/master

## 🔍 COSA DEVI CONTROLLARE SU RAILWAY

Accedi a Railway.app e verifica:

### 1. CONFIGURAZIONE SETTINGS
- [ ] **Root Directory**: Deve essere `automation-service`
- [ ] **Source**: Repository connesso a `gdsgroupsas-jpg/spediresicuro` / branch `master`
- [ ] **Auto Deploy**: Attivo (se disponibile)
- [ ] **Dockerfile Path**: Railway deve trovare `automation-service/Dockerfile` automaticamente

### 2. VARIABILI AMBIENTE
Verifica che ci siano tutte le variabili necessarie (non modificare, solo verificare):
- Variabili per database, API keys, ecc.

### 3. ULTIMO DEPLOY
- [ ] Controlla l'ultimo deploy in "Deployments"
- [ ] Verifica che usi l'ultimo commit (quello con fix TypeScript)
- [ ] Controlla i log di build per errori TypeScript
- [ ] Verifica che il build completi senza errori

### 4. STATO SERVIZIO
- [ ] Servizio online?
- [ ] URL `spediresicuro.up.railway.app` risponde?
- [ ] Porta 8080 configurata correttamente?

### 5. DOCKERFILE
Verifica che Railway usi il Dockerfile corretto:
- Path: `automation-service/Dockerfile`
- Contiene: `COPY automation-service/src ./src` (non `COPY src ./src`)
- Contiene: `COPY automation-service/package*.json ./`
- CMD: `node dist/index.js`

## ❓ COSA FARE SE TROVI PROBLEMI

1. **Se Root Directory è sbagliato**: Modifica in Settings → Root Directory → `automation-service`
2. **Se Dockerfile non trovato**: Verifica path e Root Directory
3. **Se build fallisce con errore TypeScript**: Verifica che usi l'ultimo commit (con fix Array.from)
4. **Se repository non connesso**: Connetti `gdsgroupsas-jpg/spediresicuro` / `master`
5. **Se deploy vecchio**: Forza nuovo deploy o disconnetti/riconnetti repository

## 📊 REPORT RICHIESTO

Fornisci un report con:
1. ✅ Cosa è corretto
2. ⚠️ Cosa potrebbe essere migliorato
3. ❌ Eventuali problemi trovati
4. 🔧 Suggerimenti per fix

## 🎯 OBIETTIVO FINALE

Verificare che Railway:
- ✅ Usi il codice corretto (con fix TypeScript)
- ✅ Build completi senza errori
- ✅ Servizio sia online e funzionante
- ✅ Configurazione sia ottimale

Grazie!
```

---

## 📝 NOTE AGGIUNTIVE

Se l'agente ha bisogno di più informazioni, puoi aggiungere:

- **Commit hash ultimo**: `git log -1 --format="%H"` (per verificare che Railway usi quello giusto)
- **Log Railway**: Se ci sono errori specifici nei log
- **Screenshot**: Se l'agente può vedere la UI Railway

---

**COPIA IL PROMPT SOPRA E INCOLLALO ALL'AGENTE AI!** 🤖
