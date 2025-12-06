# Analisi Proposta Gemini - Architettura Multi-Contract

## 📋 OBIETTIVO BUSINESS

La proposta di Gemini vuole evolvere il sistema da configurazione singola a supporto **Multi-Contract / Multi-Dealer**, permettendo di gestire N contratti diversi anche dello stesso fornitore.

**Esempio target:**
- Contratto A: "Mio Account Poste" (tramite Spedisci.Online)
- Contratto B: "Mio Account SDA" (tramite Spedisci.Online)
- Contratto C: "Account Partner"

---

## 🔍 CONFRONTO: PROPOSTA GEMINI vs SISTEMA ATTUALE

### 1. DATABASE LAYER

#### **PROPOSTA GEMINI:**
```sql
Tabella: courier_contracts (o shipping_providers)
- id: uuid (PK)
- name: string
- provider_type: enum ('SPEDISCI_ONLINE', 'ALTRO')
- is_active: boolean
- credentials: JSONB {
    "session_cookie": "...",
    "client_id_internal": "2667",
    "vector_contract_id": "77",
    "base_url": "https://ecommerceitalia.spedisci.online"
}
```

#### **SISTEMA ATTUALE (migrazione 010):**
```sql
Tabella: courier_configs
- id: uuid (PK)
- name: TEXT
- provider_id: TEXT ('spedisci_online', 'gls', etc.)
- api_key: TEXT (crittografato)
- api_secret: TEXT (crittografato)
- base_url: TEXT
- contract_mapping: JSONB { "poste": "CODE123", "gls": "CODE456" }
- is_active: BOOLEAN
- is_default: BOOLEAN
```

#### **DIFFERENZE CHIAVE:**

| Aspetto | Gemini | Sistema Attuale | Note |
|---------|--------|-----------------|------|
| **Tabella** | `courier_contracts` | `courier_configs` | ⚠️ Nome diverso, ma struttura simile |
| **Autenticazione** | `session_cookie` | `api_key` + Bearer token | 🔴 **DIFFERENZA CRITICA** |
| **ID Contratto** | `vector_contract_id` + `client_id_internal` | `contract_mapping` JSONB | 🔴 **Approccio diverso** |
| **Base URL** | Senza `/api/v2` | Con `/api/v2` | ⚠️ Potenziale problema |
| **CSRF Token** | Richiesto (via cookie) | Bearer token | 🔴 **Metodo autenticazione diverso** |

---

### 2. SERVICE LAYER

#### **PROPOSTA GEMINI:**
```typescript
// Abstract Factory pattern
createShipment(shipmentData, contractConfig) {
    // 1. Get Token fresco usando session_cookie
    const token = await this.getCsrfToken(config.base_url, config.session_cookie);
    
    // 2. Payload con dati dal DB
    const payload = {
        '_token': token,  // CSRF token
        'client_id': config.client_id_internal,
        'vector_contract_id': config.vector_contract_id,
        // ...
    };
    
    // 3. Richiesta con session_cookie
}
```

#### **SISTEMA ATTUALE:**
```typescript
// Adapter pattern
SpedisciOnlineAdapter {
    createShipment(data) {
        // Usa API_KEY con Bearer token
        fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
    }
}
```

#### **DIFFERENZE CHIAVE:**

| Aspetto | Gemini | Sistema Attuale | Note |
|---------|--------|-----------------|------|
| **Token** | CSRF token (dinamico) | Bearer token (fisso) | 🔴 **Metodo completamente diverso** |
| **Autenticazione** | Session cookie | Authorization header | 🔴 **Approccio diverso** |
| **Endpoint** | Form-based (probabilmente) | JSON REST API | 🔴 **Formato diverso** |
| **Credenziali** | Cookie di sessione | API Key | 🔴 **Tipo credenziali diverso** |

---

### 3. API ROUTE

#### **PROPOSTA GEMINI:**
```
POST /api/shipments/create
Payload: {
    contract_id: "uuid",
    ...shipmentData
}

Backend:
1. Query DB per contract_id
2. Decidere service in base a provider_type
3. Passare credenziali al service
4. Eseguire spedizione
```

#### **SISTEMA ATTUALE:**
```
POST /api/spedizioni
Payload: {
    corriere: "SDA",
    ...shipmentData
}

Backend:
1. Ottiene configurazione per utente (assigned_config_id o default)
2. Usa orchestrator per routing
3. Crea spedizione tramite adapter
```

---

## ⚠️ PUNTI CRITICI DA CHIARIRE

### 1. **METODO DI AUTENTICAZIONE**

**Domanda chiave:** Quale metodo usa realmente Spedisci.Online?

- **Gemini propone:** Session cookie + CSRF token (form-based)
- **Sistema attuale:** Bearer token + API Key (REST JSON)

**Implicazioni:**
- Se Gemini ha ragione → dobbiamo rifare completamente l'adapter
- Se sistema attuale è corretto → l'approccio Gemini non funzionerà
- Potrebbero esistere ENTRAMBI i metodi (versione vecchia vs nuova)

**📝 SERVE CONFERMA:** Quale metodo funziona realmente con l'API di Spedisci.Online?

---

### 2. **STRUTTURA CREDENZIALI**

**Gemini propone:**
```json
{
  "session_cookie": "...",
  "client_id_internal": "2667",
  "vector_contract_id": "77",
  "base_url": "https://ecommerceitalia.spedisci.online"
}
```

**Sistema attuale:**
```json
{
  "api_key": "...",
  "api_secret": "...",
  "base_url": "https://ecommerceitalia.spedisci.online/api/v2",
  "contract_mapping": { "sda": "CODE123" }
}
```

**📝 SERVE CONFERMA:** 
- Abbiamo accesso a `session_cookie`?
- Abbiamo `client_id_internal` e `vector_contract_id`?
- O dobbiamo usare API Key?

---

### 3. **BASE URL**

**Gemini:** `https://ecommerceitalia.spedisci.online` (senza `/api/v2`)

**Attuale:** `https://ecommerceitalia.spedisci.online/api/v2`

**📝 SERVE CONFERMA:** Quale è corretto? Potrebbero essere endpoint diversi:
- `/api/v2` = API REST JSON
- `/` (senza api/v2) = Form-based web interface

---

### 4. **TABELLA DATABASE**

**Gemini propone:** Nuova tabella `courier_contracts`

**Sistema attuale:** Tabella `courier_configs` già esistente

**📝 PROPOSTA:** 
- **Opzione A:** Estendere `courier_configs` esistente per supportare entrambi i metodi
- **Opzione B:** Creare `courier_contracts` separata e mantenere compatibilità
- **Opzione C:** Unificare in una tabella più flessibile

---

## 💡 PROPOSTA DI MIGLIORAMENTO

### Architettura Ibrida - Supporto Entrambi i Metodi

```typescript
// 1. Estendere courier_configs per supportare multiple modalità
credentials: JSONB {
    // Metodo 1: REST API (attuale)
    "api_key"?: "...",
    "api_secret"?: "...",
    
    // Metodo 2: Session-based (Gemini)
    "session_cookie"?: "...",
    "client_id_internal"?: "...",
    "vector_contract_id"?: "...",
    
    // Metodo usato
    "auth_method": "bearer" | "session_cookie",
    
    // Base URL
    "base_url": "...",
    
    // Contratti (compatibilità)
    "contract_mapping"?: {...}
}

// 2. Adapter intelligente
class SpedisciOnlineAdapter {
    async createShipment(data, config) {
        if (config.auth_method === "session_cookie") {
            return this.createShipmentWithSessionCookie(data, config);
        } else {
            return this.createShipmentWithBearerToken(data, config);
        }
    }
}
```

---

## ❓ DOMANDE DA RISPONDERE PRIMA DI IMPLEMENTARE

### 1. **METODO AUTENTICAZIONE**
- ✅ Abbiamo accesso a session cookie di Spedisci.Online?
- ✅ O dobbiamo usare API Key + Bearer token?
- ✅ Quale metodo funziona realmente?

### 2. **CREDENZIALI DISPONIBILI**
- ✅ Abbiamo `client_id_internal` e `vector_contract_id`?
- ✅ O dobbiamo usare `contract_mapping` JSONB?
- ✅ Come otteniamo questi valori?

### 3. **ENDPOINT API**
- ✅ Quale è l'endpoint corretto?
- ✅ `/api/v2/v1/shipments` (REST JSON)?
- ✅ O form-based web interface?
- ✅ Abbiamo documentazione API ufficiale?

### 4. **MIGRAZIONE DATABASE**
- ✅ Estendere `courier_configs` esistente?
- ✅ Creare nuova tabella `courier_contracts`?
- ✅ Mantenere retrocompatibilità?

### 5. **FRONTEND**
- ✅ Il frontend deve permettere selezione contratto?
- ✅ O il contratto viene scelto automaticamente in base al corriere?
- ✅ Dove aggiungiamo il campo `contract_id` nel form?

---

## 🎯 RACCOMANDAZIONE

### Fase 1: VERIFICA (NON IMPLEMENTARE ANCORA)
1. ✅ Verificare quale metodo autenticazione funziona realmente
2. ✅ Testare se abbiamo accesso a session cookie
3. ✅ Verificare endpoint API corretti
4. ✅ Chiedere a Gemini: da dove provengono questi dati? (session_cookie, client_id, vector_contract_id)

### Fase 2: PROGETTAZIONE
1. ✅ Decidere struttura database (estendere o nuova tabella)
2. ✅ Progettare adapter ibrido che supporta entrambi i metodi
3. ✅ Pianificare migrazione senza rompere esistente

### Fase 3: IMPLEMENTAZIONE
1. ✅ Migrazione database (se necessaria)
2. ✅ Refactoring adapter
3. ✅ Aggiornamento API route
4. ✅ Frontend (se necessario)

---

## 📝 NOTE FINALI

**Stato Attuale:**
- ✅ Sistema funzionante con Bearer token (ma 404 errors)
- ✅ Database `courier_configs` già implementato
- ✅ Orchestrator e adapter pattern già in uso

**Rischio Implementazione Diretta:**
- 🔴 Potrebbe rompere sistema esistente
- 🔴 Se Gemini ha informazioni sbagliate, non funzionerà
- 🔴 Serve validazione prima di procedere

**Raccomandazione:**
- ⚠️ **NON implementare subito**
- ✅ **Analizzare e verificare prima**
- ✅ **Creare versione ibrida che supporta entrambi**
- ✅ **Testare entrambi i metodi prima di rimuovere vecchio**

---

**Data Analisi:** 2025-12-03
**Versione Sistema:** Commit 47cf5c0
**Status:** 🔴 Richiede chiarimenti prima di implementare







