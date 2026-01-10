# 🔧 Configurazione Vision MCP Server Z.AI in Cursor

## 📋 Panoramica

Il **Vision MCP Server** di Z.AI abilita capacità di visione (GLM-4.6V) in Cursor, permettendo:
- 📸 Analisi di immagini e screenshot
- 🎥 Comprensione di video
- 🔍 OCR di screenshot e documenti
- 🎨 Conversione UI in codice
- 📊 Analisi di diagrammi e grafici

---

## ✅ Prerequisiti

- ✅ **Node.js >= v22.0.0** (richiesto dal Vision MCP Server)
- ✅ **Cursor IDE** (supporta MCP)
- ✅ **API Key Z.AI** (GLM Coding Plan)
- ✅ **Account Z.AI attivo** con crediti disponibili

---

## 🚀 Configurazione Automatica

### File Creato

Il file `.cursor/mcp.json` è stato creato con la configurazione corretta:

```json
{
  "mcpServers": {
    "zai-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@z_ai/mcp-server@latest"],
      "env": {
        "Z_AI_API_KEY": "f8b8fb1afbf248249158bad996f6b797.ovSQ6QxU23uqIyov",
        "Z_AI_MODE": "ZAI"
      }
    }
  }
}
```

### Verifica Node.js

⚠️ **IMPORTANTE**: Il Vision MCP Server richiede **Node.js >= v22.0.0**

Verifica la versione attuale:

```powershell
node -v
```

**Stato Attuale**: v20.18.1 (⚠️ **NON COMPATIBILE**)

**Soluzione**: Aggiorna Node.js a v22.0.0 o superiore:
1. Scarica da [nodejs.org](https://nodejs.org/) (versione LTS o Current)
2. Installa la nuova versione
3. Riavvia terminale e Cursor
4. Verifica: `node -v` deve mostrare >= v22.0.0

---

## 🔧 Configurazione Manuale (Alternativa)

Se preferisci configurare tramite l'interfaccia di Cursor:

1. Apri **Cursor Settings**
2. Vai su **Features** → **Model Context Protocol (MCP)**
3. Clicca **+ Add New MCP Server**
4. Compila:
   - **Name**: `zai-mcp-server`
   - **Type**: `stdio`
   - **Command**: `npx`
   - **Args**: `-y`, `@z_ai/mcp-server@latest`
   - **Environment Variables**:
     - `Z_AI_API_KEY`: `f8b8fb1afbf248249158bad996f6b797.ovSQ6QxU23uqIyov`
     - `Z_AI_MODE`: `ZAI`

---

## ✅ Verifica Installazione

### 1. Test Locale

Esegui questo comando per verificare che il server si installi correttamente:

```powershell
$env:Z_AI_API_KEY="f8b8fb1afbf248249158bad996f6b797.ovSQ6QxU23uqIyov"
$env:Z_AI_MODE="ZAI"
npx -y @z_ai/mcp-server@latest
```

Se vedi output senza errori, l'installazione è corretta.

### 2. Riavvia Cursor

Dopo aver creato/modificato `.cursor/mcp.json`, **riavvia Cursor** per caricare la configurazione MCP.

### 3. Verifica Tool Disponibili

Una volta riavviato, i seguenti tool dovrebbero essere disponibili in Cursor Chat:

- ✅ `ui_to_artifact` - Converti screenshot UI in codice
- ✅ `extract_text_from_screenshot` - OCR di screenshot
- ✅ `diagnose_error_screenshot` - Analizza errori da screenshot
- ✅ `understand_technical_diagram` - Interpreta diagrammi tecnici
- ✅ `analyze_data_visualization` - Analizza grafici e dashboard
- ✅ `ui_diff_check` - Confronta due screenshot UI
- ✅ `image_analysis` - Analisi generale immagini
- ✅ `video_analysis` - Analisi video (≤8 MB, MP4/MOV/M4V)

---

## 🎯 Utilizzo

### Esempio 1: Analisi Screenshot

1. Salva un'immagine nel progetto (es: `screenshot.png`)
2. In Cursor Chat, chiedi: *"Cosa descrive screenshot.png?"*
3. Il Vision MCP Server analizzerà l'immagine automaticamente

### Esempio 2: OCR di Codice

1. Fai uno screenshot di codice o terminale
2. Salvalo come `code-screenshot.png`
3. Chiedi: *"Estrai il testo da code-screenshot.png"*

### Esempio 3: Converti UI in Codice

1. Salva uno screenshot di un'interfaccia UI
2. Chiedi: *"Converti ui-screenshot.png in codice React"*

---

## 🐛 Troubleshooting

### ❌ "Connection Closed" o "MCP server connection closed"

**Soluzioni:**
1. Verifica Node.js >= v22.0.0: `node -v`
2. Verifica npx: `npx -v`
3. Controlla che `Z_AI_API_KEY` sia configurata correttamente
4. Riavvia Cursor dopo modifiche a `.cursor/mcp.json`

### ❌ "Invalid API Key"

**Soluzioni:**
1. Verifica che l'API Key sia completa e corretta
2. Controlla che l'API Key sia attiva su Z.AI
3. Verifica che `Z_AI_MODE=ZAI` sia impostato
4. Controlla che l'account Z.AI abbia crediti disponibili

### ❌ "Connection Timeout"

**Soluzioni:**
1. Verifica connessione internet
2. Controlla firewall/antivirus
3. Prova ad aumentare i timeout nelle impostazioni

### ❌ Tool non disponibili in Chat

**Soluzioni:**
1. Riavvia Cursor completamente
2. Verifica che `.cursor/mcp.json` sia nella root del progetto
3. Controlla i log di Cursor per errori MCP
4. Verifica che il server si installi correttamente con `npx`

### ❌ "Node.js version too old"

**⚠️ PROBLEMA ATTUALE**: Node.js v20.18.1 installato, ma serve >= v22.0.0

**Soluzioni:**
1. **Scarica Node.js v22+** da [nodejs.org](https://nodejs.org/)
   - Scegli "Current" (v22+) o "LTS" se disponibile
2. **Installa** la nuova versione (sovrascriverà la vecchia)
3. **Riavvia** terminale PowerShell e Cursor completamente
4. **Verifica**: `node -v` deve mostrare >= v22.0.0
5. **Riprova** la configurazione MCP dopo l'aggiornamento

---

## 📊 Quote e Limiti

Le quote MCP per i piani Z.AI:

| Piano | Web Search/Reader | Vision Understanding |
|-------|------------------|---------------------|
| **Lite** | 100 totali | 5 ore max prompt pool |
| **Pro** | 1,000 totali | 5 ore max prompt pool |
| **Max** | 4,000 totali | 5 ore max prompt pool |

---

## 🔒 Sicurezza

⚠️ **IMPORTANTE**: 
- Il file `.cursor/mcp.json` contiene la tua API Key
- **NON COMMITTARE** questo file nel repository
- Aggiungi `.cursor/mcp.json` al `.gitignore` se non già presente

### Verifica .gitignore

Controlla che `.cursor/mcp.json` sia ignorato:

```bash
# .gitignore dovrebbe contenere:
.cursor/mcp.json
# oppure
.cursor/*
```

---

## 📚 Riferimenti

- [Z.AI Vision MCP Server Docs](https://docs.z.ai/devpack/mcp/vision-mcp-server)
- [Cursor MCP Documentation](https://docs.cursor.com/context/model-context-protocol)
- [Z.AI Developer Portal](https://z.ai)

---

## ✅ Checklist Finale

- [ ] Node.js >= v22.0.0 installato
- [ ] File `.cursor/mcp.json` creato
- [ ] API Key Z.AI configurata correttamente
- [ ] Cursor riavviato
- [ ] Tool MCP visibili in Chat
- [ ] Test funzionante (es: analisi immagine)
- [ ] `.cursor/mcp.json` aggiunto a `.gitignore`

---

*Ultimo aggiornamento: 2025-01-27*
