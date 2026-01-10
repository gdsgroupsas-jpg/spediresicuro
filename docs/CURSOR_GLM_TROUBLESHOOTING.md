# 🔧 Troubleshooting GLM-4.7 in Cursor

## ❌ Problema: Modello non funziona

Se il modello **GLM 4.7** appare nella lista ma **non risponde** o **non funziona**, segui questa guida.

---

## 🔍 Diagnosi Step-by-Step

### 1. Verifica Configurazione Base

#### ✅ Controlla che questi campi siano corretti:

**In Settings → Models → [Il tuo provider GLM-4.7]:**

| Campo | Deve Essere | Come Verificare |
|-------|-------------|-----------------|
| **Protocol** | `OpenAI Protocol` | Apri le impostazioni del provider |
| **OpenAI API Key** | La tua chiave Z.AI completa | Verifica che sia inserita (non masked) |
| **Override OpenAI Base URL** | `https://api.z.ai/api/coding/paas/v4` | ⚠️ **DEVE essere `/api/coding/paas/v4`** |
| **Model Name** | `GLM-4.7` | ⚠️ **ESATTAMENTE così, maiuscolo, con trattino** |

#### ⚠️ Errori Comuni:

1. **Base URL sbagliato**:
   - ❌ `https://api.z.ai/api/paas/v4` (generale)
   - ✅ `https://api.z.ai/api/coding/paas/v4` (coding)

2. **Model Name sbagliato**:
   - ❌ `glm-4.7` (minuscolo)
   - ❌ `GLM4.7` (senza trattino)
   - ❌ `GLM-4.6` (versione sbagliata)
   - ✅ `GLM-4.7` (corretto)

---

### 2. Verifica API Key

#### Problema: API Key non valida o scaduta

**Come verificare:**
1. Vai su https://z.ai
2. Accedi al tuo account
3. Vai su **API Keys**
4. Verifica che la chiave sia:
   - ✅ **Attiva**
   - ✅ **Del GLM Coding Plan** (non quella generale)
   - ✅ **Con crediti disponibili**

**Soluzione:**
- Se la chiave non è valida, genera una nuova API Key
- Sostituiscila in Cursor Settings → Models

---

### 3. Verifica Selezione Modello

#### Problema: Modello non selezionato

**Come verificare:**
1. Guarda il menu a tendina dei modelli **in alto** in Cursor
2. Verifica che sia selezionato **"GLM 4.7"** o **"GLM-4.7"**

**Soluzione:**
- Seleziona manualmente "GLM 4.7" dal menu

---

### 4. Test Connessione

#### Problema: Errore di connessione

**Test rapido:**
1. Apri Cursor Chat
2. Seleziona "GLM 4.7"
3. Chiedi: *"Ciao"*
4. Guarda cosa succede:
   - ✅ Risponde → Funziona!
   - ❌ Errore → Vedi punto 5
   - ❌ Non succede nulla → Vedi punto 6

---

### 5. Errori Specifici

#### ❌ "Invalid API Key"

**Causa**: Chiave API non valida o scaduta

**Soluzione**:
1. Genera nuova API Key su Z.AI
2. Sostituiscila in Cursor
3. Riavvia Cursor

#### ❌ "Model not found" o "Invalid model"

**Causa**: Model Name sbagliato o Base URL errato

**Soluzione**:
1. Verifica che Model Name sia esattamente: `GLM-4.7`
2. Verifica che Base URL sia: `https://api.z.ai/api/coding/paas/v4`
3. Salva e riprova

#### ❌ "Connection error" o "Network error"

**Causa**: Problema di connessione o URL errato

**Soluzione**:
1. Verifica connessione internet
2. Controlla che l'URL sia corretto: `/api/coding/paas/v4`
3. Prova a disabilitare temporaneamente firewall/antivirus

#### ❌ "Rate limit exceeded" o "Quota exceeded"

**Causa**: Crediti esauriti

**Soluzione**:
1. Vai su Z.AI e verifica crediti
2. Ricarica il tuo account se necessario

---

### 6. Modello non risponde (nessun errore)

#### Possibili cause:

1. **Modello non selezionato**
   - Verifica che "GLM 4.7" sia selezionato nel menu

2. **Configurazione incompleta**
   - Verifica tutti i campi (vedi punto 1)

3. **Cursor non riavviato**
   - Chiudi completamente Cursor
   - Riapri Cursor
   - Riprova

4. **Cache Cursor**
   - Chiudi Cursor
   - Elimina cache (opzionale)
   - Riapri Cursor

---

## 🔧 Fix Rapido

### Procedura Completa:

1. **Apri Settings → Models**
2. **Seleziona il provider GLM-4.7**
3. **Verifica e correggi**:
   ```
   Protocol: OpenAI Protocol
   API Key: [la tua chiave Z.AI completa]
   Base URL: https://api.z.ai/api/coding/paas/v4
   Model Name: GLM-4.7
   ```
4. **Salva** le modifiche
5. **Seleziona "GLM 4.7"** dal menu modelli in alto
6. **Riavvia Cursor** completamente
7. **Testa** con una domanda semplice: "Ciao"

---

## 📋 Checklist Diagnostica

Compila questa checklist per identificare il problema:

- [ ] Model Name è esattamente `GLM-4.7`?
- [ ] Base URL è `https://api.z.ai/api/coding/paas/v4`?
- [ ] API Key è inserita e non masked?
- [ ] API Key è del GLM Coding Plan?
- [ ] Modello "GLM 4.7" è selezionato nel menu?
- [ ] Cursor è stato riavviato dopo la configurazione?
- [ ] Account Z.AI ha crediti disponibili?
- [ ] Connessione internet funziona?

**Se tutte le risposte sono SÌ ma ancora non funziona:**
- Controlla i log di Cursor per errori specifici
- Prova a creare un nuovo provider da zero
- Contatta supporto Z.AI se il problema persiste

---

## 🆘 Cosa Fare Se Nulla Funziona

### Opzione 1: Ricrea il Provider

1. **Elimina** il provider GLM-4.7 esistente (icona cestino)
2. **Crea nuovo provider**:
   - Settings → Models → Add Custom Model
   - Protocol: `OpenAI Protocol`
   - API Key: [la tua chiave]
   - Base URL: `https://api.z.ai/api/coding/paas/v4`
   - Model Name: `GLM-4.7`
3. **Salva** e **seleziona**
4. **Riavvia Cursor**

### Opzione 2: Verifica Account Z.AI

1. Vai su https://z.ai
2. Verifica:
   - Account attivo
   - GLM Coding Plan attivo
   - Crediti disponibili
   - API Key valida

### Opzione 3: Test API Diretto

Testa l'API direttamente per verificare che funzioni:

```powershell
# Test API Z.AI (sostituisci YOUR_API_KEY)
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @{
    model = "GLM-4.7"
    messages = @(
        @{
            role = "user"
            content = "Ciao"
        }
    )
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.z.ai/api/coding/paas/v4/chat/completions" -Method Post -Headers $headers -Body $body
```

Se questo funziona, il problema è nella configurazione di Cursor.
Se non funziona, il problema è con l'API Key o l'account.

---

## 📚 Riferimenti

- [Z.AI Quick Start](https://docs.z.ai/devpack/quick-start)
- [Z.AI Cursor Setup](https://docs.z.ai/devpack/tool/cursor)
- [Z.AI Developer Portal](https://z.ai)

---

*Ultimo aggiornamento: 2025-01-27*
