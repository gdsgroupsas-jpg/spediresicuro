# 🔧 Soluzione "Risposta Vuota dal Server" - Anne

## 🎯 Problema

Anne mostra "Risposta vuota dal server" anche se la chiave API è corretta.

## ✅ Fix Applicato

Ho corretto un bug nel codice dove:

1. Variabili non definite nel catch block causavano crash
2. La route poteva non restituire una risposta in alcuni casi

## 🔍 Cosa Controllare

### 1. **Riavvia Completamente il Server**

**CRITICO**: Chiudi completamente il terminale e riavvia:

```bash
# 1. Ferma il server (Ctrl+C)
# 2. CHIUDI completamente il terminale
# 3. Apri un NUOVO terminale
# 4. Vai nella cartella
cd d:\spediresicuro-master
# 5. Riavvia
npm run dev
```

### 2. **Controlla i Log del Server**

Quando invii un messaggio ad Anne, **guarda la console del server**. Dovresti vedere:

```
🔍 [Anne] Verifica Environment Variables (runtime):
   ANTHROPIC_API_KEY presente: true/false
   ANTHROPIC_API_KEY lunghezza: X
   ANTHROPIC_API_KEY primi 20 char: sk-ant-api03-...
```

**Se vedi `ANTHROPIC_API_KEY presente: false`**:

- Il file `.env.local` non viene letto
- Riavvia completamente il server
- Verifica che `.env.local` sia nella root del progetto

### 3. **Verifica Formato `.env.local`**

Apri `.env.local` e verifica che sia esattamente così:

```env
ANTHROPIC_API_KEY=sk-ant-api03-ABC123XYZ789...
```

**Controlla**:

- ✅ NO spazi prima/dopo il `=`
- ✅ NO virgolette
- ✅ NO `#` all'inizio
- ✅ La chiave inizia con `sk-ant-api03-`

### 4. **Pulisci Cache Next.js**

A volte Next.js cache le variabili. Prova:

```bash
# Ferma il server
# Pulisci cache
rmdir /s /q .next
# Riavvia
npm run dev
```

## 📝 Checklist

- [ ] Server riavviato completamente (terminale chiuso e riaperto)
- [ ] `.env.local` esiste nella root del progetto
- [ ] `ANTHROPIC_API_KEY=sk-ant-...` è presente (formato corretto)
- [ ] Cache `.next` pulita
- [ ] Log del server mostrano "ANTHROPIC_API_KEY presente: true"

## 🆘 Se Ancora Non Funziona

1. **Copia i log completi** del server quando invii un messaggio
2. **Verifica** che la chiave funzioni con curl (vedi `docs/VERIFICA_ENV_LOCALE.md`)
3. **Controlla** che non ci siano errori nella console del browser (F12 → Console)

---

**Ultimo aggiornamento**: Dicembre 2024
