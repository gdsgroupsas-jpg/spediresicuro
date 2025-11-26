# Sistema di Error Logging Automatico

## 📋 Come Funziona

Il sistema monitora automaticamente gli errori durante lo sviluppo e crea un file `ERROR_LOG.md` che posso leggere per correggere i problemi.

## 🚀 Utilizzo

### 1. Sviluppo con Monitoraggio Errori

```bash
# Invece di: npm run dev
npm run dev:monitor
```

### 2. Build con Monitoraggio Errori

```bash
# Invece di: npm run build
npm run build:monitor
```

### 3. Verifica Errori Registrati

```bash
npm run check:errors
```

## 📝 File Generati

- **ERROR_LOG.md**: File markdown con tutti gli errori rilevati, timestamp e dettagli

## 🔧 Setup Pre-Commit Hook (Opzionale)

Per controlli automatici prima di ogni commit:

```bash
# Copia lo script come pre-commit hook
cp scripts/git-pre-commit.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 📖 Formato Log

Il file `ERROR_LOG.md` contiene:
- Timestamp di ogni errore
- Stack trace completo
- Output di build/dev
- File coinvolti
- Suggerimenti per correzione

## 🤖 Uso con AI

Quando ci sono errori, posso leggere automaticamente `ERROR_LOG.md` e correggere i problemi senza dover chiedere dettagli.

