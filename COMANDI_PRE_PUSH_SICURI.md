# 🚀 COMANDI PRE-PUSH SICURI

## ⚠️ ATTENZIONE: `data/database.json` contiene dati reali!

Il file `data/database.json` contiene:
- ✅ Nomi, indirizzi, email, telefoni di utenti reali
- ✅ Dati spedizioni
- ✅ Potenzialmente credenziali integrazioni

**DEVE essere ignorato da Git!**

---

## 🔧 FIX IMMEDIATO

### 1. Rimuovi database.json da Git (se già tracciato)

```bash
# Rimuovi dal tracking Git (ma mantieni il file locale)
git rm --cached data/database.json

# Commit la rimozione
git add .gitignore
git commit -m "security: add database.json to .gitignore"
```

### 2. Verifica che .gitignore funzioni

```bash
# Verifica che database.json sia ignorato
git status
# Non dovrebbe apparire data/database.json
```

---

## ✅ CHECKLIST PRE-PUSH

Esegui questi comandi PRIMA di fare push:

### 1. Verifica file sensibili tracciati

```bash
# Windows CMD
git ls-files | findstr /i "\.env database.json"

# Dovrebbe essere VUOTO (nessun output)
```

### 2. Verifica cosa verrà committato

```bash
git status
git diff --cached --name-only
```

**Assicurati che NON ci siano:**
- ❌ `.env.local`
- ❌ `.env`
- ❌ `data/database.json`
- ❌ File con secrets hardcoded

### 3. Se tutto OK, procedi

```bash
# Aggiungi solo file sicuri
git add .

# Verifica ancora una volta
git status

# Commit
git commit -m "feat: integrazioni e-commerce e setup lavoro remoto"

# Push
git push origin master
```

---

## 🔒 PROTEZIONI AGGIUNTE

Ho aggiornato `.gitignore` per includere:

```gitignore
# Database locale (contiene dati sensibili)
data/database.json

# Environment files
.env*.local
.env
.env.production
.env.development

# Credenziali
*.key
*.pem
*.p12
*.pfx

# Logs
*.log
```

---

## 📋 VERIFICA POST-PUSH

Dopo il push, verifica su GitHub:

1. **Vai su:** `https://github.com/gdsgroupsas-jpg/spediresicuro`
2. **Cerca:** `database.json` o `.env.local`
3. **Dovrebbe:** Non trovare nulla (404 o file non presente)

---

## 🛡️ RACCOMANDAZIONE FINALE

**Per una repo PUBBLICA:**

1. ✅ **Rendi la repo PRIVATA** se possibile
   - GitHub: Settings → Change repository visibility → Make private
   - Gratuito per account personali

2. ✅ **Usa GitHub Secrets** per CI/CD
   - Settings → Secrets and variables → Actions

3. ✅ **Usa Vercel Environment Variables** per deploy
   - Dashboard Vercel → Project → Settings → Environment Variables

---

## ⚠️ SE HAI GIÀ COMMITTATO DATI SENSIBILI

### Opzione 1: Rimuovi e Rigenera (Consigliato)

1. **Rimuovi file dalla repo:**
   ```bash
   git rm --cached data/database.json
   git commit -m "security: remove sensitive database file"
   ```

2. **Rigenera database.json locale:**
   - Il file rimane sul tuo computer
   - Verrà ricreato automaticamente quando l'app lo usa

### Opzione 2: Rovina Secrets (Se necessario)

Se hai committato secrets reali:
- Vai su console provider (Google, GitHub, Supabase)
- Revoca/rigenera tutte le chiavi esposte
- Crea nuove chiavi

---

**🔒 SICUREZZA PRIMA DI TUTTO!**

