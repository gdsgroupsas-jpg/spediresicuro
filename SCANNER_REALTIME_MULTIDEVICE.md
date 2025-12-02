# 📱🔗 Scanner LDV Multi-Device con Sincronizzazione Real-Time

## 🎯 OBIETTIVO

Creare un sistema dove:
- 📱 **Mobile/Tablet**: Scanner barcode/QR che legge LDV (come pistola scanner)
- 💻 **Desktop**: Lista spedizioni si aggiorna **automaticamente in tempo reale**
- ⚡ **Real-time**: Quando scansioni su mobile, appare subito su desktop (senza refresh)
- 🔄 **Multi-dispositivo**: Più dispositivi sincronizzati in tempo reale

---

## 🏗️ ARCHITETTURA

```
Mobile Scanner → Server Action → Supabase Database
                                    ↓
                            Supabase Realtime
                                    ↓
Desktop Lista ← Listener Real-Time ← Database Update
```

### Tecnologie:
- **Supabase Realtime**: Sincronizzazione automatica database → client
- **WebSockets**: Connessione persistente per aggiornamenti real-time
- **Mobile-First**: Scanner ottimizzato per smartphone/tablet

---

## ✅ IMPLEMENTAZIONE

### 1. **Abilitare Realtime su Supabase**

**File:** `supabase/migrations/012_enable_realtime_shipments.sql`

Abilita Realtime per la tabella `shipments`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE shipments;
```

### 2. **Configurare Client Supabase con Realtime**

**File:** `lib/db/client.ts`

Aggiungere configurazione Realtime al client:
```typescript
export const supabase = createClient(buildTimeUrl, buildTimeAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10 // Limita eventi per performance
    }
  }
});
```

### 3. **Componente Scanner Mobile-Optimized**

**File:** `components/ScannerLDVImport.tsx`

Caratteristiche:
- ✅ Fullscreen su mobile
- ✅ Landscape orientation
- ✅ Vibrazione quando scansiona
- ✅ Suono di feedback (opzionale)
- ✅ Auto-focus continuo
- ✅ Supporto barcode + QR code
- ✅ Funziona anche su desktop (con webcam)

### 4. **Listener Real-Time nella Lista**

**File:** `app/dashboard/spedizioni/page.tsx`

Aggiungere listener per aggiornamenti:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('shipments-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'shipments',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      // Aggiorna lista automaticamente
      setSpedizioni(prev => [payload.new, ...prev]);
      // Notifica utente
      toast.success('Nuova spedizione importata!');
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### 5. **Feedback Multi-Device**

Quando scansioni su mobile:
1. ✅ Vibrazione dispositivo mobile
2. ✅ Suono feedback (opzionale)
3. ✅ Toast/notifica su desktop
4. ✅ Badge "Nuovo" sulla spedizione
5. ✅ Animazione di inserimento

---

## 📱 OTTIMIZZAZIONI MOBILE

### Scanner Fullscreen
- Layout ottimizzato per smartphone
- Zona scansione grande e chiara
- Supporto landscape/portrait
- PWA-ready (può essere installato come app)

### Feedback Utente
- Vibrazione quando scansiona
- Suono "beep" (opzionale)
- Animazione successo
- Countdown prima di ri-scan

### Performance
- Scanner leggero e veloce
- Gestione memoria ottimizzata
- Chiusura camera quando non serve

---

## 🔄 FLUSSO COMPLETO

### Scenario: Scanner su Mobile

1. **Operatore apre scanner** su smartphone
2. **Scansiona LDV** con fotocamera
3. **Verifica duplicati** (se esiste, mostra errore)
4. **Importa spedizione** via Server Action
5. **Salva in database** (Supabase)
6. **Supabase Realtime** notifica tutti i client
7. **Desktop aggiorna** automaticamente la lista
8. **Mobile mostra** conferma vibrazione + suono

### Scenario: Scanner su Desktop

1. **Utente apre scanner** su desktop
2. **Usa webcam** per scansionare
3. **Stesso flusso** di mobile
4. **Lista si aggiorna** automaticamente

---

## 🚀 VANTAGGI

✅ **Tempo reale**: Nessun refresh manuale necessario
✅ **Multi-dispositivo**: Più operatori possono scansionare simultaneamente
✅ **Mobile-first**: Ottimizzato per uso operativo su smartphone
✅ **Scalabile**: Supabase Realtime gestisce migliaia di connessioni
✅ **Affidabile**: WebSocket riconnette automaticamente se cade

---

## 📋 FILE DA CREARE/MODIFICARE

### Nuovi File:
- ✅ `supabase/migrations/012_enable_realtime_shipments.sql`
- ⏳ `components/ScannerLDVImport.tsx` (mobile-optimized)
- ⏳ `hooks/useRealtimeShipments.ts` (hook per listener)

### File da Modificare:
- ⏳ `lib/db/client.ts` (configurazione realtime)
- ⏳ `app/dashboard/spedizioni/page.tsx` (aggiungere listener)
- ⏳ `actions/ldv-import.ts` (già fatto)

---

## ⚙️ CONFIGURAZIONE SUPABASE

### Dashboard Supabase:
1. Vai su **Database** → **Replication**
2. Abilita **Realtime** per tabella `shipments`
3. Verifica che RLS sia configurato correttamente

### SQL Migration:
Esegui `012_enable_realtime_shipments.sql` per abilitare automaticamente.

---

## 🧪 TESTING

### Test Mobile:
1. Apri scanner su smartphone
2. Scansiona barcode/QR
3. Verifica che appaia su desktop

### Test Desktop:
1. Apri lista spedizioni su desktop
2. Scansiona da mobile (o altro desktop)
3. Verifica aggiornamento automatico

### Test Multi-Device:
1. Apri lista su 2+ dispositivi
2. Scansiona da uno
3. Verifica sincronizzazione su tutti

---

## 🔧 PROBLEMI COMUNI

### Realtime non funziona:
- Verifica che Realtime sia abilitato su Supabase Dashboard
- Controlla che RLS permetta SELECT per l'utente
- Verifica connessione WebSocket (Network tab)

### Performance lente:
- Limita eventi realtime (eventsPerSecond: 10)
- Filtra per user_id nel listener
- Usa debounce per aggiornamenti UI

---

## ✅ CHECKLIST

- [x] Migration SQL Realtime
- [ ] Configurazione client Supabase
- [ ] Componente Scanner mobile-optimized
- [ ] Listener real-time lista spedizioni
- [ ] Feedback vibrazione mobile
- [ ] Toast notifiche desktop
- [ ] Test multi-dispositivo

