# 🧪 Test Automatico API Poste Italiane

## Prerequisiti

1. **File `.env.local`** nella root del progetto con:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=la_tua_service_role_key
   ENCRYPTION_KEY=la_tua_encryption_key_64_caratteri
   ```

2. **Node.js** installato (versione 18+)

## Esecuzione

### Opzione 1: Script JavaScript (Consigliato)

```bash
node scripts/test-poste-api-simple.js
```

### Opzione 2: Script TypeScript (se ts-node installato)

```bash
npm run test:poste
```

## Cosa Testa

Il test verifica automaticamente:

1. ✅ **Configurazione Database**
   - Verifica che esista una configurazione Poste attiva e default
   - Controlla che abbia API Key, API Secret e CDC

2. ✅ **Decriptazione Credenziali**
   - Decripta API Key e API Secret usando ENCRYPTION_KEY
   - Verifica che la decriptazione funzioni correttamente

3. ✅ **Autenticazione OAuth**
   - Chiama l'endpoint `/user/sessions` di Poste
   - Verifica che il token OAuth venga ottenuto correttamente
   - Controlla scope e header POSTE_clientID

4. ✅ **Endpoint Waybill**
   - Verifica che l'endpoint per creazione LDV sia disponibile

## Output Atteso

Se tutto funziona correttamente:

```
🧪 Test Automatico API Poste Italiane

============================================================

📋 STEP 1: Verifica configurazione database...
✅ Configurazione DB: Trovata: Poste Italiane - API

🔐 STEP 2: Decriptazione credenziali...
✅ Decriptazione API Key: Decriptata (XX caratteri)
✅ Decriptazione API Secret: Decriptato (XX caratteri)
✅ CDC: CDC: CDC-00038791

🔑 STEP 3: Test autenticazione OAuth...
✅ Autenticazione: Token OAuth ottenuto con successo

📦 STEP 4: Verifica endpoint waybill...
✅ Endpoint Waybill: Endpoint disponibile: https://...

============================================================
📊 RIEPILOGO TEST
============================================================
✅ Configurazione DB
✅ Decriptazione API Key
✅ Decriptazione API Secret
✅ CDC
✅ Autenticazione
✅ Endpoint Waybill

============================================================
✅ TUTTI I TEST SUPERATI!
   L'integrazione Poste Italiane è configurata correttamente.
   Puoi procedere con la creazione di spedizioni reali.
============================================================
```

## Risoluzione Problemi

### Errore: "Variabili d'ambiente mancanti"

- **Causa**: File `.env.local` non trovato o variabili mancanti
- **Soluzione**: Crea `.env.local` nella root del progetto con le variabili necessarie

### Errore: "Errore decriptazione"

- **Causa**: `ENCRYPTION_KEY` diversa da quella usata per criptare
- **Soluzione**: Usa la stessa chiave o ricrea la configurazione tramite wizard

### Errore: "Errore autenticazione" (401/403)

- **Causa**: Client ID o Secret ID errati
- **Soluzione**: Verifica le credenziali in Supabase e ricrea la configurazione

### Errore: "Errore autenticazione" (500)

- **Causa**: Problema con l'API Poste o Base URL errato
- **Soluzione**: Verifica che il Base URL sia `https://apiw.gp.posteitaliane.it/gp/internet`

## Test Manuale Alternativo

Se lo script non funziona, puoi testare manualmente:

1. **Vai su** `/dashboard/spedizioni/nuova`
2. **Seleziona** "Poste Italiane" come corriere
3. **Compila** il form con dati di test
4. **Clicca** "Genera Spedizione"
5. **Verifica** che venga creata la LDV tramite API Poste

## Note

- Il test **NON crea** spedizioni reali (solo verifica autenticazione)
- Per testare la creazione completa, usa l'interfaccia web
- I log dettagliati sono mostrati in console per debugging
