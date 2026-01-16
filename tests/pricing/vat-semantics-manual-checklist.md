# VAT Semantics - Manual Testing Checklist (ADR-001)

## ✅ FASE 8: Testing Manuale Enterprise-Grade

Questo documento contiene la checklist per il testing manuale della semantica IVA, come definito in ADR-001.

---

## 📋 Pre-requisiti

- [ ] Feature flag `NEXT_PUBLIC_SHOW_VAT_SEMANTICS` configurato (ON per test, OFF per produzione)
- [ ] Database migrato (migration 110 e 111 eseguite)
- [ ] Listini di test creati con diversi `vat_mode`

---

## 🧪 Test 1: Creazione Listino con VAT Mode

### 1.1 Listino IVA Esclusa

- [ ] Creare nuovo listino con `vat_mode = 'excluded'`
- [ ] Verificare che `vat_rate` sia impostato (default 22.00)
- [ ] Aggiungere entry alla matrice prezzi
- [ ] Verificare che i prezzi siano salvati correttamente

**Risultato Atteso:** Listino creato con `vat_mode = 'excluded'`, prezzi salvati come IVA esclusa.

---

### 1.2 Listino IVA Inclusa

- [ ] Creare nuovo listino con `vat_mode = 'included'`
- [ ] Verificare che `vat_rate` sia impostato (default 22.00)
- [ ] Aggiungere entry alla matrice prezzi
- [ ] Verificare che i prezzi siano salvati correttamente

**Risultato Atteso:** Listino creato con `vat_mode = 'included'`, prezzi salvati come IVA inclusa.

---

### 1.3 Listino Legacy (vat_mode = null)

- [ ] Verificare che listini esistenti (prima della migration) abbiano `vat_mode = 'excluded'` (dopo migration 111)
- [ ] Verificare che i prezzi calcolati siano identici a prima

**Risultato Atteso:** Listini legacy funzionano come prima, `vat_mode` default a `'excluded'`.

---

## 🧪 Test 2: Calcolo Prezzi nel Comparatore

### 2.1 Listino IVA Esclusa

- [ ] Creare preventivo con listino `vat_mode = 'excluded'`
- [ ] Verificare che il prezzo mostrato sia IVA esclusa
- [ ] Verificare che il badge VAT mostri "+ IVA 22%" (se feature flag ON)
- [ ] Verificare che `total_price_with_vat` sia calcolato correttamente

**Risultato Atteso:** Prezzo base IVA esclusa, badge mostra "+ IVA 22%", `total_price_with_vat = prezzo * 1.22`.

---

### 2.2 Listino IVA Inclusa

- [ ] Creare preventivo con listino `vat_mode = 'included'`
- [ ] Verificare che il prezzo mostrato sia IVA inclusa
- [ ] Verificare che il badge VAT mostri "IVA incl." (se feature flag ON)
- [ ] Verificare che `vat_amount` sia calcolato correttamente

**Risultato Atteso:** Prezzo base IVA inclusa, badge mostra "IVA incl.", `vat_amount = prezzo - (prezzo / 1.22)`.

---

### 2.3 Confronto Prezzi con VAT Mode Diversi

- [ ] Creare preventivo con listino master `vat_mode = 'excluded'` e custom `vat_mode = 'included'`
- [ ] Verificare che i prezzi siano normalizzati correttamente per il confronto
- [ ] Verificare che il comparatore mostri il prezzo migliore correttamente

**Risultato Atteso:** Prezzi normalizzati a base comune (IVA esclusa) per confronto, comparatore funziona correttamente.

---

## 🧪 Test 3: Margine su Base IVA Esclusa (Invariant #1)

### 3.1 Listino IVA Inclusa con Margine

- [ ] Creare listino `vat_mode = 'included'` con `default_margin_percent = 20`
- [ ] Creare preventivo
- [ ] Verificare che il margine sia calcolato su base IVA esclusa
- [ ] Verificare che il prezzo finale sia corretto

**Esempio:**
- Base price (IVA inclusa): 122€ (100€ + 22% IVA)
- Base price (IVA esclusa): 100€
- Margine (20% su base esclusa): 20€
- Prezzo finale (IVA inclusa): 146.40€ (120€ + 22% IVA)

**Risultato Atteso:** Margine calcolato su base IVA esclusa, prezzo finale corretto.

---

### 3.2 Listino IVA Esclusa con Margine

- [ ] Creare listino `vat_mode = 'excluded'` con `default_margin_percent = 20`
- [ ] Creare preventivo
- [ ] Verificare che il margine sia calcolato su base IVA esclusa
- [ ] Verificare che il prezzo finale sia corretto

**Esempio:**
- Base price (IVA esclusa): 100€
- Margine (20% su base esclusa): 20€
- Prezzo finale (IVA esclusa): 120€
- IVA (22%): 26.40€
- Prezzo totale con IVA: 146.40€

**Risultato Atteso:** Margine calcolato su base IVA esclusa, prezzo finale corretto.

---

## 🧪 Test 4: Surcharges seguono VAT Mode del Listino

### 4.1 Surcharges con Listino IVA Inclusa

- [ ] Creare listino `vat_mode = 'included'` con fuel surcharge
- [ ] Creare preventivo
- [ ] Verificare che il fuel surcharge sia normalizzato correttamente
- [ ] Verificare che il totale sia calcolato correttamente

**Risultato Atteso:** Surcharges normalizzati secondo `vat_mode` del listino, totale corretto.

---

### 4.2 Surcharges con Listino IVA Esclusa

- [ ] Creare listino `vat_mode = 'excluded'` con fuel surcharge
- [ ] Creare preventivo
- [ ] Verificare che il fuel surcharge sia trattato come IVA esclusa
- [ ] Verificare che il totale sia calcolato correttamente

**Risultato Atteso:** Surcharges trattati come IVA esclusa, totale corretto.

---

## 🧪 Test 5: Shipment Creation - Persistenza VAT Context

### 5.1 Creazione Spedizione con VAT Mode

- [ ] Creare preventivo con listino `vat_mode = 'included'`
- [ ] Selezionare offerta e creare spedizione
- [ ] Verificare che `vat_mode` e `vat_rate` siano salvati nel database
- [ ] Verificare che `final_price` sia corretto

**Risultato Atteso:** `vat_mode` e `vat_rate` salvati in `shipments`, `final_price` corretto.

---

### 5.2 Creazione Spedizione Legacy (senza VAT Context)

- [ ] Creare spedizione senza specificare `vat_mode` e `vat_rate`
- [ ] Verificare che i valori di default siano applicati (`vat_mode = 'excluded'`, `vat_rate = 22.0`)
- [ ] Verificare che la spedizione sia creata correttamente

**Risultato Atteso:** Valori di default applicati, spedizione creata correttamente.

---

## 🧪 Test 6: Dashboard - Visualizzazione VAT Badges

### 6.1 Dashboard Spedizioni con Feature Flag ON

- [ ] Impostare `NEXT_PUBLIC_SHOW_VAT_SEMANTICS=true`
- [ ] Aprire dashboard "Tutte le spedizioni"
- [ ] Verificare che i badge VAT siano mostrati accanto ai prezzi
- [ ] Verificare che i badge siano corretti (es. "+ IVA 22%" o "IVA incl.")

**Risultato Atteso:** Badge VAT mostrati correttamente, formattazione corretta.

---

### 6.2 Dashboard Spedizioni con Feature Flag OFF

- [ ] Impostare `NEXT_PUBLIC_SHOW_VAT_SEMANTICS=false`
- [ ] Aprire dashboard "Tutte le spedizioni"
- [ ] Verificare che i badge VAT NON siano mostrati
- [ ] Verificare che i prezzi siano mostrati normalmente

**Risultato Atteso:** Badge VAT nascosti, prezzi mostrati normalmente.

---

### 6.3 Dashboard Admin con Feature Flag ON

- [ ] Impostare `NEXT_PUBLIC_SHOW_VAT_SEMANTICS=true`
- [ ] Aprire dashboard admin
- [ ] Verificare che i badge VAT siano mostrati accanto ai prezzi
- [ ] Verificare che i badge siano corretti

**Risultato Atteso:** Badge VAT mostrati correttamente nella dashboard admin.

---

## 🧪 Test 7: Retrocompatibilità

### 7.1 Listini Esistenti (Pre-Migration)

- [ ] Verificare che listini esistenti (prima della migration) funzionino correttamente
- [ ] Verificare che i prezzi calcolati siano identici a prima
- [ ] Verificare che `vat_mode` sia impostato a `'excluded'` (dopo migration 111)

**Risultato Atteso:** Listini esistenti funzionano come prima, `vat_mode` default a `'excluded'`.

---

### 7.2 Spedizioni Esistenti (Pre-Migration)

- [ ] Verificare che spedizioni esistenti (prima della migration) siano visualizzate correttamente
- [ ] Verificare che `vat_mode` sia impostato a `'excluded'` (dopo migration 111)
- [ ] Verificare che i prezzi siano mostrati correttamente

**Risultato Atteso:** Spedizioni esistenti funzionano come prima, `vat_mode` default a `'excluded'`.

---

## 🧪 Test 8: Edge Cases

### 8.1 Prezzo Zero

- [ ] Creare listino con entry a prezzo 0€
- [ ] Verificare che il calcolo funzioni correttamente
- [ ] Verificare che IVA e margine siano calcolati correttamente (0€)

**Risultato Atteso:** Prezzo zero gestito correttamente, IVA e margine = 0€.

---

### 8.2 IVA Rate Diversi

- [ ] Creare listino con `vat_rate = 10%`
- [ ] Verificare che i calcoli siano corretti
- [ ] Verificare che i badge mostrino l'aliquota corretta

**Risultato Atteso:** IVA rate diversi gestiti correttamente, badge mostrano aliquota corretta.

---

### 8.3 Listino Personalizzato Modificato Manualmente

- [ ] Creare listino personalizzato con prezzi modificati manualmente
- [ ] Verificare che il margine sia calcolato correttamente
- [ ] Verificare che il confronto con il master list funzioni correttamente

**Risultato Atteso:** Margine calcolato correttamente, confronto funziona.

---

## ✅ Checklist Finale

- [ ] Tutti i test manuali completati
- [ ] Nessun errore o comportamento inatteso
- [ ] Documentazione aggiornata
- [ ] Feature flag testato (ON e OFF)
- [ ] Retrocompatibilità verificata
- [ ] Edge cases testati

---

## 📝 Note

- I test di integrazione automatizzati sono in `tests/integration/vat-semantics-flow.test.ts`
- I test di regressione sono in `tests/regression/vat-backward-compatibility.test.ts`
- I test unitari sono in `tests/pricing/vat-*.test.ts`

---

**Data Test:** _______________  
**Tester:** _______________  
**Risultato:** ☐ PASS ☐ FAIL  
**Note:** _______________
