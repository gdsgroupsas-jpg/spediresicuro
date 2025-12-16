# 🎯 ISTRUZIONI REPOSITORY - PER TUTTE LE AI

> **⚠️ LEGGERE PRIMA DI QUALSIASI OPERAZIONE GIT!**

---

## 📍 QUALE REPOSITORY USARE?

### ✅ REPOSITORY CORRETTO (UNICO E SOLO)

**Percorso locale:**
```
C:\spediresicuro-master
```

**Repository remoto:**
```
https://github.com/gdsgroupsas-jpg/spediresicuro.git
```

**Branch principale:**
```
master
```

**Account GitHub:**
```
gdsgroupsas-jpg
```

---

## 🚫 COSE DA NON FARE MAI

### ❌ NON creare cartelle duplicate
- **NON** creare una cartella `spediresicuro` dentro `spediresicuro-master`
- **NON** clonare il repository dentro se stesso
- **NON** creare submodule o repository annidati

### ❌ NON usare repository diversi
- **NON** usare altri percorsi o cartelle
- **NON** lavorare su repository clonati altrove
- **NON** creare worktree o branch separati senza motivo

---

## ✅ COSE DA FARE SEMPRE

### 1. Verificare il repository corretto
Prima di qualsiasi operazione git, verificare:
```powershell
cd C:\spediresicuro-master
git remote -v
```

Deve mostrare:
```
origin  https://github.com/gdsgroupsas-jpg/spediresicuro.git (fetch)
origin  https://github.com/gdsgroupsas-jpg/spediresicuro.git (push)
```

### 2. Verificare account Git
```powershell
git config user.name
```

Deve essere: `gdsgroupsas-jpg`

### 3. Lavorare sempre dalla root
Tutte le operazioni git devono essere fatte da:
```
C:\spediresicuro-master
```

**NON** da sottocartelle!

---

## 🔄 OPERAZIONI GIT STANDARD

### Sincronizzazione con remoto
```powershell
cd C:\spediresicuro-master
git fetch --all
git pull origin master
```

### Verifica stato
```powershell
cd C:\spediresicuro-master
git status
```

### Commit e push
```powershell
cd C:\spediresicuro-master
git add .
git commit -m "messaggio"
git push origin master
```

---

## 🌿 Branch di lavoro

- Sono ammessi branch temporanei (feature/*, fix/*)
- Devono SEMPRE partire da `master`
- Devono essere mergiati su `master` e poi eliminati
- Vietato lavorare a lungo su branch non allineati

---

## 📋 STRUTTURA REPOSITORY

Il repository contiene:
- `app/` - Applicazione Next.js
- `components/` - Componenti React
- `lib/` - Librerie e utilities
- `actions/` - Server Actions
- `automation-service/` - Servizio automation standalone
- `supabase/` - Migrations database
- `docs/` - Documentazione
- `scripts/` - Script di utilità

**TUTTO in un unico repository, nessuna duplicazione!**

---

## 🆘 SE VEDI ERRORI STRANI

### Errore: "Repository duplicato" o "Submodule"
**Soluzione:** Verifica di essere in `C:\spediresicuro-master` e NON in sottocartelle

### Errore: "Remote diverso"
**Soluzione:** 
```powershell
cd C:\spediresicuro-master
git remote set-url origin https://github.com/gdsgroupsas-jpg/spediresicuro.git
```

### Errore: "Account Git sbagliato"
**Soluzione:**
```powershell
cd C:\spediresicuro-master
git config user.name "gdsgroupsas-jpg"
git config user.email "tua-email@example.com"
```

---

## 📝 REGOLE D'ORO

1. **UN SOLO REPOSITORY**: `C:\spediresicuro-master`
2. **UN SOLO REMOTO**: `https://github.com/gdsgroupsas-jpg/spediresicuro.git`
3. **UN SOLO BRANCH PRINCIPALE**: `master`
4. **NON CREARE DUPLICAZIONI**: Mai cartelle o repository annidati
5. **VERIFICARE SEMPRE**: Prima di operazioni git, controlla percorso e remote
6. **SE NON SEI SICURO: STOP**  
   Se il percorso, il branch o il remoto non sono chiari,  
   NON eseguire operazioni git e chiedere conferma.

---

## 🎯 PER LE AI

Quando ricevi una richiesta che coinvolge git:

1. ✅ Verifica di essere in `C:\spediresicuro-master`
2. ✅ Controlla `git remote -v` per confermare il remoto corretto
3. ✅ Usa `git status` per vedere lo stato
4. ✅ **NON** creare mai cartelle duplicate o repository annidati
5. ✅ Se vedi confusione, fermati e chiedi chiarimenti

---

**Data creazione:** 2025-01-27  
**Versione:** 1.0  
**Stato:** ✅ ATTIVO - SEGUIRE SEMPRE

