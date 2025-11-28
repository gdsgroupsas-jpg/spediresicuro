# 🧹 PROMPT PER CURSOR - Pulizia Repository

**Progetto:** SpedireSicuro.it
**Obiettivo:** Pulire repository eliminando file ridondanti, duplicati e non necessari
**Approccio:** Sicuro, con backup automatico

---

## 🎯 ISTRUZIONI PER CURSOR

Sei un'AI esperta di pulizia e organizzazione codice. Il tuo compito è analizzare questa repository e **eliminare** tutti i file che non servono, mantenendo solo quelli essenziali per il funzionamento del progetto.

**IMPORTANTE:**
- ✅ **PRIMA** di eliminare qualsiasi file, crea un backup
- ✅ **CHIEDI** conferma prima di eliminare file critici
- ✅ **DOCUMENTA** tutto ciò che elimini
- ✅ **VERIFICA** che il progetto funzioni dopo ogni eliminazione

---

## 📋 STEP 1: Analisi File Duplicati/Ridondanti

### 1.1 File Setup Non Necessari

**Elimina questi file** (setup guide create per errore, ridondanti):
```bash
# File MD di setup ridondanti
SETUP_INDEX.md
SETUP_00_GIT_GITHUB.md
SETUP_01_SUPABASE.md
SETUP_02_GOOGLE_OAUTH.md
SETUP_03_VERCEL.md
SETUP_04_ENV_FINAL.md
SETUP_README.md
```

**Perché eliminare:**
- Setup già completato e funzionante
- Documentazione esistente più completa e specifica
- Creano confusione con vecchio progetto
- Nomi sbagliati (SpediSicuro invece di SpedireSicuro)

**Mantieni invece:**
- `COMET_AGENT_SUPABASE_SETUP.md` - Attuale e necessario
- `CURSOR_CLEANUP_REPO.md` - Questo file
- `AI_INTEGRATION_GUIDE.md` - Guida per altre AI (se esiste)

---

### 1.2 File Documentazione Obsoleti

**Analizza e elimina se duplicati:**
```bash
# Cerca file .md duplicati
find . -name "*.md" -type f | grep -E "(OLD|BACKUP|COPY|DRAFT|TODO|temp|tmp)"
```

**Criteri eliminazione:**
- Nomi con "OLD", "BACKUP", "COPY" nel nome
- File draft non finalizzati
- TODO list vecchie e non aggiornate
- Documentazione obsoleta sostituita da nuova

**Mantieni:**
- README.md principale
- Documentazione ufficiale e aggiornata
- Guide setup corrette (Supabase, OAuth, ecc.)

---

### 1.3 File TypeScript/JavaScript Non Usati

**Cerca componenti/lib non referenziati:**
```bash
# Trova file .ts/.tsx non importati
# Cursor, esegui analisi delle dipendenze
```

**Criteri eliminazione:**
- Componenti mai importati
- Utility functions duplicate
- File di test abbandonati
- Codice commentato completamente

**NON eliminare:**
- File attualmente importati (anche indirettamente)
- API routes in `app/api/`
- Componenti UI in uso
- Lib utilities referenziate

---

### 1.4 File Build/Cache

**Elimina cartelle/file temporanei:**
```bash
# Build artifacts
.next/
out/
build/
dist/

# Dependency directories
node_modules/  # (non va in Git comunque)

# Cache
.cache/
.parcel-cache/
.turbo/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db
*.swp
*.swo

# IDE
.vscode/
.idea/
```

**Verifica .gitignore** contenga tutto questo!

---

## 📋 STEP 2: Analisi Schema Database

### 2.1 File SQL Ridondanti

**Nella cartella `supabase/`:**
```bash
ls -la supabase/
```

**Probabile situazione:**
- `schema.sql` - Schema geo_locations
- `fix-schema.sql` - Fix vecchi
- `improvements.sql` - Miglioramenti
- `migrations/001_complete_schema.sql` - Schema completo

**Azione:**
1. Verifica quale schema è **effettivamente usato** in produzione
2. **Mantieni SOLO:**
   - `migrations/001_complete_schema.sql` (schema completo e ufficiale)
   - `schema.sql` (se contiene geo_locations e è referenziato dal codice)
3. **Elimina:**
   - `fix-schema.sql` (fix vecchi, ormai incorporati)
   - `improvements.sql` (miglioramenti, ormai incorporati)
   - File SQL di test o draft

---

### 2.2 Script Duplicati

**Verifica folder `scripts/`:**
```bash
ls -la scripts/
```

**Criteri:**
- Mantieni script **effettivamente utilizzati**
- Elimina script obsoleti o sostituiti
- Documenta funzione di ogni script mantenuto

---

## 📋 STEP 3: Pulizia Componenti

### 3.1 Componenti Homepage

**Problema noto:** Componenti homepage con errori idratazione

**Analizza:**
```bash
ls -la components/homepage/
```

**Azione:**
- Se componenti NON funzionano e causano errori → **Elimina** (temporaneo)
- Se componenti funzionano → **Mantieni**
- Documenta quali componenti vengono eliminati

**Nota:** Homepage può essere rifatta in seguito, priorità ora è funzionalità spedizioni.

---

### 3.2 Componenti UI Non Usati

**Cerca componenti mai importati:**
```bash
# Cursor, analizza import tree
# Identifica componenti orfani
```

**Criteri eliminazione:**
- Componenti UI mai referenziati
- Componenti draft/WIP abbandonati
- Componenti duplicati (stessa funzione, nomi diversi)

---

## 📋 STEP 4: Pulizia Dipendenze

### 4.1 Analizza package.json

**Verifica dipendenze non usate:**
```bash
# Cursor, analizza package.json vs import effettivi
npx depcheck  # (se disponibile)
```

**Azione:**
- Rimuovi dipendenze mai importate nel codice
- Aggiorna dipendenze obsolete (se sicuro)
- Documenta motivazione rimozione

---

### 4.2 Verifica Lock File

**Controlla:**
- `package-lock.json` esistente? → Mantieni
- `yarn.lock` esistente? → Elimina se usi npm
- `pnpm-lock.yaml` esistente? → Elimina se usi npm

**Mantieni SOLO il lock file del package manager usato!**

---

## 📋 STEP 5: Organizzazione Finale

### 5.1 Struttura Cartelle Pulita

**Dopo pulizia, struttura dovrebbe essere:**
```
spediresicuro/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Login page
│   └── page.tsx          # Homepage
├── components/           # Componenti React
│   ├── ui/              # UI components (solo usati)
│   └── dashboard-nav.tsx # etc.
├── lib/                 # Utilities e logica
│   ├── database.ts     # Database JSON locale
│   ├── supabase.ts     # Supabase client
│   └── auth-config.ts  # NextAuth config
├── supabase/           # Database schema
│   └── migrations/
│       └── 001_complete_schema.sql
├── data/              # Database JSON
│   └── database.json
├── docs/              # Documentazione (solo essenziale)
│   ├── SUPABASE_SETUP_GUIDE.md
│   └── OAUTH_SETUP.md
├── public/           # Assets statici
├── COMET_AGENT_SUPABASE_SETUP.md  # Prompt Comet
├── AI_INTEGRATION_GUIDE.md        # Guida AI
├── README.md                       # Main README
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.mjs
└── tailwind.config.ts
```

---

### 5.2 Documenta Eliminazioni

**Crea file `CLEANUP_REPORT.md`:**
```markdown
# Cleanup Report - [DATA]

## File Eliminati

### Setup Guides Ridondanti
- SETUP_INDEX.md - Duplicato, setup già completato
- SETUP_00_GIT_GITHUB.md - Ridondante
- SETUP_01_SUPABASE.md - Sostituito da COMET_AGENT_SUPABASE_SETUP.md
- SETUP_02_GOOGLE_OAUTH.md - Ridondante
- SETUP_03_VERCEL.md - Ridondante
- SETUP_04_ENV_FINAL.md - Ridondante
- SETUP_README.md - Ridondante

### File SQL Obsoleti
- supabase/fix-schema.sql - Fix incorporati in migration completa
- supabase/improvements.sql - Miglioramenti incorporati

### Componenti Non Funzionanti
- [Lista componenti homepage se eliminati]

### Dipendenze Rimosse
- [Lista package rimossi da package.json]

## Spazio Recuperato

- File eliminati: [NUMERO]
- KB risparmiati: [DIMENSIONE]

## Verifica Funzionamento

✅ Build: `npm run build` → Success
✅ Dev: `npm run dev` → Success
✅ Lint: `npm run lint` → No errors
✅ Test: Creazione spedizione → Funzionante
✅ Test: Download CSV → Funzionante
```

---

## ✅ CHECKLIST FINALE

**Prima di concludere, verifica:**

- [ ] ✅ Backup creato (commit Git prima della pulizia)
- [ ] ✅ File SETUP_*.md eliminati (7 file)
- [ ] ✅ File SQL ridondanti eliminati
- [ ] ✅ Componenti non usati eliminati
- [ ] ✅ Dipendenze package.json pulite
- [ ] ✅ `.gitignore` aggiornato
- [ ] ✅ `CLEANUP_REPORT.md` creato
- [ ] ✅ Build test: `npm run build` → Success
- [ ] ✅ Dev test: `npm run dev` → Success
- [ ] ✅ Funzionalità critica testata (crea spedizione)

---

## 📤 COMANDI DA ESEGUIRE

### 1. Backup Prima di Iniziare
```bash
# Crea commit di backup
git add -A
git commit -m "backup: pre-cleanup snapshot"
```

### 2. Elimina File Setup Ridondanti
```bash
# Elimina file SETUP_*.md
rm -f SETUP_INDEX.md \
      SETUP_00_GIT_GITHUB.md \
      SETUP_01_SUPABASE.md \
      SETUP_02_GOOGLE_OAUTH.md \
      SETUP_03_VERCEL.md \
      SETUP_04_ENV_FINAL.md \
      SETUP_README.md
```

### 3. Elimina File SQL Obsoleti
```bash
# Elimina fix e improvements (se confermato dopo analisi)
rm -f supabase/fix-schema.sql \
      supabase/improvements.sql
```

### 4. Pulizia Cache/Build
```bash
# Rimuovi cache Next.js
rm -rf .next/

# Reinstalla dipendenze pulite
rm -rf node_modules/
npm install
```

### 5. Test Finale
```bash
# Build test
npm run build

# Se build ok, dev test
npm run dev
```

### 6. Commit Finale
```bash
# Commit pulizia
git add -A
git commit -m "chore: cleanup repository - removed redundant files

- Removed 7 SETUP_*.md files (redundant, already configured)
- Removed obsolete SQL files (fixes incorporated)
- Removed unused components/dependencies
- Updated .gitignore
- Created CLEANUP_REPORT.md

Verified:
✅ Build successful
✅ Dev server working
✅ Critical features tested"

git push
```

---

## 🎯 OBIETTIVO FINALE

Dopo la pulizia, la repository deve essere:
- ✅ **Minimal** - Solo file necessari
- ✅ **Organizzata** - Struttura chiara
- ✅ **Funzionante** - Tutto testato
- ✅ **Documentata** - CLEANUP_REPORT.md con dettagli
- ✅ **Veloce** - Build più rapido, meno confusione

---

## ⚠️ ATTENZIONE

**NON eliminare:**
- ❌ File in uso corrente (importati nel codice)
- ❌ Configurazioni Next.js/TypeScript/Tailwind
- ❌ API routes funzionanti
- ❌ Componenti dashboard funzionanti
- ❌ Database JSON (`data/database.json`)
- ❌ File `.env.local` (se esiste)
- ❌ Schema migration ufficiale (`001_complete_schema.sql`)

**Elimina con sicurezza:**
- ✅ File SETUP_*.md ridondanti
- ✅ Documentazione duplicata/obsoleta
- ✅ Componenti mai importati
- ✅ File SQL di fix/improvements incorporati
- ✅ Cache e build artifacts
- ✅ Dipendenze npm non usate

---

## 📊 REPORT ATTESO

Alla fine, fornisci questo output:

```markdown
# ✅ Repository Cleanup Completato

**Data:** [DATA]
**Durata:** [TEMPO IMPIEGATO]

## Statistiche

- **File eliminati:** [NUMERO]
- **KB risparmiati:** [DIMENSIONE]
- **Dipendenze rimosse:** [NUMERO]
- **Build time before:** [SECONDI]s
- **Build time after:** [SECONDI]s

## File Eliminati Principali

1. SETUP_INDEX.md (ridondante)
2. SETUP_00_GIT_GITHUB.md (ridondante)
3. SETUP_01_SUPABASE.md (ridondante)
4. SETUP_02_GOOGLE_OAUTH.md (ridondante)
5. SETUP_03_VERCEL.md (ridondante)
6. SETUP_04_ENV_FINAL.md (ridondante)
7. SETUP_README.md (ridondante)
8. supabase/fix-schema.sql (obsoleto)
9. supabase/improvements.sql (obsoleto)
10. [Altri file...]

## Verifica Funzionamento

✅ `npm run build` → Success (XX.Xs)
✅ `npm run dev` → Success
✅ `npm run lint` → 0 errors
✅ Test creazione spedizione → OK
✅ Test download CSV → OK
✅ Homepage → [OK / Errori idratazione noti]

## Commit

✅ Backup commit: [HASH]
✅ Cleanup commit: [HASH]
✅ Pushed to remote: YES

## Repository Status

La repository è ora:
- ✅ Pulita e organizzata
- ✅ Solo file necessari
- ✅ Build più veloce
- ✅ Meno confusione
- ✅ Pronta per sviluppo

**Prossimi passi suggeriti:**
1. Testare tutte le funzionalità critiche
2. Aggiornare README.md con struttura attuale
3. Continuare sviluppo features
```

---

**CURSOR, INIZIA LA PULIZIA!** 🧹✨
