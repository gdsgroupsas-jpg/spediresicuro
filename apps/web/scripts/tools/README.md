# 🔧 Script Tools - Guida Rapida

Questa cartella contiene script batch utili per lo sviluppo locale.

## 📋 Script Disponibili

### Verifica Configurazione

- **`VERIFICA-ANNE-LOCALE.bat`**  
  Verifica che `ANTHROPIC_API_KEY` sia configurata correttamente in `.env.local`

- **`VERIFICA-ENV-LOCALE.bat`**  
  Verifica le variabili ambiente essenziali in `.env.local`

- **`VERIFICA_OAUTH_LOCALE.bat`**  
  Verifica configurazione OAuth (Google, GitHub) in `.env.local`

### Server

- **`RIAVVIA-SERVER.bat`**  
  Ferma, pulisce cache e riavvia il server di sviluppo

### Git (per sviluppatori)

- **`FIX-COMMIT-PUSH-SEMPLICE.bat`**  
  Script semplificato per commit e push

- **`SYNC-COMPLETA-REPO.bat`**  
  Sincronizza repository completo

## 🚀 Come Usare

1. Apri PowerShell o CMD nella root del progetto
2. Esegui lo script desiderato:
   ```bash
   scripts\tools\VERIFICA-ANNE-LOCALE.bat
   ```

Oppure naviga nella cartella:

```bash
cd scripts\tools
VERIFICA-ANNE-LOCALE.bat
```

## ⚠️ Note

- Tutti gli script devono essere eseguiti dalla root del progetto
- Assicurati che `.env.local` esista prima di eseguire script di verifica
- Gli script Git richiedono che Git sia configurato correttamente

---

**Cartella**: `scripts/tools/`  
**Per sviluppatori locali**: Usa questi script per verificare e gestire la configurazione
