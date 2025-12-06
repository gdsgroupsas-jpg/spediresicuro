# 🚀 ISTRUZIONI PUSH ANNE FRONTEND

## ⚠️ PROBLEMA

Il commit di Anne frontend NON è visibile su GitHub. Devo fare push manualmente.

## ✅ SOLUZIONE

### METODO 1: USA IL FILE .BAT (CONSIGLIATO)

1. **Apri il file**: `PUSHA-ANNE-FRONTEND.bat`
2. **Clicca destro** → **Esegui come amministratore**
3. **Segui le istruzioni** che appaiono
4. **Verifica** che il commit appaia su GitHub

### METODO 2: COMANDI MANUALI

Apri PowerShell o Git Bash e esegui:

```bash
cd c:\spediresicuro-master\spediresicuro

# Verifica file
dir components\homepage\anne-promo-section.tsx

# Aggiungi file
git add components/homepage/anne-promo-section.tsx
git add app/page.tsx
git add app/api/ai/agent-chat/route.ts

# Verifica staging
git status

# Crea commit
git commit -m "feat: Aggiunge Anne al frontend - Sezione promozionale homepage + API chat"

# Push
git push origin master

# Verifica
git log --oneline -3
```

### METODO 3: VS CODE

1. Apri VS Code nella cartella `c:\spediresicuro-master\spediresicuro`
2. Vai su **Source Control** (icona Git)
3. Vedi i file modificati:
   - `components/homepage/anne-promo-section.tsx`
   - `app/page.tsx`
   - `app/api/ai/agent-chat/route.ts`
4. Clicca **+** per aggiungere al staging
5. Scrivi messaggio: `feat: Aggiunge Anne al frontend - Sezione promozionale homepage + API chat`
6. Clicca **✓ Commit**
7. Clicca **...** → **Push**

## 🔍 VERIFICA

Dopo il push:
1. Vai su: https://github.com/gdsgroupsas-jpg/spediresicuro/commits/master
2. Dovresti vedere il commit: **"feat: Aggiunge Anne al frontend..."**
3. Clicca sul commit per vedere i file modificati

## 📝 FILE DA PUSHARE

- ✅ `components/homepage/anne-promo-section.tsx`
- ✅ `app/page.tsx` (già modificato per includere Anne)
- ✅ `app/api/ai/agent-chat/route.ts` (se non già pushato)

---

**USA IL FILE .BAT PER PUSHARE ANNE!** 🚀
