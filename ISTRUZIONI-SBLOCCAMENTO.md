# 🔓 ISTRUZIONI SBLOCCAMENTO FILE WINDOWS

## ⚠️ PROBLEMA IDENTIFICATO

Windows Security sta **bloccando i file** perché sono stati "scaricati da Internet". Questo impedisce l'esecuzione degli script.

---

## ✅ SOLUZIONE RAPIDA

### **Opzione 1: Script Automatico (CONSIGLIATO)**

Esegui questo script che sblocca TUTTI i file:

```
SBLOCCA-FILE-WINDOWS.bat
```

**Fai doppio click** sul file e segui le istruzioni.

---

### **Opzione 2: Manuale - Sblocca File Singoli**

1. **Fai click destro** sul file `.bat` o `.ps1`
2. Clicca su **"Proprietà"**
3. In fondo alla finestra, vedrai un checkbox **"Sblocca"** o **"Unblock"**
4. **Spunta il checkbox**
5. Clicca **"OK"**
6. Ripeti per tutti i file che vuoi eseguire

---

### **Opzione 3: PowerShell (Avanzato)**

Apri PowerShell come **Amministratore** e esegui:

```powershell
cd d:\spediresicuro-master
Get-ChildItem -Path . -Include *.bat,*.ps1 -Recurse | Unblock-File
```

Questo sblocca TUTTI i file `.bat` e `.ps1` nella directory.

---

## 📋 DOPO LO SBLOCCAMENTO

Una volta sbloccati i file, esegui nell'ordine:

### **1. Prima: Fix Semplice**
```
FIX-SEMPLICE.bat
```
Questo chiude processi bloccati e pulisce il repository.

### **2. Poi: Commit e Push**
```
COMMIT-PUSH-SEMPLICE.bat
```
Questo fa commit e push delle modifiche.

---

## 🔍 VERIFICA CHE SIA SBLOCCATO

Dopo lo sbloccamento, quando fai **click destro** → **Proprietà** su un file `.bat`, **NON** dovresti più vedere il checkbox "Sblocca" o dovrebbe essere già spuntato.

---

## 🆘 SE ANCORA NON FUNZIONA

1. **Esegui PowerShell come Amministratore:**
   - Cerca "PowerShell" nel menu Start
   - Click destro → "Esegui come amministratore"

2. **Esegui questo comando:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
   ```

3. **Poi sblocca i file:**
   ```powershell
   cd d:\spediresicuro-master
   Get-ChildItem *.bat,*.ps1 | Unblock-File
   ```

---

## ✅ FILE CREATI SENZA EMOJI

Ho creato versioni **SENZA emoji** che non causano errori:

- ✅ `FIX-SEMPLICE.bat` - Pulizia senza emoji
- ✅ `COMMIT-PUSH-SEMPLICE.bat` - Commit e push senza emoji
- ✅ `SBLOCCA-FILE-WINDOWS.bat` - Sblocca tutti i file

Usa questi invece degli altri!

---

**Ultimo aggiornamento:** Dicembre 2024
