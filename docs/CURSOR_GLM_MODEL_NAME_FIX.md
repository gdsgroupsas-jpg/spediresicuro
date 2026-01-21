# 🔧 Fix: Model Name in Cursor - Dove Inserirlo

## ❌ Problema: Campo "Model Name" non visibile

In Cursor, quando configuri un provider personalizzato, il campo **"Model Name"** potrebbe **non essere visibile di default** o essere in un posto diverso.

---

## ✅ Soluzioni

### Opzione 1: Il Model Name è nel Nome del Provider

In alcune versioni di Cursor, il **nome del modello** è lo stesso del **nome del provider**.

**Come fare:**

1. Vai su **Settings** → **Models**
2. Seleziona il provider "GLM 4.7"
3. Cerca un campo **"Name"** o **"Provider Name"**
4. Impostalo come: `GLM-4.7`
5. Salva

---

### Opzione 2: Model Name è un campo nascosto

Il campo potrebbe essere visibile solo dopo aver salvato il provider.

**Come fare:**

1. Vai su **Settings** → **Models**
2. Seleziona il provider
3. **Salva** le impostazioni (anche se non hai cambiato nulla)
4. **Riapri** le impostazioni del provider
5. Dovrebbe apparire il campo "Model Name"

---

### Opzione 3: Model Name va inserito nell'URL o nella configurazione avanzata

Alcune versioni di Cursor permettono di specificare il modello nell'URL o in campi avanzati.

**Come fare:**

1. Vai su **Settings** → **Models**
2. Seleziona il provider
3. Cerca:
   - Campo **"Advanced Settings"** o **"Additional Parameters"**
   - Oppure modifica il **Base URL** aggiungendo il modello:
     - `https://api.z.ai/api/coding/paas/v4?model=GLM-4.7`
   - Oppure cerca un campo **"Default Model"** o **"Model"**

---

### Opzione 4: Il modello viene selezionato automaticamente

In alcune configurazioni, Cursor usa automaticamente il modello basandosi sull'endpoint.

**Verifica:**

1. Vai su **Settings** → **Models**
2. Seleziona il provider
3. Verifica che:
   - **Base URL** sia: `https://api.z.ai/api/coding/paas/v4`
   - **API Key** sia inserita
4. **Salva**
5. Vai al **menu modelli in alto**
6. Dovresti vedere "GLM-4.7" o simile nella lista
7. **Selezionalo** manualmente

---

### Opzione 5: Ricrea il Provider con Nome Corretto

Se nulla funziona, ricrea il provider con il nome corretto fin dall'inizio.

**Procedura:**

1. **Elimina** il provider esistente (icona cestino)
2. **Crea nuovo provider**:
   - Settings → Models → **Add Custom Model** o **Add Provider**
   - **Name/Provider Name**: `GLM-4.7` (usa questo come nome!)
   - **Protocol**: `OpenAI Protocol`
   - **API Key**: [la tua chiave Z.AI]
   - **Base URL**: `https://api.z.ai/api/coding/paas/v4`
3. **Salva**
4. Il modello dovrebbe apparire come "GLM-4.7" nella lista

---

## 🔍 Verifica Configurazione Corretta

Dopo aver configurato, verifica:

### Checklist:

- [ ] Provider creato con nome che contiene "GLM-4.7"
- [ ] Base URL: `https://api.z.ai/api/coding/paas/v4`
- [ ] API Key inserita e attiva
- [ ] Provider salvato
- [ ] "GLM-4.7" o simile appare nel menu modelli in alto
- [ ] Modello selezionato nel menu

---

## 🎯 Test Finale

1. **Seleziona "GLM-4.7"** dal menu modelli in alto
2. Apri **Cursor Chat**
3. Scrivi: _"Ciao"_
4. Dovrebbe rispondere

---

## 🐛 Se Ancora Non Funziona

### Verifica Account Z.AI:

1. Vai su https://z.ai
2. Verifica:
   - Account attivo
   - GLM Coding Plan attivo
   - Crediti disponibili
   - API Key valida

### Verifica Endpoint:

Il Base URL **DEVE** essere:

```
https://api.z.ai/api/coding/paas/v4
```

**NON**:

```
https://api.z.ai/api/paas/v4  ❌
```

### Riavvia Cursor:

1. Chiudi completamente Cursor
2. Riapri Cursor
3. Riprova

---

## 📸 Screenshot Utili

Se puoi, fai uno screenshot di:

1. La schermata **Settings → Models** con il provider selezionato
2. Tutti i campi visibili nella configurazione del provider

Questo mi aiuterà a capire esattamente dove inserire il Model Name nella tua versione di Cursor.

---

_Ultimo aggiornamento: 2025-01-27_
