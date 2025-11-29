# 🔍 Guida Errori Comuni - SpedireSicuro

**Come interpretare e risolvere gli errori più comuni**

---

## 📋 Come Condividere un Errore

Quando vedi un errore, condividi:
1. **Messaggio completo** (copia-incolla)
2. **Dove appare** (browser console, terminale server, pagina web)
3. **Quando succede** (all'avvio, usando OCR, export, etc.)

---

## 🚨 Errori Comuni

### 1. **Errore OCR**

#### Errore: `Cannot find module 'tesseract.js'`
```
Error: Cannot find module 'tesseract.js'
```

**Cosa significa:**
- Tesseract.js non è installato o non è stato trovato

**Soluzione:**
```bash
npm install tesseract.js
```

**Alternativa:**
- Il sistema userà automaticamente il mock migliorato
- Funziona comunque, ma non analizza l'immagine reale

---

#### Errore: `Servizio OCR non disponibile`
```
Errore: Servizio OCR non disponibile. Contattare l'amministratore.
```

**Cosa significa:**
- L'adapter OCR non è disponibile

**Soluzione:**
- Verifica che il server sia avviato
- Controlla la console del server per errori
- Il mock OCR dovrebbe sempre funzionare

---

#### Errore: `Errore durante l'estrazione OCR`
```
Errore: Errore durante l'estrazione OCR
```

**Cosa significa:**
- Problema durante l'analisi dell'immagine

**Possibili cause:**
- Immagine troppo grande (>10MB)
- Formato immagine non supportato
- Problema con Tesseract (se installato)

**Soluzione:**
- Usa immagini più piccole (<10MB)
- Formati supportati: JPG, PNG, GIF
- Se persiste, il sistema userà il mock

---

### 2. **Errore Export**

#### Errore: `Formato non supportato`
```
Error: Formato non supportato: pdf
```

**Cosa significa:**
- Il formato di export richiesto non è disponibile

**Soluzione:**
- Verifica che `jspdf` e `xlsx` siano installati:
  ```bash
  npm install jspdf jspdf-autotable xlsx
  ```

---

#### Errore: `Librerie PDF non installate`
```
Error: Librerie PDF non installate. Eseguire: npm install jspdf jspdf-autotable
```

**Cosa significa:**
- Le librerie per generare PDF non sono installate

**Soluzione:**
```bash
npm install jspdf jspdf-autotable
```

---

#### Errore: `Libreria xlsx non installata`
```
Error: Libreria xlsx non installata. Eseguire: npm install xlsx
```

**Cosa significa:**
- La libreria per generare Excel non è installata

**Soluzione:**
```bash
npm install xlsx
```

---

### 3. **Errore Build/Compilazione**

#### Errore: `Module not found: Can't resolve 'jspdf'`
```
Module not found: Can't resolve 'jspdf'
```

**Cosa significa:**
- Il modulo jspdf non è installato o non è stato trovato

**Soluzione:**
```bash
npm install jspdf jspdf-autotable
npm run dev  # Riavvia il server
```

---

#### Errore: `Fast Refresh had to perform a full reload`
```
⚠ Fast Refresh had to perform a full reload due to a runtime error.
```

**Cosa significa:**
- Errore durante il hot-reload di Next.js
- **Non è critico** - Next.js ha fatto un reload completo

**Soluzione:**
- Di solito si risolve automaticamente
- Se persiste, riavvia il server

---

### 4. **Errore API**

#### Errore: `404 Not Found` su `/api/ocr/extract`
```
GET /api/ocr/extract 404
```

**Cosa significa:**
- L'endpoint API non esiste o non è raggiungibile

**Soluzione:**
- Verifica che il file `app/api/ocr/extract/route.ts` esista
- Riavvia il server

---

#### Errore: `500 Internal Server Error`
```
POST /api/ocr/extract 500
```

**Cosa significa:**
- Errore interno del server durante l'elaborazione

**Soluzione:**
- Controlla la console del server per dettagli
- Verifica che le dipendenze siano installate
- Controlla i log per errori specifici

---

### 5. **Errore Browser**

#### Errore: `Failed to fetch`
```
Error: Failed to fetch
```

**Cosa significa:**
- Problema di connessione con il server

**Soluzione:**
- Verifica che il server sia avviato (`npm run dev`)
- Controlla che l'URL sia corretto (`http://localhost:3000`)
- Verifica la console del browser (F12) per dettagli

---

#### Errore: `NetworkError when attempting to fetch resource`
```
NetworkError when attempting to fetch resource
```

**Cosa significa:**
- Problema di rete o CORS

**Soluzione:**
- Verifica che il server sia avviato
- Controlla la console del browser per dettagli
- Riavvia il server se necessario

---

## 🔧 Come Risolvere Errori

### Step 1: Identifica l'Errore
1. Apri la console del browser (F12)
2. Vai alla tab "Console" o "Network"
3. Cerca messaggi in rosso
4. Copia il messaggio completo

### Step 2: Controlla il Server
1. Guarda il terminale dove gira `npm run dev`
2. Cerca messaggi di errore
3. Copia anche quelli

### Step 3: Verifica Dipendenze
```bash
# Verifica che tutto sia installato
npm list jspdf jspdf-autotable xlsx tesseract.js

# Se manca qualcosa, installa
npm install
```

### Step 4: Riavvia
```bash
# Ferma il server (Ctrl+C)
# Riavvia
npm run dev
```

---

## 📝 Checklist Debug

Quando hai un errore, verifica:

- [ ] Server avviato? (`npm run dev`)
- [ ] Dipendenze installate? (`npm install`)
- [ ] Console browser aperta? (F12)
- [ ] Console server controllata?
- [ ] Errore copiato completamente?
- [ ] Quando succede? (quale azione)

---

## 💡 Suggerimenti

1. **Sempre copia l'errore completo** - aiuta a capire il problema
2. **Controlla entrambe le console** - browser e server
3. **Riavvia il server** dopo installazioni
4. **Verifica le dipendenze** se vedi "Module not found"

---

## 🆘 Se Niente Funziona

1. **Ferma tutto:**
   ```bash
   # Ferma il server (Ctrl+C)
   ```

2. **Pulisci e reinstalla:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Riavvia:**
   ```bash
   npm run dev
   ```

---

**Condividi l'errore completo e ti aiuto a risolverlo!** 🚀

