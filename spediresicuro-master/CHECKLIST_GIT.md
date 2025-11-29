# ✅ Checklist Git - Prima di Ogni Commit/Push

## ⚠️ CONTROLLO OBBLIGATORIO PRIMA DI COMMIT/PUSH MANUALI

### 1. Verifica Account Git
```bash
git config user.name
```
**Deve essere:** `gdsgroupsas-jpg`

Se non lo è, correggi:
```bash
git config user.name "gdsgroupsas-jpg"
git config user.email "tua-email@esempio.com"
```

### 2. Verifica Repository Remota
```bash
git remote -v
```
**Deve essere:** `https://github.com/gdsgroupsas-jpg/spediresicuro.git`

### 3. Verifica Branch
```bash
git branch
```
**Deve essere:** `master` (o il branch su cui stai lavorando)

### 4. Flusso Corretto

```bash
# 1. Controlla lo stato
git status

# 2. Aggiungi i file modificati
git add .

# 3. Crea commit con descrizione chiara
git commit -m "Descrizione in italiano di cosa hai fatto"

# 4. Carica su GitHub (triggera deploy automatico Vercel)
git push
```

## 🔄 Quando Lavori su Altro PC

**PRIMA di iniziare:**
```bash
git pull  # Scarica le ultime modifiche
```

**DOPO aver finito:**
```bash
git add .
git commit -m "Descrizione modifiche"
git push  # Carica e triggera deploy automatico
```

## ❌ Cosa NON Fare

- ❌ Non fare commit senza verificare l'account Git
- ❌ Non fare push senza aver fatto pull prima (se lavori su altro PC)
- ❌ Non fare commit di file sensibili (.env, password, ecc.)
- ❌ Non fare push su branch sbagliato

