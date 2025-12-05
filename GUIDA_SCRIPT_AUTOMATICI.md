# 🚀 GUIDA SCRIPT AUTOMATICI - SpedireSicuro.it

**Script per automatizzare tutto il lavoro quotidiano**

---

## 📋 SCRITTI DISPONIBILI

### 1. **`avvia-lavoro.ps1`** - Setup Iniziale
**Cosa fa:**
- Sincronizza repository da GitHub
- Verifica e installa dipendenze
- Controlla configurazione
- Prepara tutto per lavorare

**Quando usarlo:**
- Quando riprendi a lavorare (casa o lavoro)
- Dopo aver clonato il repository
- Quando cambi computer

**Come usarlo:**
```powershell
.\avvia-lavoro.ps1
```

**Oppure con npm:**
```powershell
npm run setup
```

---

### 2. **`sync-automatico.ps1`** - Sincronizzazione Intelligente
**Cosa fa:**
- Fa pull da GitHub (aggiorna codice)
- Verifica modifiche locali
- Se ci sono modifiche, chiede se vuoi committare
- Fa push automatico se confermi

**Quando usarlo:**
- Durante il lavoro (per sincronizzare)
- Prima di iniziare a lavorare
- Quando vuoi salvare le modifiche

**Come usarlo:**

**Versione interattiva (chiede conferma):**
```powershell
.\sync-automatico.ps1
```

**Versione automatica (fa tutto senza chiedere):**
```powershell
.\sync-automatico.ps1 -AutoCommit
```

**Solo pull (non fa commit/push):**
```powershell
.\sync-automatico.ps1 -SoloPull
```

**Oppure con npm:**
```powershell
npm run sync              # Versione interattiva
npm run sync:auto         # Versione automatica
```

---

### 3. **`salva-lavoro.ps1`** - Salvataggio Finale
**Cosa fa:**
- Verifica modifiche
- Fa pull (per evitare conflitti)
- Fa commit con messaggio
- Fa push su GitHub

**Quando usarlo:**
- Prima di finire di lavorare
- Quando vuoi salvare tutto
- Prima di cambiare computer

**Come usarlo:**

**Versione interattiva (chiede messaggio):**
```powershell
.\salva-lavoro.ps1
```

**Con messaggio personalizzato:**
```powershell
.\salva-lavoro.ps1 -Messaggio "feat: aggiunta nuova funzionalità"
```

**Versione automatica (non chiede nulla):**
```powershell
.\salva-lavoro.ps1 -Forza
```

**Oppure con npm:**
```powershell
npm run save
```

---

## 🎯 WORKFLOW CONSIGLIATO

### **Quando Riprendi a Lavorare (Casa/Lavoro)**

```powershell
# 1. Avvia setup automatico
.\avvia-lavoro.ps1

# Oppure:
npm run setup
```

**Cosa fa:**
- ✅ Sincronizza codice da GitHub
- ✅ Installa dipendenze se necessario
- ✅ Verifica configurazione
- ✅ Prepara tutto per lavorare

---

### **Durante il Lavoro (Sincronizzazione)**

```powershell
# Sincronizza con GitHub (chiede conferma per commit)
.\sync-automatico.ps1

# Oppure:
npm run sync
```

**Cosa fa:**
- ✅ Aggiorna codice da GitHub
- ✅ Mostra modifiche locali
- ✅ Chiede se vuoi committare
- ✅ Fa push se confermi

---

### **Prima di Finire (Salvataggio)**

```powershell
# Salva tutto il lavoro
.\salva-lavoro.ps1

# Oppure:
npm run save
```

**Cosa fa:**
- ✅ Verifica modifiche
- ✅ Sincronizza con GitHub
- ✅ Fa commit con messaggio
- ✅ Fa push su GitHub
- ✅ Vercel aggiorna automaticamente

---

## ⚡ COMANDI RAPIDI

### **Setup Iniziale**
```powershell
npm run setup
```

### **Sincronizzazione**
```powershell
npm run sync              # Interattivo
npm run sync:auto         # Automatico
```

### **Salvataggio**
```powershell
npm run save
```

---

## 🔧 OPZIONI AVANZATE

### **sync-automatico.ps1**

```powershell
# Solo pull (non commit/push)
.\sync-automatico.ps1 -SoloPull

# Commit automatico (non chiede)
.\sync-automatico.ps1 -AutoCommit

# Senza verifica configurazione
.\sync-automatico.ps1 -Verifica:$false
```

### **salva-lavoro.ps1**

```powershell
# Con messaggio personalizzato
.\salva-lavoro.ps1 -Messaggio "fix: correzione bug"

# Forza (non chiede conferma)
.\salva-lavoro.ps1 -Forza
```

---

## 🐛 RISOLUZIONE PROBLEMI

### **Errore: "Execution Policy"**

Se vedi errore di esecuzione script PowerShell:

```powershell
# Abilita esecuzione script (una volta sola)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Errore: "Git credentials"**

Se il push chiede credenziali:
1. Usa Personal Access Token GitHub (non password)
2. Windows salverà le credenziali automaticamente

### **Errore: "Conflitti Git"**

Se ci sono conflitti:
1. Risolvi manualmente i conflitti
2. Poi esegui di nuovo lo script

---

## 📌 NOTE IMPORTANTI

- ⚠️ **NON committare** `.env.local` (è nel .gitignore)
- ✅ **SEMPRE** fai pull prima di pushare
- ✅ **SEMPRE** verifica modifiche prima di committare
- ✅ Gli script sono **sicuri** - chiedono conferma prima di modificare

---

## 🎉 VANTAGGI

✅ **Automatizzazione completa** - Non devi ricordare i comandi  
✅ **Sicurezza** - Chiede conferma prima di modificare  
✅ **Velocità** - Tutto in un comando  
✅ **Sincronizzazione** - Casa e lavoro sempre aggiornati  
✅ **Semplicità** - Basta un click o un comando  

---

## 📚 DOCUMENTAZIONE CORRELATA

- `RIEPILOGO_LAVORO_ATTUALE.md` - Riepilogo completo progetto
- `README.md` - Documentazione generale

---

**Ultimo aggiornamento:** Dicembre 2025

