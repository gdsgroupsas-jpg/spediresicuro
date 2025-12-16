# 🔍 Verifica ANTHROPIC_API_KEY in Locale

## ⚠️ Problema Comune

Hai la chiave corretta in `.env.local` ma il server dice che non la trova.

## 🔍 Verifica Passo-Passo

### 1. **Controlla che `.env.local` Esista**

```bash
# Dalla root del progetto
dir .env.local
```

Se non esiste, crealo.

### 2. **Verifica il Contenuto di `.env.local`**

Apri `.env.local` e verifica che ci sia:

```env
ANTHROPIC_API_KEY=sk-ant-api03-ABC123XYZ789...
```

**⚠️ IMPORTANTE:**
- ✅ NO spazi prima o dopo il `=`
- ✅ NO virgolette attorno al valore
- ✅ NO `#` all'inizio (non commentata)
- ✅ La chiave inizia con `sk-ant-api03-`

### 3. **Riavvia il Server**

**CRITICO**: Dopo aver modificato `.env.local`, **sempre riavviare**:

```bash
# 1. Ferma il server (Ctrl+C nella console)
# 2. Riavvia
npm run dev
```

### 4. **Controlla i Log del Server**

Quando invii un messaggio ad Anne, guarda la console del server. Dovresti vedere:

```
🔍 [Anne] Verifica Environment Variables (runtime):
   ANTHROPIC_API_KEY presente: true
   ANTHROPIC_API_KEY lunghezza: 100+
   ANTHROPIC_API_KEY primi 20 char: sk-ant-api03-...
✅ [Anne] ANTHROPIC_API_KEY trovata, creo client
```

Se vedi:
```
❌ [Anne] ANTHROPIC_API_KEY NON TROVATA!
```

Allora il problema è che Next.js non sta leggendo la variabile.

## 🛠️ Soluzioni

### Soluzione 1: Verifica Formato File

Apri `.env.local` e assicurati che sia esattamente così:

```env
ANTHROPIC_API_KEY=sk-ant-api03-ABC123XYZ789...
```

**NON così:**
```env
# ANTHROPIC_API_KEY=sk-ant-...  ❌ (commentata)
ANTHROPIC_API_KEY = sk-ant-...  ❌ (spazi attorno al =)
ANTHROPIC_API_KEY="sk-ant-..."  ❌ (virgolette)
```

### Soluzione 2: Riavvia Completamente

1. Ferma il server (Ctrl+C)
2. Chiudi completamente il terminale
3. Apri un nuovo terminale
4. Vai nella cartella del progetto
5. Avvia: `npm run dev`

### Soluzione 3: Verifica Posizione File

Il file `.env.local` deve essere nella **root del progetto** (stessa cartella di `package.json`):

```
spediresicuro-master/
├── .env.local          ← QUI
├── package.json
├── app/
├── components/
└── ...
```

### Soluzione 4: Pulisci Cache Next.js

A volte Next.js cache le variabili. Prova:

```bash
# Ferma il server
# Pulisci cache
rm -rf .next
# Oppure su Windows:
rmdir /s /q .next

# Riavvia
npm run dev
```

### Soluzione 5: Verifica che la Chiave Funzioni

Testa direttamente la chiave:

```bash
# Sostituisci YOUR_KEY con la tua chiave
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

Se funziona, riceverai una risposta JSON. Se non funziona, la chiave non è valida.

## 📝 Checklist Completa

- [ ] `.env.local` esiste nella root del progetto
- [ ] `ANTHROPIC_API_KEY=sk-ant-...` è presente (senza spazi, senza virgolette, non commentata)
- [ ] Server riavviato dopo aver aggiunto/modificato la chiave
- [ ] Cache `.next` pulita (se necessario)
- [ ] Log del server mostrano "ANTHROPIC_API_KEY presente: true"
- [ ] Chiave testata direttamente con curl (funziona)

## 🆘 Se Ancora Non Funziona

1. **Copia i log completi** del server quando invii un messaggio ad Anne
2. **Verifica** che la chiave funzioni con il test curl sopra
3. **Controlla** che non ci siano caratteri nascosti o spazi in `.env.local`
4. **Prova** a creare una nuova chiave API su console.anthropic.com

---

**Ultimo aggiornamento**: Dicembre 2024
