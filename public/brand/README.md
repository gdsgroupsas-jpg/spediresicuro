# 📁 Brand Assets - SpedireSicuro.it

## 📋 Struttura File

Questa cartella contiene tutti gli asset del brand SpedireSicuro.

### `/logo/` - File Logo

**File richiesti:**

1. `logo-horizontal.png` - Logo completo orizzontale (icona + testo)
   - Dimensioni consigliate: 200x60px (o proporzioni simili)
   - Formato: PNG con trasparenza
   - Uso: Header desktop, footer

2. `logo-icon.png` - Solo icona (fulmine + orbita)
   - Dimensioni consigliate: 64x64px
   - Formato: PNG con trasparenza
   - Uso: Header mobile, favicon, social cards

3. `logo-stacked.png` - Logo verticale (icona sopra testo)
   - Dimensioni consigliate: 120x120px
   - Formato: PNG con trasparenza
   - Uso: Mobile header, email signature

4. `logo-black.png` - Versione monocromatica nera
   - Dimensioni: Stesse del logo-horizontal
   - Formato: PNG con trasparenza
   - Uso: Sfondi chiari, stampa

5. `logo-white.png` - Versione monocromatica bianca
   - Dimensioni: Stesse del logo-horizontal
   - Formato: PNG con trasparenza
   - Uso: Sfondi scuri, footer dark

### `/favicon/` - File Favicon

**File richiesti:**

1. `favicon.ico` - Favicon principale
   - Dimensioni: 32x32px (multiresolution)
   - Formato: ICO
   - Uso: Browser tab

2. `favicon-16x16.png` - Favicon piccolo
   - Dimensioni: 16x16px
   - Formato: PNG
   - Uso: Browser tab (fallback)

3. `favicon-32x32.png` - Favicon medio
   - Dimensioni: 32x32px
   - Formato: PNG
   - Uso: Browser tab, bookmarks

4. `apple-touch-icon.png` - Icona iOS
   - Dimensioni: 180x180px
   - Formato: PNG
   - Uso: Home screen iOS

## 🎨 Colori Brand Ufficiali

Dal logo, i colori ufficiali sono:

- **Giallo/Arancione gradiente**: `#FFD700` → `#FF9500`
- **Azzurro tech**: `#00B8D4`
- **Nero**: `#000000`
- **Grigio**: `#666666`

## 📝 Come Estrarre le Immagini

### Metodo 1: Usando GIMP (Gratuito)

1. Apri l'immagine composita in GIMP
2. Usa lo strumento "Selezione rettangolare"
3. Seleziona ogni logo
4. `Modifica` → `Copia`
5. `File` → `Crea` → `Immagine dal clipboard`
6. `File` → `Esporta come` → Salva come PNG
7. Ripeti per ogni versione

### Metodo 2: Usando Photoshop

1. Apri l'immagine composita
2. Usa lo strumento "Ritaglio" o "Selezione rettangolare"
3. Seleziona ogni logo
4. `Modifica` → `Copia`
5. `File` → `Nuovo` → `Da clipboard`
6. `File` → `Esporta` → `Esporta come PNG`
7. Ripeti per ogni versione

### Metodo 3: Usando Online Tools (Più Veloce)

1. Vai su https://www.iloveimg.com/crop-image
2. Carica l'immagine composita
3. Ritaglia ogni logo
4. Scarica come PNG
5. Ripeti per ogni versione

### Metodo 4: Usando Canva (Se hai account)

1. Carica l'immagine in Canva
2. Usa lo strumento "Ritaglia"
3. Esporta ogni sezione come PNG
4. Scarica

## ✅ Checklist Estrazione

- [ ] logo-horizontal.png (200x60px circa)
- [ ] logo-icon.png (64x64px)
- [ ] logo-stacked.png (120x120px)
- [ ] logo-black.png (stesse dimensioni horizontal)
- [ ] logo-white.png (stesse dimensioni horizontal)
- [ ] favicon.ico (32x32px)
- [ ] favicon-16x16.png
- [ ] favicon-32x32.png
- [ ] apple-touch-icon.png (180x180px)

## 🚀 Dopo l'Estrazione

Una volta estratti tutti i file, salvali nelle rispettive cartelle:

- Logo files → `/public/brand/logo/`
- Favicon files → `/public/brand/favicon/`

Il codice è già configurato per usare questi file!

## 📐 Dimensioni Consigliate

Per ottimizzare le performance:

- **Logo header**: Max 200px larghezza, altezza 40-48px
- **Logo footer**: Max 150px larghezza, altezza 32px
- **Icona mobile**: 48x48px
- **Favicon**: 32x32px (multiresolution ICO)
- **Social cards**: 1200x630px (per og:image)

## 💡 Note

- Tutti i file devono avere sfondo trasparente (PNG)
- Ottimizza le immagini prima di caricarle (usa TinyPNG o simili)
- Mantieni le proporzioni originali del logo
- Non distorcere o modificare il logo

