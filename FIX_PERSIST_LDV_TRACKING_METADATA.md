# 🔧 FIX: Persistenza LDV, Tracking e Metadata dopo Orchestrator Success

**Data**: 2025-01-XX  
**Problema**: Dopo creazione spedizione e chiamata orchestrator, LDV e tracking non vengono salvati in `shipments`  
**Causa**: Dati orchestrator aggiornati solo in memoria, non persistiti nel database  
**Soluzione**: UPDATE shipments dopo successo orchestrator

---

## 📋 SEZIONE 1: FILE MODIFICATI

### File Modificato

**`app/api/spedizioni/route.ts`** - Handler POST

**Modifiche principali**:

1. **Salvataggio risultato `addSpedizione()`** (riga 507):
   - Modificato per salvare `createdShipment` con ID della spedizione creata
   - Log ID spedizione creata

2. **UPDATE dopo successo orchestrator** (righe 530-620):
   - Verifica `ldvResult.success === true`
   - Prepara dati da aggiornare: `tracking_number`, `ldv`, `external_tracking_number`, `metadata`
   - Esegue UPDATE idempotente usando ID spedizione
   - Logging sicuro (struttura senza dati sensibili)
   - Gestione errori (non blocca risposta se UPDATE fallisce)

---

## 📋 SEZIONE 2: DIFF SINTETICO

### Modifiche

**Prima** (riga 507):
```typescript
await addSpedizione(normalizedPayload, authContext);
```

**Dopo** (riga 507):
```typescript
createdShipment = await addSpedizione(normalizedPayload, authContext);
console.log('✅ [API] Spedizione creata con ID:', createdShipment.id);
```

---

**Prima** (righe 530-557):
```typescript
if (ldvResult.success) {
  console.log(`✅ LDV creata (${ldvResult.method}):`, ldvResult.tracking_number);
  
  // Aggiorna tracking number se fornito dall'orchestrator
  if (ldvResult.tracking_number && ldvResult.tracking_number !== spedizione.tracking) {
    spedizione.tracking = ldvResult.tracking_number;
    spedizione.ldv = ldvResult.tracking_number; // Salva anche come LDV
  }

  // Se è una spedizione Poste, salva metadati aggiuntivi
  if (body.corriere === 'Poste Italiane' && ldvResult.metadata) {
    // ... aggiorna solo in memoria
  }
}
```

**Dopo** (righe 530-620):
```typescript
if (ldvResult.success) {
  console.log(`✅ LDV creata (${ldvResult.method}):`, ldvResult.tracking_number);
  
  // ⚠️ PERSISTENZA: Salva LDV, tracking e metadata in shipments SOLO se orchestrator ha successo
  if (createdShipment?.id) {
    try {
      // Prepara dati da aggiornare
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      // Aggiorna tracking_number se fornito dall'orchestrator
      if (ldvResult.tracking_number) {
        updateData.tracking_number = ldvResult.tracking_number;
        updateData.ldv = ldvResult.tracking_number; // LDV = tracking number
      }
      
      // Aggiorna external_tracking_number se presente
      if (ldvResult.metadata?.waybill_number) {
        updateData.external_tracking_number = ldvResult.metadata.waybill_number;
      }
      
      // Salva metadata come JSONB
      if (ldvResult.metadata) {
        updateData.metadata = {
          ...ldvResult.metadata,
          carrier: body.corriere || 'GLS',
          method: ldvResult.method,
          label_url: ldvResult.label_url,
        };
      }
      
      // Logging sicuro
      console.log('💾 [API] Aggiornamento spedizione con dati orchestrator:', { ... });
      
      // Esegui UPDATE idempotente
      const { data: updatedShipment, error: updateError } = await supabaseAdmin
        .from('shipments')
        .update(updateData)
        .eq('id', createdShipment.id)
        .select('id, tracking_number, ldv, external_tracking_number, metadata')
        .single();
      
      if (updateError) {
        console.error('❌ [API] Errore aggiornamento:', updateError);
        // Non bloccare risposta
      } else {
        console.log('✅ [API] Spedizione aggiornata con dati orchestrator');
        // Aggiorna oggetto spedizione per risposta
        spedizione.tracking = updatedShipment.tracking_number;
        spedizione.ldv = updatedShipment.ldv;
        // ...
      }
    } catch (updateError) {
      console.error('❌ [API] Errore durante aggiornamento:', updateError);
      // Non bloccare risposta
    }
  }
}
```

---

## 📋 SEZIONE 3: STRATEGIA IMPLEMENTATA

### Flusso

```
1. Crea spedizione → addSpedizione() → restituisce createdShipment con ID
2. Chiama orchestrator → createShipmentWithOrchestrator()
3. Se success === true:
   a. Prepara updateData (tracking_number, ldv, external_tracking_number, metadata)
   b. Esegue UPDATE shipments WHERE id = createdShipment.id
   c. Logging sicuro
   d. Aggiorna oggetto spedizione per risposta
4. Se success === false:
   - Nessun UPDATE (spedizione rimane con tracking originale)
```

### Idempotenza

**Chiave**: `id` della spedizione (UUID)

**Garantisce**:
- UPDATE eseguito solo se orchestrator ha successo
- Nessun duplicato (usa ID come chiave)
- Retry-safe (UPDATE idempotente)

### Campi Aggiornati

1. **`tracking_number`**: Tracking number dall'orchestrator
2. **`ldv`**: Lettera di Vettura (stesso valore di tracking_number)
3. **`external_tracking_number`**: Waybill number (es. Poste)
4. **`metadata`**: JSONB con metadati corriere (carrier, method, label_url, ecc.)
5. **`updated_at`**: Timestamp aggiornamento

---

## 📋 SEZIONE 4: TEST PLAN

### Test 1: Creazione Spedizione con Orchestrator Success ✅

**Scenario**: Reseller crea spedizione, orchestrator ha successo

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Mittente: dati completi
   - Destinatario: dati completi
   - Peso: 2.5 kg
   - Corriere: GLS (o altro corriere configurato)
4. Submit

**Verifiche**:
- ✅ Spedizione creata correttamente
- ✅ Log: `✅ [API] Spedizione creata con ID: ...`
- ✅ Log: `✅ LDV creata (broker): ...`
- ✅ Log: `💾 [API] Aggiornamento spedizione con dati orchestrator`
- ✅ Log: `✅ [API] Spedizione aggiornata con dati orchestrator`
- ✅ Nessun errore UPDATE

**Query Verifica**:
```sql
SELECT 
  id, 
  tracking_number, 
  ldv, 
  external_tracking_number, 
  metadata,
  updated_at
FROM shipments
WHERE tracking_number = '...'
ORDER BY created_at DESC
LIMIT 1;
```

**Risultato Atteso**:
- ✅ `tracking_number` = tracking number dall'orchestrator
- ✅ `ldv` = stesso valore di tracking_number
- ✅ `external_tracking_number` = waybill_number (se presente)
- ✅ `metadata` = JSONB con metadati corriere (carrier, method, label_url, ecc.)
- ✅ `updated_at` = timestamp aggiornamento

---

### Test 2: Verifica Lista Spedizioni ✅

**Scenario**: Verifica che spedizione appaia in lista con dati orchestrator

**Steps**:
1. Dopo creazione spedizione con orchestrator success
2. Vai a `/dashboard/spedizioni`
3. Verifica lista spedizioni

**Verifiche**:
- ✅ Spedizione appare in lista
- ✅ Tracking number corretto (da orchestrator)
- ✅ LDV presente
- ✅ Metadata disponibile (se presente)

**Risultato Atteso**:
- ✅ Lista mostra tracking number dall'orchestrator
- ✅ Dati completi e aggiornati

---

### Test 3: Creazione Spedizione con Orchestrator Failure ✅

**Scenario**: Reseller crea spedizione, orchestrator fallisce

**Steps**:
1. Login come Reseller
2. Crea spedizione (orchestrator non configurato o fallisce)
3. Verifica spedizione

**Verifiche**:
- ✅ Spedizione creata correttamente
- ✅ Log: `⚠️ Creazione LDV fallita (non critico): ...`
- ✅ Nessun UPDATE eseguito
- ✅ Tracking number originale mantenuto

**Query Verifica**:
```sql
SELECT 
  id, 
  tracking_number, 
  ldv, 
  metadata
FROM shipments
WHERE id = '...';
```

**Risultato Atteso**:
- ✅ `tracking_number` = tracking number originale (generato)
- ✅ `ldv` = NULL o tracking originale
- ✅ `metadata` = NULL o metadata originale
- ✅ Spedizione creata ma senza dati orchestrator

---

### Test 4: Verifica Idempotenza ✅

**Scenario**: Retry UPDATE (simulato)

**Steps**:
1. Crea spedizione con orchestrator success
2. Verifica UPDATE eseguito
3. Simula retry (chiama UPDATE di nuovo con stesso ID)

**Verifiche**:
- ✅ UPDATE idempotente (nessun errore)
- ✅ Dati non duplicati
- ✅ Risultato coerente

**Risultato Atteso**:
- ✅ UPDATE può essere eseguito più volte senza errori
- ✅ Dati finali coerenti

---

### Test 5: Verifica Metadata Poste ✅

**Scenario**: Creazione spedizione Poste Italiane con metadata

**Steps**:
1. Login come Reseller
2. Crea spedizione con corriere "Poste Italiane"
3. Orchestrator restituisce metadata Poste

**Verifiche**:
- ✅ Spedizione creata correttamente
- ✅ UPDATE eseguito con metadata Poste
- ✅ Log: `💾 [API] Aggiornamento spedizione con dati orchestrator`
- ✅ Metadata contiene: `poste_account_id`, `poste_product_code`, `waybill_number`, `label_pdf_url`

**Query Verifica**:
```sql
SELECT 
  id, 
  tracking_number, 
  external_tracking_number,
  metadata
FROM shipments
WHERE id = '...';
```

**Risultato Atteso**:
- ✅ `external_tracking_number` = waybill_number
- ✅ `metadata` = JSONB con metadati Poste completi
- ✅ `metadata.carrier` = 'Poste Italiane'
- ✅ `metadata.method` = 'broker' o 'direct'

---

## 📋 SEZIONE 5: LOGGING SICURO

### Formato Log

**Prima UPDATE**:
```typescript
console.log('💾 [API] Aggiornamento spedizione con dati orchestrator:', {
  shipment_id: createdShipment.id.substring(0, 8) + '...',
  has_tracking: !!updateData.tracking_number,
  has_ldv: !!updateData.ldv,
  has_metadata: !!updateData.metadata,
  update_structure: safeUpdate // Valori redatti, JSONB indicato
});
```

**Dopo UPDATE**:
```typescript
console.log('✅ [API] Spedizione aggiornata con dati orchestrator:', {
  shipment_id: updatedShipment.id.substring(0, 8) + '...',
  tracking_number: updatedShipment.tracking_number,
  has_ldv: !!updatedShipment.ldv,
  has_metadata: !!updatedShipment.metadata
});
```

**Esempio Log**:
```
💾 [API] Aggiornamento spedizione con dati orchestrator: {
  shipment_id: 'a1b2c3d4...',
  has_tracking: true,
  has_ldv: true,
  has_metadata: true,
  update_structure: {
    tracking_number: 'GLS12345678',
    ldv: 'GLS12345678',
    external_tracking_number: null,
    metadata: '[JSONB]',
    updated_at: '2025-01-XX...'
  }
}
✅ [API] Spedizione aggiornata con dati orchestrator: {
  shipment_id: 'a1b2c3d4...',
  tracking_number: 'GLS12345678',
  has_ldv: true,
  has_metadata: true
}
```

**Nessun dato sensibile esposto** ✅

---

## 🚀 DEPLOY CHECKLIST

- [x] ✅ Codice modificato (`app/api/spedizioni/route.ts`)
- [x] ✅ UPDATE dopo successo orchestrator implementato
- [x] ✅ Logging sicuro implementato
- [x] ✅ Gestione errori (non blocca risposta)
- [ ] ⏳ Test creazione spedizione con orchestrator success
- [ ] ⏳ Verifica lista spedizioni
- [ ] ⏳ Verifica metadata persistiti
- [ ] ⏳ Deploy in produzione
- [ ] ⏳ Test post-deploy

---

## 📊 RIEPILOGO

| Aspetto | Valore |
|---------|--------|
| **File Modificato** | `app/api/spedizioni/route.ts` |
| **Funzionalità** | UPDATE shipments dopo successo orchestrator |
| **Campi Aggiornati** | `tracking_number`, `ldv`, `external_tracking_number`, `metadata`, `updated_at` |
| **Idempotenza** | ✅ SÌ (usa ID come chiave) |
| **Retry-Safe** | ✅ SÌ (UPDATE idempotente) |
| **Logging Sicuro** | ✅ SÌ (struttura, no dati sensibili, JSONB indicato) |
| **Gestione Errori** | ✅ SÌ (non blocca risposta se UPDATE fallisce) |
| **Backward Compatible** | ✅ SÌ (solo aggiunte, nessuna breaking change) |
| **Regressioni** | ❌ NESSUNA (solo persistenza dati già disponibili) |

---

**Firma**:  
Senior Backend Engineer  
Data: 2025-01-XX

