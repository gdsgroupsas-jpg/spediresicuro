# 🔧 Fix Dockerfile Railway - Istruzioni

**Problema:** Railway non trova il Dockerfile

**Errore:** `Dockerfile './Dockerfile' does not exist`

---

## ✅ SOLUZIONE

Il problema è che Railway cerca il Dockerfile nella **root del repository**, ma il Dockerfile è in `automation-service/`.

### Opzione 1: Configura Root Directory (CONSIGLIATO)

1. **Vai su Railway Dashboard**
2. **Settings → Source**
3. **Root Directory:** Imposta `automation-service`
4. **Salva**

Railway cambierà la working directory a `automation-service/` e troverà il Dockerfile.

### Opzione 2: Verifica Config as Code

Se hai configurato "Config as Code":
- **File:** `automation-service/railway.toml`
- **Percorso Dockerfile:** `Dockerfile` (senza `./`)

---

## 🔍 VERIFICA

Dopo aver configurato Root Directory:

1. **Vai su "Deployments"**
2. **Clicca "Redeploy"** (o aspetta il deploy automatico)
3. **Controlla i log** - dovrebbe trovare il Dockerfile

---

## 📋 CHECKLIST

- [ ] Root Directory configurato: `automation-service`
- [ ] Dockerfile esiste in `automation-service/Dockerfile`
- [ ] File committato su Git
- [ ] Railway ha fatto pull dell'ultimo commit
- [ ] Deploy avviato

---

## 🐛 SE ANCORA NON FUNZIONA

### Verifica Dockerfile su Git

```bash
git ls-files automation-service/Dockerfile
```

Dovrebbe mostrare: `automation-service/Dockerfile`

### Verifica Root Directory

Su Railway Dashboard:
- Settings → Source → Root Directory
- Deve essere: `automation-service` (senza slash finale)

### Verifica Config as Code

Se usi Config as Code:
- Settings → Config-as-code
- File: `automation-service/railway.toml`

---

## ✅ DOPO IL FIX

Railway dovrebbe:
1. ✅ Trovare il Dockerfile
2. ✅ Fare build del container
3. ✅ Deployare il servizio

---

**Se hai ancora problemi, dimmi cosa vedi nei log!** 🚀


