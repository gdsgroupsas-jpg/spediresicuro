# 🔧 PROMPT PER VISUAL STUDIO CODE AGENT

## PROBLEMA

Il server automation-service funziona ma non si connette a Supabase. Quando testo l'endpoint `/api/diagnostics`, ricevo:

```json
{
  "success": true,
  "id": "temp-1765220218779",
  "message": "Diagnostic event queued (database not configured)",
  "warning": "Supabase not configured - event not persisted"
}
```

## OBIETTIVO

Far funzionare la connessione a Supabase in modo che gli eventi diagnostici vengano salvati nel database `diagnostics_events`.

## CONTESTO

- Il file `.env` esiste nella cartella `automation-service`
- Il server è in esecuzione e risponde correttamente
- L'endpoint `/api/diagnostics` funziona ma non salva nel DB
- Il codice cerca `process.env.SUPABASE_URL` e `process.env.SUPABASE_SERVICE_ROLE_KEY`

## COMPITI

### 1. Verifica il file `.env`

Controlla che il file `automation-service/.env` contenga:

- `SUPABASE_URL=https://pxd2.supabase.co` (o il valore corretto dal `.env.local` della root)
- `SUPABASE_SERVICE_ROLE_KEY=...` (chiave completa dal `.env.local`)

### 2. Verifica che i valori siano corretti

- Leggi il file `.env.local` nella root del progetto (`d:\spediresicuro-master\.env.local`)
- Confronta i valori di `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- Assicurati che nel file `.env` di automation-service ci siano:
  - `SUPABASE_URL` (deve essere uguale a `NEXT_PUBLIC_SUPABASE_URL` del .env.local)
  - `SUPABASE_SERVICE_ROLE_KEY` (deve essere identico al .env.local)

### 3. Verifica il caricamento di dotenv

Controlla che il file `dist/index.js` contenga il caricamento di dotenv all'inizio:

```javascript
try {
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
} catch (e) {
  // dotenv non disponibile
}
```

### 4. Verifica che non ci siano spazi o caratteri strani

- Assicurati che nel file `.env` non ci siano spazi prima o dopo il `=`
- Assicurati che non ci siano virgolette attorno ai valori
- Assicurati che `SUPABASE_SERVICE_ROLE_KEY` sia tutto su una riga (non spezzato)

### 5. Test finale

Dopo le modifiche:

1. Riavvia il server automation-service (`npm start`)
2. Esegui il test: `.\test-diagnostics.bat`
3. Verifica che la risposta NON contenga più il warning "Supabase not configured"

## FILE DA CONTROLLARE

- `automation-service/.env` (file di configurazione)
- `automation-service/dist/index.js` (codice compilato)
- `d:\spediresicuro-master\.env.local` (riferimento per i valori)

## RISULTATO ATTESO

Dopo il fix, il test dovrebbe restituire:

```json
{
  "success": true,
  "id": "uuid-reale-del-database",
  "message": "Diagnostic event recorded successfully"
}
```

Senza il warning "Supabase not configured".
