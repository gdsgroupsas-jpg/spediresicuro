# ✅ Soluzione Commit Manuale - Passo Passo

**Problema:** I comandi Git vengono bloccati (probabilmente chiede credenziali o editor).

**Soluzione:** Esegui manualmente questi passaggi.

---

## 🎯 Passo 1: Apri Nuovo Terminale PowerShell

**IMPORTANTE:** Apri un **NUOVO** terminale PowerShell (non quello dove gira `npm run dev`).

1. Premi `Win + X`
2. Seleziona "Windows PowerShell" o "Terminal"
3. Vai nella cartella:
   ```powershell
   cd D:\spediresicuro-master
   ```

---

## 🎯 Passo 2: Verifica Account Git

```powershell
git config user.name
```

**Deve essere:** `gdsgroupsas-jpg`

**Se non lo è:**
```powershell
git config user.name "gdsgroupsas-jpg"
git config user.email "tua-email@esempio.com"
```

---

## 🎯 Passo 3: Aggiungi Modifiche

```powershell
git add .
```

**Output atteso:** Nessun output (normale)

---

## 🎯 Passo 4: Crea Commit

```powershell
git commit -m "feat: integrazione funzionalità Claude - OCR Upload, Filtri avanzati, Export multiplo"
```

**Se chiede credenziali o apre editor:**
- Premi `Esc` se si apre vim
- Poi digita `:q!` e premi Enter per uscire
- Riprova con il comando sopra

---

## 🎯 Passo 5: Push su GitHub

```powershell
git push origin master
```

**Se chiede username/password:**

1. **Username:** `gdsgroupsas-jpg`
2. **Password:** Usa un **Personal Access Token** (NON la password GitHub)

### Come Ottenere Token GitHub:

1. Vai su: https://github.com/settings/tokens
2. Clicca "Generate new token (classic)"
3. Nome: `spediresicuro-push`
4. Scadenza: `90 days` (o `No expiration`)
5. Seleziona scope: ✅ **`repo`** (tutti i permessi repo)
6. Clicca "Generate token"
7. **COPIA IL TOKEN** (lo vedi solo una volta!)
8. Usa il token come password quando Git lo chiede

---

## 🔍 Se Viene Bloccato Ancora

### Opzione A: Usa GitHub Desktop

1. **Apri GitHub Desktop**
2. **File → Add Local Repository**
3. Seleziona: `D:\spediresicuro-master`
4. Vedi modifiche nella tab "Changes"
5. Scrivi messaggio: `feat: integrazione funzionalità Claude`
6. Clicca "Commit to master"
7. Clicca "Push origin"

### Opzione B: Configura Credenziali Windows

```powershell
# Salva credenziali in Windows Credential Manager
git config --global credential.helper wincred
```

Poi riprova il push - Windows salverà le credenziali.

---

## ✅ Checklist

- [ ] Nuovo terminale PowerShell aperto
- [ ] Account Git verificato (`gdsgroupsas-jpg`)
- [ ] `git add .` eseguito
- [ ] `git commit -m "..."` eseguito
- [ ] `git push origin master` eseguito
- [ ] Token GitHub pronto (se necessario)

---

## 🎯 Messaggio Commit Completo

Se vuoi usare il messaggio completo:

```powershell
git commit -m "feat: integrazione funzionalità Claude - OCR Upload, Filtri avanzati, Export multiplo" -m "- Integrato OCR Upload nella pagina nuova spedizione con toggle AI Import" -m "- Aggiunto filtro corriere nella lista spedizioni" -m "- Implementato export multiplo (CSV, XLSX, PDF) usando ExportService" -m "- Migliorato mock OCR con dati più vari e realistici" -m "- Fix Tesseract.js per server-side (usa mock in API routes)" -m "- Fix import dinamico per jspdf e xlsx" -m "- Aggiunta gestione errori migliorata"
```

---

## 🚀 Dopo il Push

1. **Vercel rileverà il push** automaticamente
2. **Deploy in ~2-3 minuti**
3. **Testa su:** `https://www.spediresicuro.it`

---

**Esegui manualmente e dimmi se funziona!** 🚀


