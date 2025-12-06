# Domande di Chiarimento per Gemini - Architettura Multi-Contract

## 🔴 DOMANDE CRITICHE (da rispondere prima di implementare)

### 1. METODO DI AUTENTICAZIONE

**Contesto:**
Il sistema attuale usa **Bearer token** con API Key:
```typescript
headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
}
```

**La tua proposta usa:**
- Session cookie
- CSRF token ottenuto dinamicamente
- Form-based submission

**DOMANDE:**
1. **Come otteniamo il `session_cookie`?**
   - Deve essere creato tramite login?
   - È un cookie persistente o va rinnovato?
   - Come facciamo login programmaticamente?

2. **Il metodo session_cookie funziona realmente con Spedisci.Online?**
   - Hai testato questo metodo?
   - O è basato su reverse engineering?
   - L'API REST JSON (che restituisce 404) è un metodo diverso?

3. **Esistono ENTRAMBI i metodi?**
   - REST API con Bearer token (per integrazioni)
   - Web interface con session cookie (per uso manuale)
   - Quale dovremmo usare?

---

### 2. CREDENZIALI RICHIESTE

**Nel tuo prompt hai menzionato:**
```json
{
    "session_cookie": "...",
    "client_id_internal": "2667",
    "vector_contract_id": "77",
    "base_url": "https://ecommerceitalia.spedisci.online"
}
```

**DOMANDE:**
1. **Da dove provengono questi valori?**
   - `session_cookie`: come lo otteniamo?
   - `client_id_internal`: dove lo troviamo nell'account Spedisci.Online?
   - `vector_contract_id`: questo è il codice contratto? Dove lo vediamo?

2. **Il `vector_contract_id` = "77" corrisponde a un contratto specifico?**
   - È diverso per ogni corriere? (es. SDA=77, Poste=78)
   - O è unico per account?

3. **Se non abbiamo questi valori, come li otteniamo?**
   - Devono essere forniti da Spedisci.Online?
   - Li vediamo nel pannello web?
   - Servono credenziali diverse per ottenerli?

---

### 3. ENDPOINT API

**Situazione attuale:**
- Base URL: `https://ecommerceitalia.spedisci.online/api/v2`
- Endpoint tentato: `/api/v2/v1/shipments`
- Risultato: **404 Not Found**

**DOMANDE:**
1. **Quale è l'endpoint corretto?**
   - `/api/v2/v1/shipments`?
   - `/api/v2/shipments`?
   - Un endpoint completamente diverso?

2. **Il tuo base_url senza `/api/v2` significa:**
   - Che l'endpoint è completamente diverso?
   - Che usa una web interface invece di REST API?
   - Che va aggiunto un path diverso?

3. **Hai un esempio di chiamata funzionante?**
   - URL completo che funziona
   - Payload esempio
   - Headers richiesti

---

### 4. STRUTTURA PAYLOAD

**Nel tuo codice di esempio hai:**
```typescript
const payload = {
    '_token': token,  // CSRF token
    'client_id': config.client_id_internal,
    'vector_contract_id': config.vector_contract_id,
    'rif_mitt': dati.sender_reference || 'RIF-AUTO',
    'shipfrom_country_id': 'IT',
    'shipFrom[city]': dati.sender.city,
    // ...
}
```

**DOMANDE:**
1. **Questo payload è:**
   - Form data (application/x-www-form-urlencoded)?
   - Multipart form?
   - JSON?

2. **I campi `shipFrom[city]` con le parentesi:**
   - È la sintassi per form nested?
   - Come viene serializzato?

3. **Abbiamo un esempio completo di payload funzionante?**
   - Tutti i campi richiesti
   - Formato esatto
   - Valori esempio

---

### 5. CSRF TOKEN

**Nel tuo codice:**
```typescript
const token = await this.getCsrfToken(config.base_url, config.session_cookie);
```

**DOMANDE:**
1. **Come funziona `getCsrfToken`?**
   - Fa una chiamata GET a quale endpoint?
   - Estrae il token da dove? (HTML, cookie, header?)
   - Quanto è valido il token?

2. **Hai un esempio di implementazione?**
   - Codice completo della funzione
   - Endpoint chiamato
   - Parsing del token

---

### 6. ARCHITETTURA DATABASE

**Situazione:**
- Esiste già tabella `courier_configs` con struttura diversa
- La tua proposta suggerisce `courier_contracts`

**DOMANDE:**
1. **Dobbiamo:**
   - Creare nuova tabella `courier_contracts`?
   - Estendere `courier_configs` esistente?
   - Migrare dati esistenti?

2. **Relazione con sistema esistente:**
   - Un utente può avere più contratti?
   - Come viene scelto quale contratto usare?
   - Il contratto viene scelto automaticamente in base al corriere?

---

### 7. COMPATIBILITÀ

**DOMANDE:**
1. **Il sistema attuale:**
   - Deve continuare a funzionare?
   - O possiamo sostituirlo completamente?
   - Deve supportare entrambi i metodi in parallelo?

2. **Se il metodo session_cookie funziona:**
   - Possiamo mantenere Bearer token come fallback?
   - O dobbiamo rimuoverlo completamente?

---

### 8. DOCUMENTAZIONE E TEST

**DOMANDE:**
1. **Hai:**
   - Documentazione API ufficiale Spedisci.Online?
   - Esempi di chiamate funzionanti?
   - Credenziali di test per validare?

2. **Il metodo proposto:**
   - È stato testato in produzione?
   - Funziona con account reale?
   - Ci sono limitazioni note?

---

## ✅ DOMANDE OPERATIVE

### 9. FRONTEND

**DOMANDE:**
1. **Nel form creazione spedizione:**
   - Deve esserci un campo per scegliere il contratto?
   - O viene scelto automaticamente?
   - Come lo visualizziamo all'utente?

2. **Se un utente ha più contratti:**
   - Come li gestiamo nell'UI?
   - Dropdown per selezione?
   - Contratto default per corriere?

---

### 10. PRIORITÀ IMPLEMENTAZIONE

**DOMANDE:**
1. **Quale è la priorità?**
   - Risolvere il 404 error prima di tutto?
   - O implementare subito multi-contract?
   - Fase intermedia di test?

2. **Se il metodo session_cookie funziona:**
   - Dobbiamo implementarlo subito?
   - O possiamo prima testare manualmente?

---

## 📋 RISPOSTE RICHIESTE

Per procedere con l'implementazione, abbiamo bisogno di:

1. ✅ **Conferma metodo autenticazione** (session_cookie vs Bearer token)
2. ✅ **Come ottenere credenziali** (session_cookie, client_id, vector_contract_id)
3. ✅ **Endpoint corretto** (URL completo funzionante)
4. ✅ **Esempio payload** (struttura completa)
5. ✅ **Implementazione CSRF token** (codice completo)
6. ✅ **Strategia migrazione** (nuova tabella vs estendere esistente)
7. ✅ **Priorità** (cosa fare prima)

---

**Grazie per il supporto!** 🙏

Queste informazioni ci permetteranno di implementare correttamente senza rompere il sistema esistente.







