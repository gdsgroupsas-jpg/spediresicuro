# OCR Vision Test Fixtures

Questa directory contiene immagini per integration test della pipeline OCR Vision.

## Come aggiungere nuove fixture

1. **Aggiungi l'immagine** nella cartella `ocr-images/`
   - Formati supportati: `.jpg`, `.jpeg`, `.png`, `.webp`
   - Naming: `XX_descrizione.ext` (es. `11_instagram_dm.jpg`)

2. **Aggiorna `expected.json`** con i campi attesi:

```json
{
  "11_instagram_dm.jpg": {
    "description": "Screenshot Instagram DM",
    "category": "messaging",
    "difficulty": "medium",
    "expectedFields": {
      "recipient_city": "Milano",
      "recipient_zip": "20100"
    },
    "optionalFields": ["recipient_name"],
    "expectedMissing": [],
    "notes": "Note opzionali"
  }
}
```

## Categorie disponibili

| Categoria | Descrizione |
|-----------|-------------|
| `whatsapp` | Screenshot da WhatsApp |
| `telegram` | Screenshot da Telegram |
| `messaging` | Altre app messaggistica |
| `label` | Etichette spedizione |
| `handwritten` | Indirizzi scritti a mano |
| `quality` | Test qualità immagine (blur, contrasto) |
| `rotation` | Immagini ruotate |
| `complex` | Casi complessi (multi-address) |

## Difficoltà

- `easy`: OCR standard, buona qualità
- `medium`: Qualche sfida (compressione, colori)
- `hard`: Difficile (blur, handwritten, parziale)

## Acceptance Criteria

Definiti in `expected.json > acceptanceCriteria`:

- **minFieldAccuracy**: >= 70% campi estratti correttamente
- **maxClarificationRate**: <= 40% immagini che richiedono clarification
- **requiredFields**: CAP, città, provincia
- **criticalFields**: CAP (deve essere sempre tentato)

## Note Privacy

⚠️ **NON includere immagini con dati reali di persone reali.**

Usare:
- Indirizzi fittizi
- Numeri telefono fake
- Nomi inventati

Per test con dati reali, usare ambiente dedicato con consent.

## Immagini Placeholder

Le fixture attuali sono placeholder. Sostituire con screenshot reali seguendo le istruzioni sopra.

Per generare immagini di test:
1. Creare chat WhatsApp/Telegram con indirizzo fittizio
2. Screenshot
3. Applicare trasformazioni (blur, rotate, compress) se necessario
4. Salvare in questa directory

