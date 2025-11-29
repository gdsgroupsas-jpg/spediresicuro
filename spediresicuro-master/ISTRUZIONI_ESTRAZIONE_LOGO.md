# 🎯 ISTRUZIONI PASSO-PASSO - Estrai Logo SpedireSicuro

## ⚠️ SITUAZIONE ATTUALE

**Tutti i file logo sono MANCANTI!** Ecco perché il logo non si vede.

Lo script di verifica ha confermato che mancano:
- ❌ logo-horizontal.png
- ❌ logo-icon.png
- ❌ logo-stacked.png
- ❌ logo-black.png
- ❌ logo-white.png
- ❌ favicon.ico
- ❌ favicon-16x16.png
- ❌ favicon-32x32.png
- ❌ apple-touch-icon.png

---

## 🚀 SOLUZIONE: Estrai le Immagini dall'Immagine Composita

Hai già l'immagine composita con tutti i logo. Ora devi **estrarre** ogni singolo logo e salvarlo come file separato.

---

## 📋 METODO CONSIGLIATO: GIMP (Gratuito)

### PASSO 1: Installa GIMP

1. Apri browser
2. Vai su: **https://www.gimp.org/downloads/**
3. Clicca **"Download GIMP"**
4. Scarica la versione per Windows
5. Esegui il file scaricato
6. Installa (lascia tutte le opzioni di default)
7. **Apri GIMP**

**Tempo:** 5 minuti

---

### PASSO 2: Apri l'Immagine Composita

1. In GIMP, clicca **`File`** → **`Apri`** (oppure premi `Ctrl+O`)
2. Naviga fino alla cartella dove hai salvato l'immagine composita del logo
3. Seleziona l'immagine
4. Clicca **`Apri`**

**Ora vedi l'immagine composita in GIMP!**

---

### PASSO 3: Estrai Logo Horizontal

1. **Clicca** sullo strumento **"Selezione rettangolare"** (icona quadrato tratteggiato nella barra strumenti a sinistra)
   - Oppure premi il tasto **`R`** sulla tastiera

2. **Seleziona** l'area del logo horizontal:
   - Clicca e tieni premuto nell'angolo in alto a sinistra del logo
   - Trascina fino all'angolo in basso a destra
   - Assicurati di includere **tutto il logo** (icona + testo "SPEDIRESI CURO")
   - Non tagliare nulla!

3. **Copia** il logo selezionato:
   - Clicca **`Modifica`** → **`Copia`** (oppure premi `Ctrl+C`)

4. **Crea nuova immagine**:
   - Clicca **`File`** → **`Crea`** → **`Immagine dal clipboard`** (oppure premi `Ctrl+Shift+V`)
   - Si apre una nuova finestra con **solo il logo horizontal**

5. **Salva il logo**:
   - Clicca **`File`** → **`Esporta come`** (oppure premi `Ctrl+Shift+E`)
   - Nella finestra che si apre, naviga fino a: **`C:\spediresicuro.it\public\brand\logo\`**
   - Nome file: **`logo-horizontal.png`** (scrivilo esattamente così!)
   - Clicca **`Esporta`**
   - Nella finestra "Esporta immagine come PNG", clicca **`Esporta`** di nuovo

**✅ Primo logo estratto!**

---

### PASSO 4: Estrai Logo Icon

1. **Torna** all'immagine composita originale (chiudi la finestra del logo horizontal o clicca sulla tab originale)

2. **Seleziona** l'area con **solo l'icona** (fulmine arancione/giallo + orbita blu, **senza testo**):
   - Usa lo strumento "Selezione rettangolare" (R)
   - Seleziona solo l'icona, non il testo

3. **Copia**: `Modifica` → `Copia` (Ctrl+C)

4. **Crea nuova immagine**: `File` → `Crea` → `Immagine dal clipboard` (Ctrl+Shift+V)

5. **Salva**:
   - `File` → `Esporta come` (Ctrl+Shift+E)
   - Naviga a: **`C:\spediresicuro.it\public\brand\logo\`**
   - Nome: **`logo-icon.png`**
   - `Esporta` → `Esporta`

**✅ Secondo logo estratto!**

---

### PASSO 5: Estrai Logo Stacked (se presente)

1. Torna all'immagine composita

2. Seleziona la versione **verticale** (icona sopra, testo sotto)

3. `Modifica` → `Copia` (Ctrl+C)

4. `File` → `Crea` → `Immagine dal clipboard` (Ctrl+Shift+V)

5. `File` → `Esporta come` (Ctrl+Shift+E)
   - Naviga a: **`C:\spediresicuro.it\public\brand\logo\`**
   - Nome: **`logo-stacked.png`**
   - `Esporta` → `Esporta`

**✅ Terzo logo estratto!**

---

### PASSO 6: Estrai Logo Nero

1. Torna all'immagine composita

2. Seleziona la versione **monocromatica nera** del logo

3. `Modifica` → `Copia` (Ctrl+C)

4. `File` → `Crea` → `Immagine dal clipboard` (Ctrl+Shift+V)

5. `File` → `Esporta come` (Ctrl+Shift+E)
   - Naviga a: **`C:\spediresicuro.it\public\brand\logo\`**
   - Nome: **`logo-black.png`**
   - `Esporta` → `Esporta`

**✅ Quarto logo estratto!**

---

### PASSO 7: Estrai Logo Bianco

1. Torna all'immagine composita

2. Seleziona la versione **monocromatica bianca** (quella su sfondo nero)

3. `Modifica` → `Copia` (Ctrl+C)

4. `File` → `Crea` → `Immagine dal clipboard` (Ctrl+Shift+V)

5. `File` → `Esporta come` (Ctrl+Shift+E)
   - Naviga a: **`C:\spediresicuro.it\public\brand\logo\`**
   - Nome: **`logo-white.png`**
   - `Esporta` → `Esporta`

**✅ Quinto logo estratto!**

---

### PASSO 8: Estrai Favicon

1. Torna all'immagine composita

2. Seleziona il **favicon più grande** (quello 32x32 o 180x180)

3. `Modifica` → `Copia` (Ctrl+C)

4. `File` → `Crea` → `Immagine dal clipboard` (Ctrl+Shift+V)

5. **Ridimensiona se necessario**:
   - `Immagine` → `Scala immagine`
   - Per favicon-32x32: imposta 32x32 pixel
   - Per apple-touch-icon: imposta 180x180 pixel
   - Clicca `Scala`

6. **Salva favicon-32x32.png**:
   - `File` → `Esporta come` (Ctrl+Shift+E)
   - Naviga a: **`C:\spediresicuro.it\public\brand\favicon\`**
   - Nome: **`favicon-32x32.png`**
   - `Esporta` → `Esporta`

7. **Ridimensiona a 16x16** per favicon-16x16:
   - `Immagine` → `Scala immagine`
   - Imposta 16x16 pixel
   - `Scala`
   - `File` → `Esporta come`
   - Nome: **`favicon-16x16.png`**
   - Salva in: **`C:\spediresicuro.it\public\brand\favicon\`**

8. **Ridimensiona a 180x180** per apple-touch-icon:
   - `Immagine` → `Scala immagine`
   - Imposta 180x180 pixel
   - `Scala`
   - `File` → `Esporta come`
   - Nome: **`apple-touch-icon.png`**
   - Salva in: **`C:\spediresicuro.it\public\brand\favicon\`**

**✅ Favicon estratti!**

---

### PASSO 9: Crea Favicon.ico

Il formato ICO richiede un tool esterno:

1. Apri browser
2. Vai su: **https://convertio.co/png-ico/**
3. Clicca **"Scegli file"**
4. Seleziona: **`C:\spediresicuro.it\public\brand\favicon\favicon-32x32.png`**
5. Clicca **"Converti"**
6. Aspetta la conversione
7. Clicca **"Scarica"**
8. Salva il file come **`favicon.ico`** in: **`C:\spediresicuro.it\public\brand\favicon\`**

**✅ Favicon.ico creato!**

---

## ✅ VERIFICA FINALE

Dopo aver estratto tutti i file, verifica:

### Opzione 1: Usa lo Script
```bash
powershell -ExecutionPolicy Bypass -File scripts\verifica-logo.ps1
```

### Opzione 2: Verifica Manuale
Apri Esplora File e vai in:
- `C:\spediresicuro.it\public\brand\logo\`
- `C:\spediresicuro.it\public\brand\favicon\`

Verifica che tutti i file siano presenti!

---

## 🚀 DOPO L'ESTRAZIONE

1. **Riavvia il server** (se è attivo):
   - Nel terminale dove gira `npm run dev`, premi `Ctrl+C`
   - Poi riavvia: `npm run dev`

2. **Apri browser**:
   - Vai su: `http://localhost:3000`
   - Fai **hard refresh**: `Ctrl+Shift+R` (Windows) o `Cmd+Shift+R` (Mac)

3. **Verifica**:
   - ✅ Logo appare in header (alto a sinistra)
   - ✅ Favicon appare nel tab del browser
   - ✅ Footer mostra logo bianco
   - ✅ Nessun errore 404 in console (F12)

---

## 🆘 PROBLEMI COMUNI

### Problema: "File non trovato" in GIMP
**Soluzione:**
- Verifica che il percorso esista: `C:\spediresicuro.it\public\brand\logo\`
- Se non esiste, crealo manualmente in Esplora File

### Problema: Logo appare sfocato
**Soluzione:**
- Quando esporti, assicurati di non ridimensionare troppo
- Mantieni le dimensioni originali o scala proporzionalmente

### Problema: Favicon non si vede
**Soluzione:**
- Hard refresh: `Ctrl+Shift+R`
- Svuota cache browser
- Verifica formato ICO corretto

### Problema: Nome file sbagliato
**Soluzione:**
- I nomi devono essere **ESATTI**:
  - `logo-horizontal.png` (non `logo-horizontal.PNG`)
  - `logo-icon.png` (non `logo-icon.jpg`)
- Case-sensitive: usa sempre minuscole

---

## ⏱️ TEMPO STIMATO

- **Installazione GIMP**: 5 minuti
- **Estrazione 5 logo**: 10-15 minuti
- **Estrazione 4 favicon**: 5-10 minuti
- **Conversione ICO**: 2 minuti

**TOTALE: 20-30 minuti**

---

## 💡 CONSIGLIO FINALE

**Fai un logo alla volta**, non cercare di farli tutti insieme. Prenditi il tempo necessario per selezionare bene ogni logo.

**Se hai dubbi su quale logo estrarre**, dimmelo e ti aiuto a identificarlo!

---

## 📞 AIUTO

Se ti blocchi su un passo specifico:
1. Dimmi quale passo (es. "PASSO 3 - Estrai Logo Horizontal")
2. Descrivi cosa vedi o l'errore
3. Ti guido passo-passo

**Inizia con il PASSO 1 (Installa GIMP) e procedi in ordine!** 🚀

