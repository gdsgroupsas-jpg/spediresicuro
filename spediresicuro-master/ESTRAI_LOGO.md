# 🎯 ISTRUZIONI COMPLETE - Estrazione Logo SpedireSicuro

## ⚠️ PROBLEMA ATTUALE

Il logo non si vede perché **i file immagine non sono ancora stati estratti** dall'immagine composita e salvati nelle cartelle.

## 🎯 SOLUZIONE: Estrai le Immagini

---

## 📋 METODO 1: GIMP (CONSIGLIATO - GRATUITO)

### Passo 1: Installa GIMP
1. Vai su: https://www.gimp.org/downloads/
2. Scarica GIMP per Windows
3. Installa (lascia tutte le opzioni di default)

### Passo 2: Apri l'Immagine Composita
1. Apri GIMP
2. `File` → `Apri` (o `Ctrl+O`)
3. Seleziona l'immagine composita del logo che hai
4. Clicca `Apri`

### Passo 3: Estrai Logo Horizontal
1. Clicca sullo strumento **"Selezione rettangolare"** (icona quadrato tratteggiato) o premi `R`
2. **Seleziona** l'area del logo horizontal (quello con icona + testo "SPEDIRESI CURO")
3. Assicurati di includere tutto il logo senza tagliare nulla
4. `Modifica` → `Copia` (o `Ctrl+C`)
5. `File` → `Crea` → `Immagine dal clipboard` (o `Ctrl+Shift+V`)
6. Si apre una nuova finestra con solo il logo
7. `File` → `Esporta come` (o `Ctrl+Shift+E`)
8. Nome file: `logo-horizontal.png`
9. **IMPORTANTE**: Salva in: `C:\spediresicuro.it\public\brand\logo\`
10. Clicca `Esporta`
11. Nella finestra che si apre, clicca `Esporta` di nuovo

### Passo 4: Estrai Logo Icon
1. Torna all'immagine composita originale
2. Seleziona l'area con **solo l'icona** (fulmine + orbita, senza testo)
3. `Modifica` → `Copia`
4. `File` → `Crea` → `Immagine dal clipboard`
5. `File` → `Esporta come`
6. Nome: `logo-icon.png`
7. Salva in: `C:\spediresicuro.it\public\brand\logo\`
8. `Esporta` → `Esporta`

### Passo 5: Estrai Logo Stacked (se presente)
1. Se c'è una versione verticale (icona sopra, testo sotto), selezionala
2. `Modifica` → `Copia`
3. `File` → `Crea` → `Immagine dal clipboard`
4. `File` → `Esporta come`
5. Nome: `logo-stacked.png`
6. Salva in: `C:\spediresicuro.it\public\brand\logo\`
7. `Esporta` → `Esporta`

### Passo 6: Estrai Logo Nero
1. Seleziona la versione **monocromatica nera** del logo
2. `Modifica` → `Copia`
3. `File` → `Crea` → `Immagine dal clipboard`
4. `File` → `Esporta come`
5. Nome: `logo-black.png`
6. Salva in: `C:\spediresicuro.it\public\brand\logo\`
7. `Esporta` → `Esporta`

### Passo 7: Estrai Logo Bianco
1. Seleziona la versione **monocromatica bianca** (quella su sfondo nero)
2. `Modifica` → `Copia`
3. `File` → `Crea` → `Immagine dal clipboard`
4. `File` → `Esporta come`
5. Nome: `logo-white.png`
6. Salva in: `C:\spediresicuro.it\public\brand\logo\`
7. `Esporta` → `Esporta`

### Passo 8: Estrai Favicon
1. Seleziona il **favicon più grande** (quello 32x32 o 180x180)
2. `Modifica` → `Copia`
3. `File` → `Crea` → `Immagine dal clipboard`
4. `Immagine` → `Scala immagine` (per ridimensionare se necessario)
5. Per favicon.ico: Salva come `favicon-32x32.png` prima
6. Poi converti in ICO (vedi Metodo 2 per ICO)
7. Per apple-touch-icon: Ridimensiona a 180x180px
8. `File` → `Esporta come` → `apple-touch-icon.png`
9. Salva in: `C:\spediresicuro.it\public\brand\favicon\`

### Passo 9: Crea Favicon ICO
1. Vai su: https://convertio.co/png-ico/
2. Carica `favicon-32x32.png`
3. Converti in ICO
4. Scarica `favicon.ico`
5. Salva in: `C:\spediresicuro.it\public\brand\favicon\`

---

## 📋 METODO 2: ONLINE TOOL (PIÙ VELOCE)

### Passo 1: Vai su iLoveIMG
1. Apri browser
2. Vai su: https://www.iloveimg.com/crop-image
3. Clicca `Seleziona immagini`
4. Carica l'immagine composita del logo

### Passo 2: Ritaglia Ogni Logo
1. Usa il tool di ritaglio per selezionare ogni logo
2. Clicca `Ritaglia immagine`
3. Clicca `Scarica` per salvare
4. **Rinomina** il file con il nome corretto
5. **Sposta** nella cartella corretta:
   - Logo → `C:\spediresicuro.it\public\brand\logo\`
   - Favicon → `C:\spediresicuro.it\public\brand\favicon\`
6. Ripeti per ogni versione

---

## 📋 METODO 3: PHOTOSHOP (SE LO HAI)

1. Apri immagine composita in Photoshop
2. Usa strumento **"Ritaglio"** (C)
3. Seleziona ogni logo
4. `Modifica` → `Copia`
5. `File` → `Nuovo` → `Da clipboard`
6. `File` → `Esporta` → `Esporta come PNG`
7. Salva nella cartella corretta

---

## ✅ CHECKLIST FINALE

Dopo l'estrazione, verifica che questi file esistano:

```
C:\spediresicuro.it\public\brand\logo\
  ✅ logo-horizontal.png
  ✅ logo-icon.png
  ✅ logo-stacked.png
  ✅ logo-black.png
  ✅ logo-white.png

C:\spediresicuro.it\public\brand\favicon\
  ✅ favicon.ico
  ✅ favicon-16x16.png
  ✅ favicon-32x32.png
  ✅ apple-touch-icon.png
```

---

## 🚀 DOPO L'ESTRAZIONE

1. **Riavvia il server** (se è attivo):
   ```bash
   # Premi Ctrl+C nel terminale
   # Poi riavvia:
   npm run dev
   ```

2. **Apri browser**:
   - Vai su: `http://localhost:3000`
   - Fai **hard refresh**: `Ctrl+Shift+R`

3. **Verifica**:
   - Logo appare in header ✅
   - Favicon appare nel tab ✅
   - Footer mostra logo bianco ✅

---

## 🆘 SE NON FUNZIONA

### Problema: File non trovati
**Soluzione:**
1. Verifica percorso esatto: `C:\spediresicuro.it\public\brand\logo\`
2. Verifica nomi file esatti (case-sensitive)
3. Controlla console browser (F12) per errori 404

### Problema: Logo ancora non si vede
**Soluzione:**
1. Hard refresh: `Ctrl+Shift+R`
2. Svuota cache browser
3. Riavvia server: `npm run dev`
4. Controlla che i file siano PNG (non JPG)

---

## 📝 NOTE IMPORTANTI

1. **Nomi file devono essere ESATTI**:
   - `logo-horizontal.png` (non `logo-horizontal.PNG`)
   - `logo-icon.png` (non `logo-icon.jpg`)

2. **Formato PNG**:
   - Tutti i logo devono essere PNG con trasparenza
   - Non usare JPG (non supporta trasparenza)

3. **Dimensioni consigliate**:
   - logo-horizontal: ~200x60px
   - logo-icon: 64x64px
   - favicon: 32x32px
   - apple-touch-icon: 180x180px

4. **Ottimizzazione** (opzionale ma consigliata):
   - Vai su: https://tinypng.com/
   - Carica ogni immagine
   - Scarica versione ottimizzata
   - Sostituisci file originale

---

## 🎯 TEMPO STIMATO

- **Metodo GIMP**: 15-20 minuti
- **Metodo Online**: 10-15 minuti
- **Metodo Photoshop**: 10-15 minuti

---

## 💡 CONSIGLIO

**Usa il Metodo 1 (GIMP)** perché:
- ✅ Gratuito
- ✅ Controllo preciso
- ✅ Puoi ridimensionare se necessario
- ✅ Supporta trasparenza PNG perfettamente

---

## 📞 SE HAI PROBLEMI

Se incontri difficoltà:
1. Dimmi quale passo ti blocca
2. Invia screenshot dell'errore
3. Verifico insieme a te

**Inizia con il Metodo 1 (GIMP) - è il più affidabile!** 🚀

