# 🧪 Guida Test Funzionalità Integrate

**Data:** Test immediato delle funzionalità integrate da Claude  
**Server:** Avviato in background su `http://localhost:3000`

---

## ✅ Checklist Pre-Test

Prima di iniziare, verifica che:
- [x] Server di sviluppo avviato (`npm run dev`)
- [x] Browser aperto su `http://localhost:3000`
- [x] Sei loggato nel sistema
- [x] Hai almeno 1 spedizione creata (per testare filtri ed export)

---

## 🧪 TEST 1: OCR Upload nella Nuova Spedizione

### Obiettivo:
Testare l'estrazione automatica dei dati da un'immagine.

### Passi:

1. **Vai alla pagina nuova spedizione:**
   ```
   http://localhost:3000/dashboard/spedizioni/nuova
   ```

2. **Attiva modalità AI Import:**
   - Cerca il toggle "Manuale" / "AI Import" in alto a destra
   - Clicca su "AI Import" (con icona Sparkles ✨)

3. **Verifica che appaia la sezione OCR:**
   - Dovresti vedere una sezione "Importa da Immagine (OCR)"
   - Con un'area drag & drop per caricare immagini

4. **Carica un'immagine:**
   - **Opzione A:** Crea uno screenshot WhatsApp con dati destinatario
   - **Opzione B:** Usa una foto di un documento con indirizzo
   - **Opzione C:** Usa qualsiasi immagine (il mock OCR genererà dati di esempio)

5. **Verifica estrazione:**
   - Dopo il caricamento, dovresti vedere "Dati estratti con successo!"
   - I campi destinatario dovrebbero essere popolati automaticamente:
     - Nome
     - Indirizzo
     - Città
     - Provincia
     - CAP
     - Telefono
     - Email

6. **Completa il form:**
   - Compila i dati mittente
   - Verifica/modifica i dati destinatario estratti
   - Compila peso e dimensioni
   - Crea la spedizione

### ✅ Risultato Atteso:
- Sezione OCR visibile quando "AI Import" è attivo
- Upload immagine funzionante
- Dati estratti e form popolato automaticamente
- Possibilità di modificare i dati estratti

### ❌ Se qualcosa non funziona:
- Verifica console browser (F12) per errori
- Controlla che l'API `/api/ocr/extract` risponda
- Verifica che il componente `OCRUpload` sia importato correttamente

---

## 🧪 TEST 2: Filtri Avanzati nella Lista Spedizioni

### Obiettivo:
Testare i filtri combinati per trovare spedizioni specifiche.

### Passi:

1. **Vai alla lista spedizioni:**
   ```
   http://localhost:3000/dashboard/spedizioni
   ```

2. **Verifica presenza filtri:**
   - Dovresti vedere una barra filtri con:
     - Campo ricerca (destinatario, tracking, città)
     - Dropdown Status (Tutti, In Preparazione, In Transito, etc.)
     - Dropdown Corriere (Tutti, GLS, BRT, DHL, etc.) ← **NUOVO!**
     - Dropdown Data (Tutti, Oggi, Ultima settimana, Ultimo mese)

3. **Test filtro ricerca:**
   - Digita un nome destinatario o tracking number
   - Verifica che le spedizioni vengano filtrate in tempo reale
   - Prova a cercare per città

4. **Test filtro status:**
   - Seleziona "In Preparazione"
   - Verifica che vengano mostrate solo spedizioni con quello status
   - Prova altri status

5. **Test filtro corriere:**
   - Seleziona un corriere (es. "GLS")
   - Verifica che vengano mostrate solo spedizioni con quel corriere
   - Prova altri corrieri

6. **Test filtro data:**
   - Seleziona "Oggi"
   - Verifica che vengano mostrate solo spedizioni di oggi
   - Prova "Ultima settimana" e "Ultimo mese"

7. **Test filtri combinati:**
   - Combina ricerca + status + corriere + data
   - Verifica che i filtri funzionino insieme
   - Esempio: Cerca "Mario" + Status "In Transito" + Corriere "GLS" + Data "Oggi"

### ✅ Risultato Atteso:
- Tutti i filtri visibili e funzionanti
- Filtri combinabili tra loro
- Risultati aggiornati in tempo reale
- Contatore risultati aggiornato

### ❌ Se qualcosa non funziona:
- Verifica che ci siano spedizioni nel database
- Controlla console browser per errori
- Verifica che i filtri siano applicati correttamente

---

## 🧪 TEST 3: Export Multiplo (CSV, XLSX, PDF)

### Obiettivo:
Testare l'export delle spedizioni in 3 formati diversi.

### Passi:

1. **Vai alla lista spedizioni:**
   ```
   http://localhost:3000/dashboard/spedizioni
   ```

2. **Verifica pulsante Export:**
   - Dovresti vedere un pulsante "Esporta" (con icona Download)
   - Il pulsante dovrebbe essere visibile solo se ci sono spedizioni

3. **Test export CSV:**
   - Clicca su "Esporta"
   - Dovrebbe apparire un dropdown con 3 opzioni
   - Clicca su "Esporta CSV"
   - Verifica che venga scaricato un file `.csv`
   - Apri il file in Excel e verifica i dati

4. **Test export XLSX:**
   - Clicca su "Esporta"
   - Clicca su "Esporta XLSX"
   - Verifica che venga scaricato un file `.xlsx`
   - Apri il file in Excel e verifica formattazione

5. **Test export PDF:**
   - Clicca su "Esporta"
   - Clicca su "Esporta PDF"
   - Verifica che venga scaricato un file `.pdf`
   - Apri il file e verifica layout professionale

6. **Test export con filtri:**
   - Applica un filtro (es. solo "GLS")
   - Clicca su "Esporta" → "Esporta CSV"
   - Verifica che vengano esportate solo le spedizioni filtrate

7. **Test export con molte spedizioni:**
   - Se hai molte spedizioni, prova l'export
   - Verifica che il file venga generato correttamente
   - Controlla che tutte le spedizioni siano incluse

### ✅ Risultato Atteso:
- Dropdown export con 3 opzioni (CSV, XLSX, PDF)
- File scaricati correttamente
- Formati corretti e leggibili
- Export applicato alle spedizioni filtrate
- Nome file con timestamp

### ❌ Se qualcosa non funziona:
- Verifica che `ExportService` sia importato correttamente
- Controlla console browser per errori
- Verifica che i moduli export (CSV, XLSX, PDF) esistano
- Controlla che ci siano spedizioni da esportare

---

## 🔍 Debug e Troubleshooting

### Errori Comuni:

#### 1. OCR non funziona
```
Errore: "Servizio OCR non disponibile"
```
**Soluzione:**
- Verifica che l'API `/api/ocr/extract` esista
- Controlla che `createOCRAdapter` funzioni
- Il mock OCR dovrebbe sempre funzionare

#### 2. Export non funziona
```
Errore: "Formato non supportato"
```
**Soluzione:**
- Verifica che `ExportService` sia importato
- Controlla che i moduli export esistano in `lib/adapters/export/`
- Verifica che le dipendenze siano installate (`jspdf`, `xlsx`, etc.)

#### 3. Filtri non funzionano
```
Le spedizioni non vengono filtrate
```
**Soluzione:**
- Verifica che i filtri siano applicati correttamente
- Controlla che `useMemo` funzioni
- Verifica che i dati spedizioni abbiano i campi corretti

---

## 📊 Checklist Test Completa

### OCR Upload:
- [ ] Toggle "AI Import" visibile e funzionante
- [ ] Sezione OCR appare quando attivo
- [ ] Upload immagine funziona
- [ ] Estrazione dati funziona
- [ ] Form popolato automaticamente
- [ ] Possibilità di modificare dati estratti

### Filtri Avanzati:
- [ ] Campo ricerca funziona
- [ ] Filtro status funziona
- [ ] Filtro corriere funziona (NUOVO)
- [ ] Filtro data funziona
- [ ] Filtri combinabili tra loro
- [ ] Risultati aggiornati in tempo reale

### Export Multiplo:
- [ ] Pulsante "Esporta" visibile
- [ ] Dropdown con 3 opzioni appare
- [ ] Export CSV funziona
- [ ] Export XLSX funziona
- [ ] Export PDF funziona
- [ ] Export applicato a spedizioni filtrate
- [ ] File scaricati correttamente

---

## 🎯 Prossimi Test (Opzionali)

### Test Avanzati:

1. **Test OCR con immagini diverse:**
   - Screenshot WhatsApp
   - Foto documento
   - Immagine con testo poco chiaro

2. **Test Export con molti dati:**
   - Export di 100+ spedizioni
   - Verifica performance
   - Verifica dimensioni file

3. **Test Filtri complessi:**
   - Combinazioni multiple di filtri
   - Ricerca con caratteri speciali
   - Filtri con date specifiche

---

## 📝 Note Finali

- **Server:** `http://localhost:3000`
- **Tempo stimato test completo:** 15-20 minuti
- **Prerequisiti:** Almeno 3-5 spedizioni create per test completi

**Buon test! 🚀**

Se trovi problemi, controlla la console browser (F12) e dimmi cosa vedi!


