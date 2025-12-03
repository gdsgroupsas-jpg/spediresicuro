# PROMPT: Implementazione Gerarchia Utenti (Multi-Livello) e Modulo OCR Resi

**CONTESTO:** Sviluppo di due Killer Feature: 1) Gerarchia Multi-Livello Admin (Parent/Child) e 2) Workflow di Scansione OCR/Barcode per i Resi.

**STACK ATTUALE:** Next.js 14, Supabase (PostgreSQL), TypeScript, Tailwind. Si assume l'esistenza di `profiles` con `role` e `is_banned` e di una tabella `spedizioni`.

**OBIETTIVO:** Implementare la logica di gerarchia utente fino a 5 livelli e il workflow di gestione resi.

---

### A. SISTEMA GERARCHIA UTENTI (MULTI-LIVELLO)

**1. Database Model Extension (Istruzione Manuale):**
* **Istruzione:** Aggiungere il campo **`parent_user_id`** (UUID, nullable, Foreign Key a `profiles.id`) alla tabella **`profiles`**.

**2. Gestione Gerarchia (Server Action):**
* Crea una Server Action `actions/admin.ts` chiamata **`createSubAdmin(childEmail: string, parentId: string)`**.
* La funzione deve:
    * Verificare che l'utente chiamante (`parentId`) abbia il permesso di creare sotto-admin (es. `role` non 'user').
    * Verificare che la profondità gerarchica sia ≤ 5.
    * Creare il nuovo utente in `auth.users` (con `supabase.auth.admin.createUser`).
    * Inserire il nuovo profilo in `profiles` impostando **`parent_user_id = parentId`** e **`role = 'sub_admin'`**.

**3. Viste Utente (RLS Logica):**
* **Istruzione:** Aggiorna le Policy **RLS (Row Level Security)** sulla tabella **`spedizioni`** (e, idealmente, sulle future tabelle `listini`) per consentire:
    * **`SELECT`:** L'utente vede tutte le spedizioni dove `user_id` è il suo ID O dove l'ID è di uno dei suoi discendenti (fino a 5 livelli).
    * *Nota:* A causa della complessità RLS ricorsiva, implementa un **placeholder di logica lato codice** per la Dashboard Utente che filtri le spedizioni. La query deve recuperare l'ID di tutti i sotto-admin e filtrare `spedizioni.user_id IN (...)`.

**4. Interfaccia Amministrazione di Livello (Nuova Pagina):**
* Crea una nuova pagina protetta `/app/dashboard/team/page.tsx` (sezione per gli Admin non-Super) per la gestione del team.
* **Funzionalità:**
    * Tabella che mostra solo i suoi diretti sotto-admin (`profiles.parent_user_id = auth.uid()`).
    * Pulsante "Invita Sub-Admin" che attiva la Server Action `createSubAdmin`.
    * Visualizzazione delle statistiche aggregate per i sotto-admin.

---

### B. WORKFLOW OCR / BARCODE PER RESI

**1. Estensione Modello Dati (types/index.ts):**
* Aggiorna l'interfaccia `Spedizione` per includere:
    * `is_return`: boolean
    * `original_shipment_id`: string (UUID o tracking number)
    * `return_reason`: string (nullable)
    * `return_status`: 'requested' | 'processing' | 'completed'

**2. Componente Scansione Reso (components/ReturnScanner.tsx):**
* Crea un componente riutilizzabile che si basa sulla logica del `ScannerLDV.tsx` (scanner camera/barcode).
* Scansiona l'LDV del reso.

**3. Server Action (actions/returns.ts):**
* Crea una Server Action **`processReturnScan(ldvReturnNumber: string, originalTracking: string, returnReason: string)`**.
* **Logica:**
    * Eseguire una ricerca nel database per l'LDV del reso o il tracking originale (`originalTracking`).
    * Aggiornare la spedizione originale: `return_status = 'processing'`.
    * **Creare un NUOVO record** nella tabella `spedizioni` con:
        * `is_return: true`
        * `ldv_number: ldvReturnNumber`
        * `original_shipment_id: originalTracking`
        * Collegamento all'utente originale.
    * Restituire lo stato `Reso Registrato e Collegato`.

**4. Interfaccia Utente:**
* Aggiungi un pulsante "Registra Reso" nella Dashboard di un Admin/Utente che avvia il componente `ReturnScanner.tsx`.

---

**OUTPUT RICHIESTO:**
* Codice completo per `app/dashboard/team/page.tsx`.
* Codice completo per `actions/admin.ts` e `actions/returns.ts`.
* Componente `components/ReturnScanner.tsx`.
* Aggiornamento dell'interfaccia `Spedizione` in `types/index.ts`.
* **Istruzioni SQL FINALIZZATE** per l'aggiunta di `parent_user_id` e i campi `is_return` alla tabella `spedizioni`.v
