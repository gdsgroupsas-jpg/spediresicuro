# 📋 ISTRUZIONI POST-MIGRATION

## ✅ MIGRATION ESEGUITE

Hai eseguito correttamente:
1. ✅ `010_add_return_fields.sql` - Campi resi
2. ✅ `012_enable_realtime_shipments.sql` - Realtime
3. ✅ `011_add_ldv_scanner_feature.sql` - Killer feature scanner

---

## 🔍 STEP 1: VERIFICA MIGRATION

Esegui le query in `QUERY_VERIFICA_MIGRATION.sql` per verificare che tutto sia OK.

**Oppure verifica manualmente:**

### Verifica Campi Resi:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name IN ('is_return', 'original_shipment_id', 'return_reason', 'return_status');
```
**Dovresti vedere 4 righe.**

### Verifica Realtime:
1. Vai su **Supabase Dashboard** → **Database** → **Replication**
2. Verifica che `shipments` sia abilitata per Realtime
3. Se non lo è, **abilitala manualmente** cliccando il toggle

### Verifica Killer Feature:
```sql
SELECT code, name, is_free, is_available 
FROM killer_features 
WHERE code = 'ldv_scanner_import';
```
**Dovresti vedere 1 riga con `is_free = false`.**

---

## 🎯 STEP 2: ATTIVA KILLER FEATURE PER UTENTI

Come superadmin, devi attivare la feature per gli utenti che ne hanno bisogno.

### Opzione A: Via SQL (Rapido)

```sql
-- Sostituisci 'email_utente@example.com' con l'email reale
INSERT INTO user_features (user_email, feature_id, is_active, activation_type)
SELECT 
  'email_utente@example.com',
  kf.id,
  TRUE,
  'admin_grant'
FROM killer_features kf
WHERE kf.code = 'ldv_scanner_import'
ON CONFLICT (user_email, feature_id) 
DO UPDATE SET is_active = TRUE, activation_type = 'admin_grant';
```

### Opzione B: Via Dashboard Admin (Futuro)

Quando implementerai l'interfaccia admin per gestire le killer features, potrai farlo da lì.

---

## 🧪 STEP 3: TESTA IL SISTEMA

### Test 1: Verifica Pulsante Scanner
1. Accedi come utente con killer feature attiva
2. Vai su `/dashboard/spedizioni`
3. **Verifica**: Vedi pulsante "Scanner LDV" nell'header

### Test 2: Scanner Mobile → Desktop Real-Time
1. **Desktop**: Apri `/dashboard/spedizioni` su computer
2. **Mobile**: Apri stesso URL su smartphone (stesso account)
3. **Mobile**: Clicca "Scanner LDV"
4. **Mobile**: Scansiona un barcode/QR code (o inserisci manualmente)
5. **Desktop**: **Verifica**: La spedizione appare automaticamente senza refresh!

### Test 3: Verifica Duplicati
1. Scansiona una LDV già esistente
2. **Verifica**: Vedi warning "LDV già presente"
3. **Verifica**: Non crea duplicato

---

## ⚠️ PROBLEMI COMUNI

### Problema: "Pulsante Scanner non appare"
**Causa**: Killer feature non attiva per l'utente
**Soluzione**: Attiva la feature con la query SQL sopra

### Problema: "Realtime non funziona"
**Causa**: Realtime non abilitato in Supabase Dashboard
**Soluzione**: 
1. Vai su Supabase Dashboard → Database → Replication
2. Abilita Realtime per `shipments`

### Problema: "Errore durante import"
**Causa**: Verifica console browser per errori specifici
**Soluzione**: Controlla Network tab e Console per dettagli

---

## ✅ SE TUTTO FUNZIONA

Congratulazioni! 🎉

Il sistema è completamente operativo:
- ✅ Scanner mobile ottimizzato
- ✅ Sincronizzazione real-time
- ✅ Verifica duplicati
- ✅ Killer feature a pagamento
- ✅ Multi-dispositivo funzionante

**Pronto per l'uso operativo!** 🚀

---

## 📝 PROSSIMI STEP OPCIONALI

1. **Aggiungere toast/notifiche** quando arriva nuova spedizione
2. **Badge "Nuovo"** per spedizioni appena importate
3. **Statistiche scanner** (quante spedizioni importate via scanner)
4. **Cronologia scansioni** (log di tutte le scansioni)

---

## 🆘 SERVE AIUTO?

Se qualcosa non funziona:
1. Controlla console browser (F12)
2. Controlla Network tab per errori API
3. Verifica che Realtime sia abilitato
4. Verifica che killer feature sia attiva per l'utente

Dimmi cosa vedi e ti aiuto a risolvere! 😊


