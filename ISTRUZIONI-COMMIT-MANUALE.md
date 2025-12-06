# 📝 ISTRUZIONI COMMIT E PUSH MANUALE

## 🎯 PROBLEMA

I comandi Git potrebbero non funzionare correttamente nel terminale. Ecco come fare manualmente.

## ✅ METODO 1: USA IL FILE .BAT

1. **Apri il file**: `ESEGUI-COMMIT-PUSH.bat`
2. **Clicca destro** → **Esegui come amministratore**
3. **Segui le istruzioni** che appaiono

## ✅ METODO 2: COMANDI MANUALI

Apri PowerShell o Git Bash e esegui:

```bash
cd c:\spediresicuro-master\spediresicuro

# Verifica stato
git status

# Aggiungi file
git add automation-service/src/agent.ts

# Crea commit
git commit -m "fix: Correggi errore TypeScript - Array.from NodeListOf per .find() su cells"

# Push su GitHub
git push origin master

# Verifica
git log --oneline -3
```

## ✅ METODO 3: USA GITHUB DESKTOP O VS CODE

### Con VS Code:
1. Apri VS Code nella cartella `c:\spediresicuro-master\spediresicuro`
2. Vai su **Source Control** (icona Git a sinistra)
3. Vedi `automation-service/src/agent.ts` nella lista
4. Clicca **+** per aggiungere al staging
5. Scrivi messaggio: `fix: Correggi errore TypeScript - Array.from NodeListOf per .find() su cells`
6. Clicca **✓ Commit**
7. Clicca **...** → **Push**

### Con GitHub Desktop:
1. Apri GitHub Desktop
2. Seleziona il repository `spediresicuro`
3. Vedi `automation-service/src/agent.ts` modificato
4. Scrivi messaggio: `fix: Correggi errore TypeScript - Array.from NodeListOf per .find() su cells`
5. Clicca **Commit to master**
6. Clicca **Push origin**

## 🔍 VERIFICA

Dopo il push, verifica su GitHub:
1. Vai su: https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
2. Dovresti vedere il nuovo commit
3. Apri il commit e verifica che `agent.ts` contenga `Array.from(cellsNodeList)`

---

**USA UNO DEI METODI SOPRA PER FARE COMMIT E PUSH!** ✅
