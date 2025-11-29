# ✅ Feature: Download Automatico CSV/PDF Spedizione

**Implementato:** Download automatico di CSV o PDF quando si clicca "Genera Spedizione"

---

## 🎯 Funzionalità

Quando l'utente clicca su **"Genera Spedizione"**:

1. ✅ La spedizione viene creata e salvata nel database
2. ✅ Viene mostrato il messaggio di successo con tracking number
3. ✅ **Automaticamente viene scaricato** un file CSV o PDF con tutti i dati della spedizione
4. ✅ Dopo 3 secondi, reindirizza alla lista spedizioni

---

## 📋 Formato File

### CSV
- Nome file: `spedizione_[TRACKING]_[DATA].csv`
- Contenuto: Tutti i dati della spedizione in formato tabellare
- Encoding: UTF-8 con BOM (per Excel)

### PDF
- Nome file: `spedizione_[TRACKING]_[DATA].pdf`
- Contenuto: Ticket di spedizione formattato con:
  - Header con logo SpedireSicuro
  - Tracking number prominente
  - Dati mittente
  - Dati destinatario
  - Dettagli spedizione
  - Prezzo finale
  - Note (se presenti)
  - Footer con data generazione

---

## 🎨 UI

### Selettore Formato
Nella sidebar destra (Ticket di Spedizione), sopra il pulsante "Genera Spedizione":
- Due pulsanti: **📄 PDF** e **📊 CSV**
- Il formato selezionato è evidenziato in arancione
- Default: **PDF**

### Pulsante Genera
- Quando si clicca, genera la spedizione
- Dopo il successo, scarica automaticamente il file nel formato selezionato
- Mostra messaggio di successo con tracking number

---

## 📁 File Modificati/Creati

### Nuovi File:
- `lib/generate-shipment-document.ts` - Funzioni per generare CSV e PDF

### File Modificati:
- `app/dashboard/spedizioni/nuova/page.tsx` - Aggiunto download automatico

---

## 🔧 Dettagli Implementazione

### Funzioni CSV:
- `generateShipmentCSV()` - Genera contenuto CSV
- `downloadCSV()` - Scarica file CSV

### Funzioni PDF:
- `generateShipmentPDF()` - Genera documento PDF con jsPDF
- `downloadPDF()` - Scarica file PDF

### Integrazione:
- Dopo il successo della creazione spedizione, chiama le funzioni di download
- Delay di 500ms per assicurarsi che il rendering sia completo

---

## ✅ Test

1. Vai su `/dashboard/spedizioni/nuova`
2. Compila il form
3. Seleziona formato (PDF o CSV)
4. Clicca "Genera Spedizione"
5. Verifica che il file venga scaricato automaticamente
6. Verifica che il contenuto sia corretto

---

## 🎯 Risultato

✅ **Download automatico funzionante!**
- CSV: File con tutti i dati in formato tabellare
- PDF: Ticket formattato e professionale

---

**Feature completata e pronta per l'uso!** 🚀

