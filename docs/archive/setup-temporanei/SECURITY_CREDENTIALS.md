# 🔐 Sicurezza Credenziali API - Documentazione

## Panoramica

Il sistema implementa un livello di sicurezza avanzato per la gestione delle credenziali API dei corrieri, includendo:

- ✅ **Criptazione AES-256-GCM** delle credenziali sensibili
- ✅ **Audit Logging** completo per tracciare accessi
- ✅ **Row Level Security (RLS)** per limitare accessi
- ✅ **Versionamento API** per gestire cambiamenti

---

## 🔑 Configurazione Criptazione

### Variabile d'Ambiente Richiesta

**`ENCRYPTION_KEY`** - Chiave di criptazione (obbligatoria in produzione)

```bash
# Genera una chiave sicura (64 caratteri esadecimali = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Oppure usa una stringa che verrà derivata con scrypt
ENCRYPTION_KEY="your-secure-passphrase-here"
```

### Setup Vercel

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** La chiave generata (64 caratteri hex o passphrase)
   - **Environment:** ✅ Production, ✅ Preview

### ⚠️ IMPORTANTE

- **NON condividere** la chiave di criptazione
- **NON committare** la chiave nel repository
- **Ruota periodicamente** la chiave (richiede re-criptazione credenziali)
- In **produzione**, la chiave è **obbligatoria**

---

## 📋 Audit Logging

### Cosa viene tracciato

Tutte le operazioni sulle credenziali vengono registrate:

- `credential_viewed` - Credenziale visualizzata
- `credential_copied` - Credenziale copiata
- `credential_created` - Credenziale creata
- `credential_updated` - Credenziale aggiornata
- `credential_deleted` - Credenziale eliminata
- `credential_decrypted` - Credenziale decriptata

### Accesso ai Log

Solo gli **admin** possono visualizzare i log di audit:

```sql
SELECT * FROM audit_logs
WHERE resource_type = 'courier_config'
ORDER BY created_at DESC
LIMIT 50;
```

### Tabella audit_logs

La tabella `audit_logs` viene creata automaticamente dalla migration `013_security_audit_logs.sql`.

---

## 🔄 Migrazione Credenziali Esistenti

### Passo 1: Configura ENCRYPTION_KEY

```bash
export ENCRYPTION_KEY="your-encryption-key-here"
```

### Passo 2: Esegui Script di Migrazione

```typescript
// scripts/migrate-credentials.ts
import { encryptCredential } from '@/lib/security/encryption';
import { supabaseAdmin } from '@/lib/db/client';

async function migrateCredentials() {
  // Recupera tutte le credenziali non criptate
  const { data: configs } = await supabaseAdmin
    .from('courier_configs')
    .select('id, api_key, api_secret, encrypted')
    .eq('encrypted', false);

  for (const config of configs || []) {
    // Cripta api_key
    const encryptedKey = encryptCredential(config.api_key);

    // Cripta api_secret se presente
    let encryptedSecret = null;
    if (config.api_secret) {
      encryptedSecret = encryptCredential(config.api_secret);
    }

    // Aggiorna nel database
    await supabaseAdmin
      .from('courier_configs')
      .update({
        api_key: encryptedKey,
        api_secret: encryptedSecret,
        encrypted: true,
      })
      .eq('id', config.id);
  }
}
```

---

## 🛡️ Best Practices

### 1. Gestione Chiavi

- ✅ Usa chiavi diverse per sviluppo e produzione
- ✅ Ruota le chiavi periodicamente (es. ogni 6 mesi)
- ✅ Usa un key management service (KMS) in produzione

### 2. Accesso Credenziali

- ✅ Limita accesso solo agli admin necessari
- ✅ Monitora i log di audit regolarmente
- ✅ Implementa rate limiting per accessi frequenti

### 3. Backup e Disaster Recovery

- ✅ Backup regolari della tabella `courier_configs`
- ✅ Backup sicuro della chiave `ENCRYPTION_KEY`
- ✅ Documenta processo di ripristino

---

## 📊 Monitoraggio

### Verifica Stato Criptazione

```sql
-- Conta credenziali criptate vs non criptate
SELECT
  encrypted,
  COUNT(*) as count
FROM courier_configs
GROUP BY encrypted;
```

### Verifica Audit Logs

```sql
-- Ultimi accessi a credenziali
SELECT
  action,
  user_email,
  resource_id,
  created_at
FROM audit_logs
WHERE resource_type = 'courier_config'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚨 Troubleshooting

### Errore: "ENCRYPTION_KEY non configurata"

**Causa:** Variabile d'ambiente mancante

**Soluzione:**

1. Verifica che `ENCRYPTION_KEY` sia configurata su Vercel
2. Riavvia il deployment dopo aver aggiunto la variabile

### Errore: "Errore durante la decriptazione"

**Causa:** Chiave di criptazione errata o credenziale corrotta

**Soluzione:**

1. Verifica che `ENCRYPTION_KEY` sia corretta
2. Controlla che le credenziali non siano state modificate manualmente
3. Se necessario, re-cripta le credenziali

### Credenziali non criptate

**Causa:** Credenziali create prima dell'implementazione della criptazione

**Soluzione:**

1. Esegui script di migrazione (vedi sopra)
2. Oppure re-inserisci le credenziali tramite l'interfaccia admin

---

## 📚 Riferimenti

- [AES-256-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
