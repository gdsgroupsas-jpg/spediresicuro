# 💰 Spiegazione: Platform Fee vs Abbonamento

## 📋 Domande Frequenti

### 1. **Perché un reseller non viene mostrato come "Reseller" nella pagina Admin?**

**Problema risolto:** La pagina `/dashboard/admin` ora mostra correttamente il ruolo basandosi su `account_type` e `is_reseller` invece di solo `role`.

**Cosa è stato fixato:**

- ✅ La colonna "RUOLO" ora mostra "Reseller" per utenti con `account_type='reseller'` o `is_reseller=true`
- ✅ Mostra anche "Super Admin", "Admin", "BYOC" correttamente
- ✅ L'API `/api/admin/overview` ora include `account_type` e `is_reseller` nei dati

---

### 2. **Perché non posso modificare le fee per un reseller?**

**Risposta:** Le fee possono essere modificate **SOLO da SUPERADMIN**, non dai reseller stessi.

**Motivo di business:**

- Le **Platform Fee** sono un meccanismo di pricing configurabile per utente
- Solo il SUPERADMIN può impostare fee personalizzate (es. €0.30 per clienti enterprise, €0.00 per VIP)
- I reseller **non possono modificare le proprie fee** per evitare conflitti di interesse

**Come funziona:**

1. Il SUPERADMIN accede a `/dashboard/admin/users/[userId]`
2. Clicca su "Modifica Fee"
3. Imposta la fee desiderata (anche €0.00)
4. Il sistema salva e traccia la modifica nello storico

**Se non vedi il pulsante "Modifica Fee":**

- Verifica di essere loggato come SUPERADMIN
- Verifica che l'utente target esista
- Controlla i permessi nella console del browser

---

### 3. **Perché quando clicco 0 non si salva?**

**Problema risolto:** Il valore `0` ora viene salvato correttamente.

**Cosa è stato fixato:**

- ✅ La validazione accetta `0` come valore valido
- ✅ Il preset "Gratis (€0)" è disponibile per impostare rapidamente fee a zero
- ✅ Il backend accetta `newFee: 0` e lo salva nel database

**Come testare:**

1. Vai su `/dashboard/admin/users/[userId]`
2. Clicca "Modifica Fee"
3. Clicca il preset "Gratis (€0)" oppure inserisci manualmente `0`
4. Clicca "Salva"
5. Verifica che la fee mostrata sia `€0.00` con badge "Custom"

---

### 4. **Qual è la differenza tra Platform Fee e Abbonamento?**

## 🎯 Platform Fee (Fee per Etichetta)

**Cos'è:**

- Fee addebitata **per ogni spedizione** creata
- Applicata solo per il modello **BYOC (Bring Your Own Courier)**
- Configurabile per utente (default: €0.50)

**Quando si applica:**

- Utente ha **propri contratti corriere** (BYOC)
- Utente usa le **sue credenziali** per chiamare il corriere
- Il wallet interno **NON viene toccato** per la spedizione (solo per la fee)

**Esempio:**

```
Cliente BYOC crea 1 spedizione:
- Costo corriere: €8.50 (paga direttamente al corriere)
- Platform Fee: €0.50 (addebitata al wallet)
- Ricavo: €0.50 (solo fee, no margine su spedizione)
```

**Modelli di pricing:**

- **Default:** €0.50 per spedizione
- **Enterprise:** €0.30 per spedizione (volume alto)
- **VIP:** €0.00 per spedizione (gratis)
- **Custom:** Qualsiasi valore >= 0 configurato dal SUPERADMIN

---

## 💳 Abbonamento (Canone Mensile/Annuale)

**Cos'è:**

- Canone fisso **mensile o annuale** per accesso alla piattaforma
- **NON ancora implementato** nel sistema attuale
- Previsto per il modello SaaS/BYOC

**Quando si applica (futuro):**

- Cliente paga un canone fisso (es. €99/mese)
- In cambio, ottiene:
  - Accesso al software gestionale
  - Supporto tecnico
  - Possibile riduzione o eliminazione delle fee per etichetta

**Esempi di modelli ibridi (futuro):**

1. **Canone Base + Fee:**
   - €99/mese + €0.50 per etichetta
   - Per clienti con volume medio

2. **Canone Premium:**
   - €299/mese + €0.00 per etichetta (illimitato)
   - Per clienti enterprise con volume alto

3. **Solo Fee (attuale):**
   - €0.00/mese + €0.50 per etichetta
   - Per clienti con volume basso

---

## 🔄 Confronto: Fee vs Abbonamento

| Aspetto             | Platform Fee                       | Abbonamento                    |
| ------------------- | ---------------------------------- | ------------------------------ |
| **Modalità**        | Pay-per-use (per spedizione)       | Canone fisso (mensile/annuale) |
| **Quando si paga**  | Ogni volta che crei una spedizione | Una volta al mese/anno         |
| **Costo variabile** | Sì (dipende dal volume)            | No (fisso)                     |
| **Implementato**    | ✅ Sì (attivo)                     | ❌ No (previsto)               |
| **Configurabile**   | ✅ Sì (per utente)                 | ❌ No (non ancora)             |
| **Applicabile a**   | Modello BYOC                       | Modello SaaS/BYOC (futuro)     |

---

## 💡 Perché un Reseller con Abbonamento potrebbe pagare anche le Fee?

**Risposta breve:** Dipende dal modello di business scelto.

**Scenari possibili:**

### Scenario A: Solo Abbonamento (futuro)

```
Reseller paga: €99/mese
Fee per etichetta: €0.00
Totale: €99/mese fisso
```

**Vantaggio:** Prevedibilità dei costi per il reseller

### Scenario B: Abbonamento + Fee (futuro)

```
Reseller paga: €99/mese + €0.30 per etichetta
Esempio: 100 spedizioni/mese = €99 + €30 = €129/mese
```

**Vantaggio:** Canone base basso + fee ridotta per volume

### Scenario C: Solo Fee (attuale)

```
Reseller paga: €0.00/mese + €0.50 per etichetta
Esempio: 100 spedizioni/mese = €50/mese
```

**Vantaggio:** Nessun costo fisso, paga solo per uso

---

## 🎯 Conclusione

**Stato attuale:**

- ✅ **Platform Fee** è implementata e funzionante
- ✅ Configurabile per utente dal SUPERADMIN
- ✅ Supporta valori da €0.00 in su
- ❌ **Abbonamento** non è ancora implementato

**Per il futuro:**

- L'abbonamento sarà un sistema separato e complementare
- Potrà essere combinato con le fee (modello ibrido)
- Sarà configurabile per utente/reseller

**Per ora:**

- I reseller pagano solo le **Platform Fee** (se usano modello BYOC)
- Le fee possono essere impostate a **€0.00** dal SUPERADMIN
- Non c'è abbonamento mensile attivo

---

## 🔧 Come Impostare Fee a €0.00 per un Reseller

1. Accedi come **SUPERADMIN**
2. Vai su `/dashboard/admin`
3. Clicca sull'icona "Dettaglio Utente" (icona link) accanto al reseller
4. Nella sezione "Platform Fee (BYOC)", clicca **"Modifica Fee"**
5. Clicca il preset **"Gratis (€0)"** oppure inserisci manualmente `0`
6. Opzionale: Aggiungi una nota (es. "Reseller con accordo speciale")
7. Clicca **"Salva"**
8. Verifica che la fee mostrata sia `€0.00` con badge "Custom"

**Nota:** Il valore `0` è diverso da `NULL`:

- `NULL` = usa default (€0.50)
- `0` = fee esplicita a zero (gratis)
