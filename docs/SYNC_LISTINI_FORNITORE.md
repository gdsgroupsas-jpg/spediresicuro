# Sincronizzazione Listini Fornitore (Spedisci.Online)

Questo documento descrive il meccanismo di sincronizzazione dei listini prezzi dal fornitore Spedisci.Online, inclusa la logica di isolamento multi-tenant e la soluzione per i timeout su Vercel.

## 1. Panoramica Architetturale

Il sistema permette di importare automaticamente i prezzi di spedizione da Spedisci.Online nel database locale.
Poiché Spedisci.Online non offre un'API "scarica listino", il sistema utilizza una tecnica di **"Reverse Engineering attivo" (Probing)**:

1.  Genera combinazioni di Zone x Pesi.
2.  Interroga l'API `/shipping/rates` per ogni combinazione.
3.  Salva i risultati come righe di listino (`price_list_entries`).

### Isolamento Multi-Tenant

Ogni listino è strettamente legato all'utente che lo ha creato e alla configurazione API utilizzata.

- **Tabella**: `price_lists`
- **Vincoli**: `created_by` (User ID) + `courier_config_id`.
- **Sicurezza**: RLS Policy assicura che un utente veda solo i propri listini.

## 2. Il Problema del Timeout Vercel

Vercel (Free/Pro Plan) impone limiti rigidi di esecuzione per le Server Actions:

- **10 secondi** (Free) / **60 secondi** (Pro).
- Una sincronizzazione completa ("Matrix Mode") richiede **2-3 minuti** per scaricare 900+ combinazioni.
- Risultato precedente: Il processo veniva ucciso a metà (Timeout 504), lasciando listini incompleti.

## 3. Soluzione: Client-Side Chunking 🛡️

Per aggirare il limite senza costi infrastrutturali (es. code esterne), è stata implementata una strategia di **orchestrazione lato client**.

### Come funziona

Invece di una singola chiamata monolitica ("Scarica tutto"), il browser suddivide il lavoro in piccoli "Chunk" basati sulle Zone geografiche.

1.  **Client (UI)**: Calcola le zone da scaricare (es. 9 zone).
2.  **Loop**:
    - Chiama Server Action per **Zona 1** -> Attende risposta (~5-8s).
    - Chiama Server Action per **Zona 2** -> Attende risposta (~5-8s).
    - ...
    - Chiama Server Action per **Zona 9**.
3.  **Server**: Riceve il parametro `targetZones` ed esegue il probing **SOLO** per quella zona, rientrando ampiamente nel limite dei 10s.

### Parametri Chiave

- **Backend**: `actions/spedisci-online-rates.ts` accetta `targetZones: string[]`.
- **Frontend**: `components/listini/sync-spedisci-online-dialog.tsx` gestisce il loop e la barra di progresso.

## 4. Modalità di Sincronizzazione

Il sistema supporta 3 modalità, selezionabili dalla UI:

| Modalità        | Descrizione                        | Zone                 | Pesi              | Chiamate | Tempo Stimato |
| :-------------- | :--------------------------------- | :------------------- | :---------------- | :------- | :------------ |
| **⚡ Fast**     | Test rapido connettività           | 2 (Italia, Calabria) | 3 (2, 10, 30kg)   | ~6       | 10 sec        |
| **⚖️ Balanced** | Default. Copre spedizioni standard | 7 (Italia completa)  | 9 (Scaglioni std) | ~63      | 1-2 min       |
| **📊 Matrix**   | **Completa**. Scarica tutto        | 9 (Tutta Europa)     | 101 (1-100kg)     | ~900     | 15-20 min     |

> **Nota**: La modalità "Matrix" è quella che beneficia maggiormente del Chunking.

## 5. Struttura Dati (Database)

Le tabelle coinvolte sono 3:

1.  `price_lists`: Intestazione del listino (Nome, Fornitore, Configurazione).
2.  `price_list_entries`: Le righe di prezzo (Zona, Peso Min/Max, Prezzo Base).
3.  `courier_configs`: Le credenziali API usate per il probing.

## 6. Manutenzione e Debug

### File Importanti

- **Logica Core**: `actions/spedisci-online-rates.ts`
- **Costanti Matrice**: `lib/constants/pricing-matrix.ts`
- **UI Dialog**: `components/listini/sync-spedisci-online-dialog.tsx`

### Come aggiungere una nuova Zona

1.  Modificare `lib/constants/pricing-matrix.ts`.
2.  Aggiungere la zona all'array `ZONES`.
3.  Il sistema di chunking la rileverà automaticamente al prossimo avvio.
