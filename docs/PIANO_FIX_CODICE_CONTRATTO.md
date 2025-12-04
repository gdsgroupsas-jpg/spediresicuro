# 🔧 Piano Fix: Codice Contratto Spedisci.Online

## 📋 PROBLEMI IDENTIFICATI

1. ❌ La LDV si crea sempre localmente (non chiama le API)
2. ❌ Il sistema non passa il codice contratto corretto alle API
3. ❌ Il mapping tra corriere selezionato e codice contratto non funziona
4. ❌ L'interfaccia per configurare i contratti non è chiara
5. ❌ I caratteri inseriti nei form non si leggono bene

---

## ✅ SOLUZIONI IMPLEMENTATE

### 1. **Nuova Interfaccia Configurazione** ✅

**File**: `components/integrazioni/spedisci-online-config.tsx` (NUOVO)

**Caratteristiche**:
- ✅ Interfaccia tabellare chiara per i contratti
- ✅ Caratteri più leggibili (font-size: 15px)
- ✅ Form semplice per aggiungere/rimuovere contratti
- ✅ Visualizzazione tabella con codici completi

**Come funziona**:
1. Inserisci credenziali API (una sola, valida per tutti i contratti)
2. Aggiungi i contratti in formato tabella:
   - Codice Contratto (es: `gls-NN6-STANDARD-(TR-VE)`)
   - Corriere (es: `Gls`)
3. Salva → il sistema crea il mapping automaticamente

---

### 2. **Mapping Codice Contratto** 🔄 IN LAVORAZIONE

**Cosa serve**:
- Quando l'utente seleziona "GLS" nel form, il sistema deve:
  1. Cercare nel `contract_mapping` il codice contratto corretto
  2. Passarlo nel payload API come `codice_contratto`
  3. Spedisci.Online userà quel contratto per creare la LDV

**Modifiche necessarie**:

#### A. Modificare `SpedisciOnlineAdapter` per accettare `contract_mapping`:

```typescript
export interface SpedisciOnlineCredentials extends CourierCredentials {
  api_key: string;
  contract_mapping?: Record<string, string>; // NUOVO
  // ...
}
```

#### B. Aggiungere campo `codice_contratto` nel payload:

```typescript
export interface SpedisciOnlineShipmentPayload {
  // ... campi esistenti ...
  codice_contratto?: string; // NUOVO
}
```

#### C. Implementare logica di mapping:

Quando viene chiamato `createShipment`:
1. Estrai il corriere dai dati (es: `courierCode = "GLS"`)
2. Cerca nel `contract_mapping` un contratto che inizia con "gls-"
3. Usa quel codice completo come `codice_contratto`
4. Includilo nel payload API

---

## 🔄 MODIFICHE DA FARE

### File 1: `lib/adapters/couriers/spedisci-online.ts`

**Aggiungere**:
1. `contract_mapping` nelle credenziali
2. Campo `codice_contratto` nel payload
3. Logica per mappare corriere → codice contratto

### File 2: `lib/couriers/factory.ts`

**Modificare**:
- Passare `contract_mapping` dalla configurazione all'adapter

### File 3: `lib/engine/fulfillment-orchestrator.ts`

**Modificare**:
- Passare il `courierCode` nei dati della spedizione quando chiama il broker

---

## 📝 FORMATO CONTRACT_MAPPING

Il `contract_mapping` sarà salvato nel database come JSON:

```json
{
  "gls-NN6-STANDARD-(TR-VE)": "Gls",
  "gls-NN6-LIGHT-(TR-VE)": "Gls",
  "postedeliverybusiness-Solution-and-Shipment": "PosteDeliveryBusiness",
  "interno-Interno": "Interno"
}
```

**Chiave**: Codice contratto completo  
**Valore**: Nome corriere

**Logica di ricerca**:
- Quando l'utente seleziona "GLS", cerca tutti i contratti che iniziano con "gls-"
- Prendi il primo disponibile (o quello di default se configurato)

---

## 🎯 PROSSIMI STEP

1. ✅ Creata nuova interfaccia configurazione
2. 🔄 Modificare adapter per supportare codice contratto
3. 🔄 Modificare factory per passare contract_mapping
4. 🔄 Testare chiamata API con codice contratto
5. 🔄 Integrare nuova interfaccia nella pagina integrazioni

---

**Stato**: In lavorazione  
**Priorità**: Alta  
**Stima tempo**: 1-2 ore






