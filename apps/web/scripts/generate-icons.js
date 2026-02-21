/**
 * Script per generare icone PWA
 * Usa Canvas per creare icone PNG dalle SVG
 */

const fs = require('fs');
const path = require('path');

// Dimensioni icone richieste
const sizes = [192, 256, 384, 512];

// SVG source (versione semplificata)
const createSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD700" />
      <stop offset="100%" stop-color="#FFA500" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="100%" stop-color="#00D4FF" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="white" rx="64"/>
  <g transform="translate(64, 64) scale(0.75)">
    <path d="M256 425C162.65 425 87 349.35 87 256C87 162.65 162.65 87 256 87C302.5 87 345 105.5 375.5 136L405 106.5C366.5 68 313.5 44 256 44C138.5 44 44 138.5 44 256C44 373.5 138.5 468 256 468C313.5 468 366.5 444 405 405.5L375.5 376C345 406.5 302.5 425 256 425Z" fill="url(#ringGrad)"/>
    <path d="M140 400L290 75L225 225L325 225L175 550L240 400L140 400Z" fill="url(#arrowGrad)" opacity="0.9"/>
    <path d="M190 350L340 25L275 175L375 175L225 500L290 350L190 350Z" fill="url(#arrowGrad)"/>
  </g>
</svg>`;

// Directory di output
const outputDir = path.join(__dirname, 'public', 'icons');

// Crea directory se non esiste
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('📦 Generazione icone PWA...');
console.log('ℹ️  Per convertire SVG in PNG, usa un tool online o sharp');
console.log('ℹ️  Icone SVG salvate in:', outputDir);

// Salva SVG per ogni dimensione
sizes.forEach((size) => {
  const svgContent = createSVG(size);
  const svgPath = path.join(outputDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✅ Creato: icon-${size}x${size}.svg`);
});

// Crea anche le versioni maskable (con più padding)
const createMaskableSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD700" />
      <stop offset="100%" stop-color="#FFA500" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#0066FF" />
      <stop offset="100%" stop-color="#00D4FF" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="white"/>
  <g transform="translate(96, 96) scale(0.625)">
    <path d="M256 425C162.65 425 87 349.35 87 256C87 162.65 162.65 87 256 87C302.5 87 345 105.5 375.5 136L405 106.5C366.5 68 313.5 44 256 44C138.5 44 44 138.5 44 256C44 373.5 138.5 468 256 468C313.5 468 366.5 444 405 405.5L375.5 376C345 406.5 302.5 425 256 425Z" fill="url(#ringGrad)"/>
    <path d="M140 400L290 75L225 225L325 225L175 550L240 400L140 400Z" fill="url(#arrowGrad)" opacity="0.9"/>
    <path d="M190 350L340 25L275 175L375 175L225 500L290 350L190 350Z" fill="url(#arrowGrad)"/>
  </g>
</svg>`;

[192, 512].forEach((size) => {
  const svgContent = createMaskableSVG(size);
  const svgPath = path.join(outputDir, `icon-maskable-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✅ Creato: icon-maskable-${size}x${size}.svg`);
});

console.log('\n📝 Prossimi passi:');
console.log('1. Converti le SVG in PNG usando: https://cloudconvert.com/svg-to-png');
console.log('2. Oppure usa sharp: npm install sharp && node convert-icons.js');
console.log('3. Le icone sono pronte per la PWA!\n');
