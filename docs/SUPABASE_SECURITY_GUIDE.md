# 🛡️ Supabase Security & Workflow Guide

## 1. Token Security (Dove sono i miei token?)

### 📍 Local Storage

La CLI di Supabase salva l'access token nel **System Credential Store** (Windows Credential Manager, macOS Keychain, Linux Keyring).

- **NON** viene salvato in file di testo nel progetto.
- **NON** committare mai file che potrebbero contenere token (es. `.env` non protetti).

**Verifica:**
Assicurati che `.gitignore` contenga:

```gitignore
.env
.env.local
.env.*
!.env.example
supabase/.temp/
```

### ✂️ Prevenzione Leak

1.  **Non usare mai** `--password` o token in chiaro nei comandi se non strettamente necessario (e mai in script committati).
2.  Usa `npx supabase login` (interattivo) una sola volta.
3.  Per script locali, il sistema recupera il token automaticamente dal credential store.

---

## 2. Secure CI/CD Workflow

Per integrare Supabase in GitHub Actions (o altri CI) in modo sicuro:

### 🔑 Secret Management

1.  Vai nelle impostazioni della repository (es. GitHub > Settings > Secrets).
2.  Crea un secret `SUPABASE_ACCESS_TOKEN` col valore del tuo token.
3.  Crea un secret `SUPABASE_DB_PASSWORD` (se necessario per operazioni dirette, ma preferisci il token).
4.  Crea un secret `SUPABASE_PROJECT_ID` (o usa una env var se non è segreto, il Project ID non è strettamente un segreto ma è buona prassi nasconderlo se repository publica).

### 🤖 Workflow Example (GitHub Actions)

```yaml
name: Deploy Migrations

on:
  push:
    branches:
      - main
    paths:
      - "supabase/migrations/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      PROJECT_ID: pxwmposcsvsusjxdjues
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Project
        run: supabase link --project-ref $PROJECT_ID

      - name: Apply Migrations
        run: supabase db push
```

**Punti Chiave:**

- Il token viene iniettato come variabile d'ambiente.
- `supabase link` usa il token dall'ambiente automaticamente.
- Nessun file di configurazione con segreti viene creato.

---

## 3. Checklist "Safe Migrations"

Prima di eseguire `supabase db push` (locale o CI), verifica:

### ✅ Pre-Migration

- [ ] **Sintassi SQL**: Verifica che il file SQL sia valido.
- [ ] **Distruttività**: La migrazione contiene `DROP TABLE`, `DROP COLUMN` o modifiche di tipo?
  - _Se sì:_ Hai verificato che non ci siano dati di produzione che andranno persi?
  - _Se sì:_ Fai un backup prima (`supabase db dump`).
- [ ] **Down Migration**: (Opzionale ma raccomandato) Hai uno script per tornare indietro se fallisce?
- [ ] **Idempotenza**: Lo script può essere eseguito più volte senza rompere tutto? (es. `CREATE TABLE IF NOT EXISTS`).

### 🛡️ During Development

1.  Crea migrazione: `npx supabase migration new my_feature`
2.  Edita il file in `supabase/migrations/`
3.  Testa localmente (se usi Docker) o su un progetto di staging.
4.  Applica: `npx supabase db push`

### 🚨 Emergency Rollback

Se una migrazione rompe produzione:

1.  **Non farti prendere dal panico.**
2.  Se hai un backup: ripristina lo schema precedente.
3.  Se è una modifica semplice (es. nuova vista rotta): crea una nuova migrazione che fa il `DROP` della vista o ripristina il codice precedente (`revert`).
4.  Esegui `db push` immediatamente.

---

## 4. File Generati e .gitignore

| Path                        | Descrizione                   | Git Ignore?                       |
| :-------------------------- | :---------------------------- | :-------------------------------- |
| `supabase/config.toml`      | Configurazione progetto.      | **NO** (se non contiene secret)   |
| `supabase/migrations/*.sql` | File di migrazione.           | **NO** (devono essere versionati) |
| `supabase/seed.sql`         | Dati iniziali.                | **NO**                            |
| `supabase/.temp/`           | File temporanei CLI.          | **SÌ**                            |
| `supabase/.branches/`       | Configurazione branch locali. | **SÌ**                            |
| `.env.local`                | Variabili d'ambiente locali.  | **SÌ**                            |

Assicurati che il tuo `.gitignore` sia aggiornato.
