# 🚨 DEPLOY URGENTE - SEZIONE ANNE

## ⚠️ PROBLEMA
I comandi git non mostrano output nella shell di Cursor. Esegui manualmente questi passaggi.

## ✅ FILE PRONTI
I file sono stati creati correttamente:
- ✅ `spediresicuro/components/homepage/anne-promo-section.tsx`
- ✅ `spediresicuro/app/page.tsx`

## 🚀 DEPLOY MANUALE - 3 MODI

### METODO 1: Script Batch (PIÙ SEMPLICE)
1. Vai nella cartella: `c:\spediresicuro-master\spediresicuro`
2. Fai **doppio clic** su `DEPLOY-ANNE.bat`
3. Lo script eseguirà automaticamente tutti i comandi git
4. Leggi l'output per vedere se è andato tutto bene

### METODO 2: Terminale PowerShell
Apri PowerShell nella cartella `c:\spediresicuro-master\spediresicuro` e esegui:

```powershell
# Aggiungi file
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx

# Commit
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"

# Push (sostituisci 'main' con il tuo branch se diverso)
git push origin main
```

### METODO 3: Terminale Git Bash
Apri Git Bash nella cartella `c:\spediresicuro-master\spediresicuro` e esegui:

```bash
git add components/homepage/anne-promo-section.tsx app/page.tsx
git commit -m "Aggiunta sezione promozionale Anne sulla homepage"
git push origin main
```

## 🔍 VERIFICA DEPLOY

### 1. Verifica su Vercel
1. Vai su: https://vercel.com/dashboard
2. Clicca sul tuo progetto
3. Controlla la sezione **"Deployments"**
4. Dovresti vedere un nuovo deploy in corso o completato

### 2. Verifica su GitHub/GitLab
1. Vai sul tuo repository
2. Controlla i commit recenti
3. Dovresti vedere: "Aggiunta sezione promozionale Anne sulla homepage"

### 3. Verifica in Produzione
1. Vai sulla homepage del tuo sito online
2. Scorri fino alla sezione "Anne Promo Section"
3. Dovresti vedere la nuova sezione con:
   - Logo Anne
   - 6 card con capacità
   - Liste funzionalità
   - Box testimonial
   - Pulsanti CTA

## 🐛 SE IL PUSH FALLISCE

### Errore: "No remote configured"
```bash
git remote add origin <URL_DEL_TUO_REPOSITORY>
git push -u origin main
```

### Errore: "Permission denied"
- Verifica di avere i permessi sul repository
- Controlla le credenziali git: `git config --list`

### Errore: "Branch not found"
- Verifica il nome del branch: `git branch`
- Usa il nome corretto nel push: `git push origin <NOME_BRANCH>`

## ⏱️ TEMPI
- **Push**: 10-30 secondi
- **Deploy Vercel**: 2-5 minuti
- **Totale**: ~5 minuti

## 📞 SE NULLA FUNZIONA
1. Verifica che Git sia installato: `git --version`
2. Verifica che ci sia un repository: `ls -la .git` (o `dir .git` su Windows)
3. Verifica il remote: `git remote -v`
4. Se necessario, configura git:
   ```bash
   git config --global user.name "Tuo Nome"
   git config --global user.email "tua@email.com"
   ```

---

**IMPORTANTE**: Dopo il push, Vercel dovrebbe avviare il deploy automaticamente. Se non parte, vai su Vercel Dashboard e fai "Redeploy" manuale.

