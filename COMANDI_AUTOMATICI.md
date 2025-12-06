# 🤖 COMANDI AUTOMATICI - Zero Interazione

**Tutti gli script sono ora COMPLETAMENTE AUTOMATICI - nessuna richiesta, nessun blocco!**

---

## 🚀 COMANDO PRINCIPALE (USA QUESTO!)

```powershell
npm run git
```

**Cosa fa:**
- ✅ Pull da GitHub (aggiorna codice)
- ✅ Add tutti i file modificati
- ✅ Commit automatico con messaggio
- ✅ Push su GitHub
- ✅ **ZERO richieste, tutto automatico!**

**Oppure direttamente:**
```powershell
.\git-auto.ps1
```

---

## 📋 ALTRI COMANDI AUTOMATICI

### **Setup Iniziale (Automatico)**
```powershell
npm run setup
```
- Sincronizza repository
- Installa dipendenze
- Verifica configurazione
- **Nessuna richiesta!**

### **Sincronizzazione (Automatico)**
```powershell
npm run sync
```
- Pull da GitHub
- Se ci sono modifiche → commit + push automatico
- **Nessuna richiesta!**

### **Salvataggio (Automatico)**
```powershell
npm run save
```
- Verifica modifiche
- Pull + commit + push automatico
- **Nessuna richiesta!**

---

## ✅ COSA È STATO MODIFICATO

### **Script Resi Automatici:**

1. **`sync-automatico.ps1`**
   - ✅ Default: `-AutoCommit` sempre attivo
   - ✅ Nessuna richiesta conferma
   - ✅ Commit automatico sempre

2. **`salva-lavoro.ps1`**
   - ✅ Default: `-Forza` sempre attivo
   - ✅ Nessuna richiesta conferma
   - ✅ Messaggio commit automatico

3. **`avvia-lavoro.ps1`**
   - ✅ Copia automatica `.env.example` → `.env.local`
   - ✅ Nessuna richiesta conferma

4. **`git-auto.ps1`** (NUOVO)
   - ✅ Script principale completamente automatico
   - ✅ Pull + Add + Commit + Push in un colpo solo
   - ✅ Zero interazione

---

## 🎯 USO QUOTIDIANO

### **Quando Riprendi a Lavorare:**
```powershell
npm run setup
```

### **Durante il Lavoro (Sincronizza):**
```powershell
npm run git
```

### **Prima di Finire (Salva Tutto):**
```powershell
npm run git
```

**È sempre lo stesso comando!** `npm run git` fa tutto automaticamente.

---

## 🔧 DETTAGLI TECNICI

### **Comportamento Automatico:**

- **Pull:** Sempre eseguito, anche se ci sono conflitti (mostra warning)
- **Add:** Sempre tutti i file (`git add -A`)
- **Commit:** Sempre con messaggio automatico con timestamp
- **Push:** Sempre eseguito, mostra errore se fallisce

### **Gestione Errori:**

- Se pull fallisce → continua comunque
- Se commit fallisce (nessuna modifica) → va bene, continua
- Se push fallisce → mostra errore e esce

---

## 📌 NOTE IMPORTANTI

- ⚠️ **NON committare** `.env.local` (è nel .gitignore, quindi va bene)
- ✅ **SEMPRE** fa pull prima di pushare (evita conflitti)
- ✅ **SEMPRE** usa messaggio commit automatico
- ✅ **ZERO** interazione richiesta

---

## 🎉 VANTAGGI

✅ **Velocità** - Un comando, tutto fatto  
✅ **Sicurezza** - Pull sempre prima di push  
✅ **Semplicità** - Nessuna decisione da prendere  
✅ **Affidabilità** - Stesso comportamento sempre  

---

**Ultimo aggiornamento:** Dicembre 2025




