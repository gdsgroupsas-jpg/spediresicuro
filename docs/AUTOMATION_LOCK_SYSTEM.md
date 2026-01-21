# 🔒 Sistema Lock Automation - Guida Completa

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## 🎯 PERCHÉ ESISTE QUESTO SISTEMA

### **Problema:**

Quando **TU** stai usando manualmente Spedisci.Online e l'**agent** vuole fare sync contemporaneamente, si crea un **conflitto**:

- ❌ L'agent fa login → invalida la tua sessione
- ❌ Tu fai login → invalida la sessione dell'agent
- ❌ Loop infinito di login/logout
- ❌ Session cookies invalide
- ❌ Impossibile lavorare

### **Soluzione:**

Sistema di **lock intelligente** che previene conflitti:

- ✅ **Lock Manuale**: Quando TU usi Spedisci.Online, l'agent aspetta
- ✅ **Lock Agent**: Quando l'agent lavora, previene doppio sync
- ✅ **Session Reuse**: L'agent riusa session valide invece di fare nuovo login
- ✅ **Auto-Expire**: Lock scadono automaticamente (previene deadlock)

---

## 🔧 COME FUNZIONA

### **1. Lock Manuale** 🔒

**Quando usare:**

- Prima di accedere manualmente a Spedisci.Online
- Quando devi lavorare sul tuo account per più di 5 minuti
- Quando vuoi essere sicuro che l'agent non interferisca

**Come funziona:**

1. Acquisisci lock manuale dalla dashboard
2. Lock dura **60 minuti** (configurabile)
3. L'agent **NON farà sync** mentre lock è attivo
4. Quando finisci, rilascia lock manualmente
5. Se dimentichi, lock scade automaticamente

**Vantaggi:**

- ✅ Nessun conflitto con agent
- ✅ Puoi lavorare tranquillamente
- ✅ Session non viene invalidata
- ✅ Auto-expire previene deadlock

### **2. Lock Agent** 🤖

**Quando si attiva:**

- Automaticamente quando l'agent inizia sync
- Previene doppio sync simultaneo
- Scade automaticamente dopo 30 minuti

**Come funziona:**

1. Agent verifica se c'è lock attivo
2. Se lock manuale → Agent aspetta (ritorna errore)
3. Se nessun lock → Agent acquisisce lock
4. Agent fa sync
5. Agent rilascia lock quando finisce

**Vantaggi:**

- ✅ Previene doppio sync simultaneo
- ✅ Auto-release dopo completamento
- ✅ Auto-expire previene deadlock

### **3. Session Reuse** ♻️

**Quando si attiva:**

- Prima di ogni sync, l'agent verifica session nel DB
- Se session valida (non scaduta) → Riusa quella
- Se session scaduta → Fa nuovo login

**Come funziona:**

1. Agent controlla `session_data` nel database
2. Verifica `expires_at` (se presente)
3. Se valida → Ritorna session esistente (NON fa login)
4. Se scaduta → Procede con estrazione nuova

**Vantaggi:**

- ✅ Evita login inutili
- ✅ Più veloce (non apre browser)
- ✅ Meno risorse utilizzate
- ✅ Meno probabilità di conflitti

---

## 📖 GUIDA UTILIZZO

### **Scenario 1: Uso Manuale Spedisci.Online**

**Cosa fare:**

1. **PRIMA** di aprire Spedisci.Online:
   - Vai su `/dashboard/admin/automation`
   - Clicca **"Lock Manuale"** sulla configurazione
   - Verifica che lock sia attivo (vedi "🔒 Manuale")

2. **USA** Spedisci.Online normalmente:
   - L'agent **NON interferirà**
   - Puoi lavorare tranquillamente
   - Session non viene invalidata

3. **DOPO** aver finito:
   - Torna su dashboard automation
   - Clicca **"Rilascia"** sul lock
   - L'agent può ora fare sync

**Se dimentichi di rilasciare:**

- Lock scade automaticamente dopo 60 minuti
- Oppure usa "Forza Sync" per ignorare lock

### **Scenario 2: Sync Manuale**

**Cosa fare:**

1. **Verifica Lock:**
   - Vai su dashboard automation
   - Controlla colonna "Lock"
   - Se "🔒 Manuale" → Rilascia prima di sync
   - Se "Libero" → Puoi procedere

2. **Esegui Sync:**
   - Clicca "Sync" sulla configurazione
   - Attendi completamento (30-60 secondi)
   - Verifica stato session

**Se sync fallisce con "Lock attivo":**

- Verifica se stai usando Spedisci.Online manualmente
- Rilascia lock manuale se presente
- Oppure usa "Forza Sync" (ignora lock)

### **Scenario 3: Sync Automatico (Cron)**

**Cosa succede:**

1. Cron job chiama sync automatico
2. Agent verifica lock attivo
3. Se lock manuale → Agent **aspetta** (non fa sync)
4. Se nessun lock → Agent fa sync normalmente
5. Se session valida → Agent riusa quella (NON fa login)

**Vantaggi:**

- ✅ Non interferisce se stai usando manualmente
- ✅ Riusa session valide (più veloce)
- ✅ Auto-retry al prossimo ciclo cron

---

## 🎛️ DASHBOARD AUTOMATION

### **Colonna "Lock":**

Mostra stato lock per ogni configurazione:

- **"Libero"** 🟢
  - Nessun lock attivo
  - Agent può fare sync
  - Puoi acquisire lock manuale

- **"🔒 Manuale"** 🟡
  - Lock manuale attivo
  - Agent **NON** farà sync
  - Mostra minuti rimanenti
  - Pulsante "Rilascia" disponibile

- **"🤖 Agent"** 🔵
  - Lock agent attivo
  - Agent sta facendo sync
  - Aspetta che finisca (max 30 min)

### **Pulsanti Disponibili:**

1. **"Lock Manuale"**
   - Acquisisci lock manuale (60 minuti)
   - Usa prima di lavorare su Spedisci.Online

2. **"Rilascia"**
   - Rilascia lock manuale
   - Permetti agent di fare sync

3. **"Sync"**
   - Sync normale (rispetta lock)
   - Se lock attivo → Errore

4. **"Forza Sync"**
   - Sync forzato (ignora lock)
   - ⚠️ Usa solo se sei sicuro che nessuno sta usando

---

## ⚙️ CONFIGURAZIONE

### **Durata Lock Manuale:**

Default: **60 minuti**

Per cambiare durata, modifica chiamata:

```typescript
await acquireManualLock(configId, 120); // 120 minuti = 2 ore
```

### **Durata Lock Agent:**

Default: **30 minuti**

Modificabile in `lib/automation/spedisci-online-agent.ts`:

```typescript
await this.acquireLock(configId, 'agent', 'Sistema automation', 30);
```

### **Auto-Expire:**

Lock scadono automaticamente anche se non rilasciati manualmente:

- Previene deadlock
- Previene lock "dimenticati"
- Sistema sempre funzionante

---

## 🐛 TROUBLESHOOTING

### **Problema: "Lock già attivo"**

**Causa:** Lock manuale o agent già attivo

**Soluzione:**

1. Vai su dashboard automation
2. Verifica tipo lock (Manuale o Agent)
3. Se Manuale → Rilascia se hai finito
4. Se Agent → Aspetta che finisca (max 30 min)

### **Problema: "Agent interferisce mentre uso manualmente"**

**Causa:** Non hai acquisito lock manuale

**Soluzione:**

1. **SEMPRE** acquisisci lock manuale prima di usare Spedisci.Online
2. Vai su dashboard automation
3. Clicca "Lock Manuale"
4. Verifica che lock sia attivo

### **Problema: "Lock non si rilascia"**

**Causa:** Raro, possibile deadlock

**Soluzione:**

1. Lock scade automaticamente dopo durata configurata
2. Oppure usa "Forza Sync" per ignorare lock
3. Verifica database: `automation_locks` table

### **Problema: "Session sempre scaduta"**

**Causa:** Lock manuale sempre attivo, agent non può fare sync

**Soluzione:**

1. Verifica lock attivi su dashboard
2. Rilascia lock manuali se non più necessari
3. Riduci durata lock manuale se troppo lunga

---

## 📊 MONITORAGGIO

### **Dashboard Automation:**

- ✅ Stato lock in tempo reale
- ✅ Minuti rimanenti per ogni lock
- ✅ Tipo lock (Manuale/Agent)
- ✅ Pulsanti azione rapida

### **Logs:**

Controlla logs server per:

- `🔒 [AGENT] Lock acquisito` - Lock acquisito
- `🔓 [AGENT] Lock rilasciato` - Lock rilasciato
- `⚠️ [AGENT] Lock già attivo` - Lock esistente
- `✅ [AGENT] Session esistente ancora valida` - Session riusata

---

## ✅ BEST PRACTICES

1. **SEMPRE acquisisci lock manuale** prima di usare Spedisci.Online
2. **Rilascia lock** quando hai finito di lavorare
3. **Verifica lock** prima di fare sync manuale
4. **Non usare "Forza Sync"** a meno che non sia necessario
5. **Monitora dashboard** per vedere lock attivi

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0  
**Autore:** Sistema Automation SpedireSicuro
