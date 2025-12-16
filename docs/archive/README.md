# 📦 ARCHIVIO STORICO - Documentazione e Script Obsoleti

> **⚠️ IMPORTANTE**: Questa cartella contiene documentazione e script **storici** e **non più necessari** per lo sviluppo attivo o la produzione.

## 🎯 Scopo dell'Archivio

Questo archivio è stato creato per:
- ✅ Mantenere lo storico del progetto accessibile
- ✅ Separare documentazione attiva da quella obsoleta
- ✅ Ridurre il rumore nella repository principale
- ✅ Facilitare la navigazione per sviluppatori e AI

**Tutti i file qui archiviati sono mantenuti per riferimento storico ma NON sono necessari per:**
- Sviluppo locale
- Deploy in produzione
- Onboarding nuovi sviluppatori
- Operazioni quotidiane

---

## 📂 Struttura dell'Archivio

```
docs/archive/
├── root/                    # File .md spostati dalla root del progetto
│   └── [22 file]            # Riepiloghi, analisi, guide temporanee
│
├── debug/                   # File di debug temporanei
│   └── [4 file DEBUG_*.md]  # Debug sessioni specifiche
│
├── fixes/                   # Fix temporanei già risolti
│   └── [10 file FIX_*.md]   # Fix problemi specifici completati
│
├── verifications/           # Verifiche temporanee completate
│   └── [6 file VERIFICA_*.md]  # Verifiche configurazione/ambiente
│
├── riepiloghi/              # Riepiloghi e analisi temporanee
│   └── [6 file]             # Riepiloghi modifiche, analisi Claude
│
└── setup-temporanei/        # Guide setup temporanee o superate
    └── [9 file]             # Setup utenti test, OAuth, dashboard

scripts/archive/
└── [10 file]                # Script temporanei (.ps1, .bat, .js, .txt, .sql)

automation-service/archive/
└── [7 file]                 # Fix Railway e setup temporanei
```

---

## 📋 Categorie di File Archiviati

### 📄 Root (`docs/archive/root/`)
File `.md` spostati dalla root del progetto:
- Riepiloghi commit e modifiche
- Analisi business e executive summary
- Guide temporanee (Vercel, deploy, test)
- Inventari e checklist temporanee
- Documentazione duplicata

### 🐛 Debug (`docs/archive/debug/`)
File di debug per problemi specifici già risolti:
- `DEBUG_DATI_CLIENTE.md`
- `DEBUG_CHIAMATA_API.md`
- `DEBUG_REDIRECT_LOGIN.md`
- `DEBUG_ANNE_LOCALE.md`

### 🔧 Fix (`docs/archive/fixes/`)
Fix temporanei per problemi specifici già risolti:
- Fix errori Vercel, Supabase, login
- Fix problemi locali e configurazione
- Fix errori interni Anne
- Piano fix codice contratto

### ✅ Verifiche (`docs/archive/verifications/`)
Guide di verifica temporanee completate:
- Verifica schema users, utenti Supabase
- Verifica errori Vercel, configurazione
- Test locali courier configs

### 📋 Riepiloghi (`docs/archive/riepiloghi/`)
Riepiloghi e analisi temporanee:
- Riepiloghi modifiche Claude
- Analisi modifiche
- Correzioni configurazione
- Soluzioni problemi

### ⚙️ Setup Temporanei (`docs/archive/setup-temporanei/`)
Guide setup temporanee o superate:
- Creazione utenti test
- Import utenti demo
- Setup OAuth, dashboard redesign
- Test suite

### 🛠️ Script (`scripts/archive/`)
Script temporanei e one-shot:
- Generatori token e encryption key
- Script verifica sincronizzazione Git
- Script recupero variabili Vercel
- Query SQL temporanee
- Log diagnostici

### 🚂 Automation Service (`automation-service/archive/`)
Fix e setup temporanei per automation-service:
- Fix build Railway
- Soluzioni deploy Railway
- Setup automatici

---

## 🔍 Come Trovare Informazioni

### Se cerchi documentazione ATTIVA:
1. ✅ Controlla `README.md` nella root
2. ✅ Controlla `docs/` (documentazione attiva)
3. ✅ Controlla `ISTRUZIONI_REPOSITORY.md` nella root

### Se cerchi informazioni STORICHE:
1. 📦 Cerca in questa cartella `docs/archive/`
2. 📦 Usa la struttura per categoria (debug, fixes, ecc.)
3. 📦 Cerca per nome file o contenuto

---

## ⚠️ Note Importanti

- **NON eliminare** file dall'archivio senza motivo
- **NON spostare** file dall'archivio alla documentazione attiva senza revisione
- **NON aggiornare** file archiviati (sono snapshot storici)
- Se un file archivato diventa rilevante, **crea una nuova versione** in `docs/`

---

## 📅 Informazioni Archivio

**Data creazione archivio**: Gennaio 2025  
**Motivo**: Pulizia e organizzazione repository  
**File archiviati**: ~70 file  
**Nessun file eliminato**: Tutti i file sono stati spostati, non cancellati

---

**Per documentazione attiva, vedi `docs/README.md`**
