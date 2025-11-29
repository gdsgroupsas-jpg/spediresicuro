# 🏠 LAVORO REMOTO - Guida Completa

## 🎯 COME CONTINUARE DA CASA

Il progetto è già su GitHub, quindi puoi continuare a lavorare da qualsiasi PC!

---

## 📋 SCENARIO 1: PRIMA VOLTA SU QUESTO PC (CASA)

### Passo 1: Installa Git (se non ce l'hai)

1. Vai su: **https://git-scm.com/download/win**
2. Scarica Git per Windows
3. Installa (lascia tutte le opzioni di default)
4. Apri PowerShell o CMD

### Passo 2: Configura Git (solo la prima volta)

```bash
# Configura il tuo nome (usa lo stesso del lavoro)
git config --global user.name "gdsgroupsas-jpg"

# Configura la tua email
git config --global user.email "tua-email@esempio.com"
```

### Passo 3: Scarica il Progetto

```bash
# Vai nella cartella dove vuoi salvare il progetto (es. Documenti)
cd C:\Users\TuoNome\Documents

# Scarica il progetto da GitHub
git clone https://github.com/gdsgroupsas-jpg/spediresicuro.git

# Entra nella cartella
cd spediresicuro
```

### Passo 4: Installa Dipendenze

```bash
# Installa Node.js se non ce l'hai (da https://nodejs.org/)
# Poi installa le dipendenze del progetto:
npm install
```

### Passo 5: Avvia il Server

```bash
npm run dev
```

**Ora puoi lavorare!** 🎉

---

## 📋 SCENARIO 2: PC CASA GIÀ CONFIGURATO

Se hai già scaricato il progetto prima:

### Passo 1: Vai nella Cartella Progetto

```bash
cd C:\percorso\dove\hai\salvato\spediresicuro
```

### Passo 2: Scarica le Ultime Modifiche

```bash
# Scarica tutte le modifiche da GitHub
git pull origin master
```

### Passo 3: Installa Nuove Dipendenze (se necessario)

```bash
npm install
```

### Passo 4: Avvia il Server

```bash
npm run dev
```

**Pronto per lavorare!** 🚀

---

## 💾 SALVARE LE MODIFICHE DA CASA

Quando finisci di lavorare da casa, salva tutto su GitHub:

### Passo 1: Vedi Cosa Hai Modificato

```bash
git status
```

### Passo 2: Aggiungi le Modifiche

```bash
# Aggiungi tutti i file modificati
git add .
```

### Passo 3: Fai Commit

```bash
git commit -m "Descrizione delle modifiche (es: Aggiunto nuovo componente)"
```

### Passo 4: Carica su GitHub

```bash
git push origin master
```

**Le modifiche sono ora su GitHub!** ✅

---

## 🔄 SINCRONIZZARE TRA LAVORO E CASA

### Quando Arrivi al Lavoro (dopo aver lavorato da casa):

```bash
# Vai nella cartella progetto
cd C:\spediresicuro.it

# Scarica le modifiche da casa
git pull origin master

# Installa nuove dipendenze (se necessario)
npm install
```

### Quando Torni a Casa (dopo aver lavorato al lavoro):

```bash
# Vai nella cartella progetto
cd C:\percorso\spediresicuro

# Scarica le modifiche dal lavoro
git pull origin master

# Installa nuove dipendenze (se necessario)
npm install
```

---

## ⚠️ IMPORTANTE: Prima di Fare Push

**SEMPRE verifica l'account Git prima di pushare:**

```bash
# Verifica nome account
git config user.name

# Dovrebbe essere: gdsgroupsas-jpg
# Se non lo è, correggi:
git config user.name "gdsgroupsas-jpg"
```

---

## 🚀 WORKFLOW COMPLETO

### Al Lavoro (Fine Giornata):

```bash
# 1. Vedi modifiche
git status

# 2. Aggiungi tutto
git add .

# 3. Commit
git commit -m "Descrizione modifiche"

# 4. Verifica account
git config user.name

# 5. Push su GitHub
git push origin master
```

### A Casa (Inizio Sessione):

```bash
# 1. Vai nella cartella
cd C:\percorso\spediresicuro

# 2. Scarica modifiche
git pull origin master

# 3. Installa dipendenze (se necessario)
npm install

# 4. Avvia server
npm run dev
```

### A Casa (Fine Sessione):

```bash
# 1. Vedi modifiche
git status

# 2. Aggiungi tutto
git add .

# 3. Commit
git commit -m "Descrizione modifiche"

# 4. Verifica account
git config user.name

# 5. Push su GitHub
git push origin master
```

---

## 🆘 PROBLEMI COMUNI

### Problema: "git: command not found"
**Soluzione:** Installa Git da https://git-scm.com/download/win

### Problema: "fatal: not a git repository"
**Soluzione:** Sei nella cartella sbagliata. Vai nella cartella del progetto.

### Problema: "Permission denied"
**Soluzione:** Verifica l'account Git:
```bash
git config user.name
# Deve essere: gdsgroupsas-jpg
```

### Problema: "Merge conflict"
**Soluzione:** Se hai modificato gli stessi file in due posti:
```bash
# Vedi i conflitti
git status

# Risolvi manualmente i file in conflitto
# Poi:
git add .
git commit -m "Risolto conflitto"
git push origin master
```

### Problema: "npm: command not found"
**Soluzione:** Installa Node.js da https://nodejs.org/

---

## 📝 CHECKLIST RAPIDA

### Prima di Andare Via dal Lavoro:
- [ ] `git add .`
- [ ] `git commit -m "Messaggio"`
- [ ] `git config user.name` (verifica)
- [ ] `git push origin master`

### Quando Arrivi a Casa:
- [ ] `cd percorso\spediresicuro`
- [ ] `git pull origin master`
- [ ] `npm install` (se necessario)
- [ ] `npm run dev`

### Prima di Tornare al Lavoro:
- [ ] `git add .`
- [ ] `git commit -m "Messaggio"`
- [ ] `git config user.name` (verifica)
- [ ] `git push origin master`

---

## 🎯 VANTAGGI

✅ **Sincronizzazione automatica** tra tutti i PC  
✅ **Backup automatico** su GitHub  
✅ **Storia completa** di tutte le modifiche  
✅ **Lavora ovunque** tu sia  
✅ **Zero perdita di dati**

---

## 📞 SE HAI PROBLEMI

1. **Controlla la connessione internet**
2. **Verifica account Git**: `git config user.name`
3. **Verifica repository**: `git remote -v`
4. **Leggi gli errori** nel terminale

---

## 🚀 PRONTO!

Ora puoi lavorare da qualsiasi posto! Basta:
1. **Scaricare** il progetto (prima volta)
2. **Sincronizzare** con `git pull` (ogni volta)
3. **Salvare** con `git push` (quando finisci)

**Buon lavoro da casa!** 🏠💻

