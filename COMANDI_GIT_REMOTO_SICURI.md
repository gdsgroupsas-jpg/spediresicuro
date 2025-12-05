# 🔄 Comandi Git Remoto - Versione Sicura

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## 🎯 SITUAZIONE

- ✅ Deploy funzionante su Vercel (push di qualche ora fa)
- ✅ Vuoi lavorare in remoto senza rompere nulla
- ✅ ENCRYPTION_KEY già configurata

---

## ✅ STRATEGIA CONSIGLIATA

### **1. PRIMA: Testa Automation (Senza Push)**

**Non serve push per testare!**

1. Vai su `https://tuo-dominio.vercel.app/dashboard/admin/automation`
2. Configura automation settings
3. Testa sync manuale
4. Verifica che funzioni

**Se funziona:** ✅ Perfetto!

**Se non funziona:** Dimmi cosa vedi, risolviamo insieme

---

## 🔄 SE VUOI FARE PUSH (Dopo Aver Testato)

### **Opzione A: Push Diretto su Master** (Se Sicuro)

```bash
# 1. Verifica account Git
git config user.name
# Deve essere: gdsgroupsas-jpg
# Se non lo è:
git config user.name "gdsgroupsas-jpg"

# 2. Sincronizza con remoto
git pull origin master

# 3. Aggiungi modifiche
git add .

# 4. Commit
git commit -m "feat: sistema automation Spedisci.Online completo"

# 5. Push
git push origin master
```

**⚠️ ATTENZIONE:**
- Push su master → Deploy automatico su Vercel
- Se qualcosa va male, vedi rollback sotto

### **Opzione B: Branch di Test** (Più Sicuro)

```bash
# 1. Crea branch di test
git checkout -b test/automation-system

# 2. Aggiungi modifiche
git add .

# 3. Commit
git commit -m "feat: sistema automation Spedisci.Online"

# 4. Push su branch di test
git push origin test/automation-system

# 5. Testa (se hai Vercel Preview configurato)
# Oppure testa direttamente su produzione se sei sicuro

# 6. Se tutto OK, merge su master
git checkout master
git merge test/automation-system
git push origin master
```

---

## 🔄 ROLLBACK (Se Qualcosa Va Male)

### **Opzione 1: Rollback Vercel** (Più Facile)

1. Vai su **Vercel Dashboard** → **Deployments**
2. Trova deploy funzionante (quello di qualche ora fa)
3. Clicca **"..."** → **"Promote to Production"**
4. ✅ Deploy funzionante torna attivo

**Vantaggi:**
- ✅ Non tocchi Git
- ✅ Rollback immediato
- ✅ Nessun rischio

### **Opzione 2: Rollback Git**

```bash
# 1. Vedi ultimi commit
git log --oneline -10

# 2. Torna a commit funzionante (es: abc123)
git reset --hard abc123

# 3. Force push (ATTENZIONE!)
git push origin master --force
```

---

## ✅ CHECKLIST RAPIDA

### **Prima di Push:**

- [ ] Testato automation nella dashboard (già online)
- [ ] Verificato che funzioni
- [ ] Preparato rollback (Vercel o Git)
- [ ] Verificato account Git (`gdsgroupsas-jpg`)

### **Dopo Push:**

- [ ] Verificato che deploy Vercel sia OK
- [ ] Testato automation su produzione
- [ ] Tutto funziona? ✅ Perfetto!

---

## 🎯 RACCOMANDAZIONE FINALE

**Per Te:**

1. **PRIMA:** Testa automation nella dashboard (non serve push)
2. **POI:** Se funziona, fai push quando vuoi
3. **SE PROBLEMI:** Usa rollback Vercel (più facile)

**Non serve push per testare!**

Le migration sono già eseguite, la dashboard è già online, puoi testare subito.

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0

