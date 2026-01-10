# 🔧 Configurazione GLM-4.7 in Cursor

## 📋 Istruzioni per Configurare il Modello Z.AI GLM-4.7

### Prerequisiti
- Cursor Pro o versione superiore (necessario per modelli personalizzati)
- Account Z.AI attivo con GLM Coding Plan
- API Key di Z.AI (da https://z.ai)

---

## 🚀 Passaggi di Configurazione

### 1. Aprire la Sezione Models
- In Cursor, vai su **Settings** → **Models**
- Oppure usa il menu a tendina dei modelli in alto

### 2. Aggiungere Nuovo Modello Personalizzato
- Clicca su **"Add Custom Model"** o **"Add Provider"**

### 3. Configurare il Provider
Compila i seguenti campi:

| Campo | Valore |
|-------|--------|
| **Protocol** | `OpenAI Protocol` |
| **OpenAI API Key** | `[LA_TUA_API_KEY_ZAI]` |
| **Override OpenAI Base URL** | `https://api.z.ai/api/coding/paas/v4` |
| **Model Name** | `GLM-4.7` |

⚠️ **IMPORTANTE**: 
- Il nome del modello deve essere in **MAIUSCOLO**: `GLM-4.7`
- Usa l'endpoint **Coding API** (`/api/coding/paas/v4`), NON quello generale
- L'API Key deve essere quella del **GLM Coding Plan**, non quella generale

### 4. Salvare e Selezionare
- Clicca **Save** o **Apply**
- Seleziona il nuovo provider **GLM-4.7** dal menu a tendina dei modelli

---

## ✅ Verifica Configurazione

Dopo la configurazione, dovresti essere in grado di:
- ✅ Vedere "GLM-4.7" nella lista dei modelli disponibili
- ✅ Usare il modello per code generation, debugging, analisi
- ✅ Vedere le risposte generate da GLM-4.7

---

## 🔒 Sicurezza

**⚠️ NON COMMITTARE LA TUA API KEY NEL REPOSITORY!**

- Le impostazioni dei modelli sono salvate localmente in Cursor
- Non includere mai chiavi API in file di progetto
- Se condividi il progetto, rimuovi le chiavi prima del commit

---

## 📚 Riferimenti

- [Documentazione Z.AI Cursor](https://docs.z.ai/devpack/tool/cursor#3-save-and-switch-models)
- [Z.AI Developer Portal](https://z.ai)

---

## 🐛 Troubleshooting

### Il modello non appare
- Verifica di avere Cursor Pro o superiore
- Controlla che l'API Key sia valida
- Verifica che l'endpoint sia corretto: `/api/coding/paas/v4`

### Errori di autenticazione
- Verifica che l'API Key sia del GLM Coding Plan
- Controlla che non ci siano spazi extra nell'API Key
- Assicurati che l'account Z.AI sia attivo

### Il modello non risponde
- Verifica la connessione internet
- Controlla i crediti disponibili sul tuo account Z.AI
- Verifica che il nome del modello sia esattamente `GLM-4.7` (maiuscolo)

---

*Ultimo aggiornamento: 2025-01-27*
