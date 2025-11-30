/**
 * Script di test per verificare che Tesseract.js funzioni
 */

async function testTesseract() {
  try {
    console.log('🔍 Test installazione Tesseract.js...\n');
    
    // Prova a importare Tesseract
    console.log('1. Import Tesseract.js...');
    const { createWorker } = await import('tesseract.js');
    console.log('   ✅ Tesseract.js importato correttamente\n');
    
    // Crea worker (questo scaricherà i modelli se non presenti)
    console.log('2. Creazione worker (scarica modelli se necessario)...');
    console.log('   ⏳ Questo può richiedere 1-2 minuti la prima volta...\n');
    
    const worker = await createWorker('ita+eng');
    console.log('   ✅ Worker creato correttamente\n');
    
    // Test con immagine semplice (base64 di un'immagine bianca)
    console.log('3. Test OCR con immagine di test...');
    const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    const { data } = await worker.recognize(testImage);
    console.log('   ✅ OCR funzionante!\n');
    console.log('   Testo estratto:', data.text || '(nessun testo trovato - normale per immagine bianca)');
    console.log('   Confidence:', data.confidence);
    
    // Termina worker
    await worker.terminate();
    console.log('\n✅ Tesseract.js funziona correttamente!');
    console.log('\n💡 I modelli linguistici sono stati scaricati.');
    console.log('   Ora puoi usare OCR reale nella tua applicazione!');
    
  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error('\nPossibili cause:');
    console.error('1. Tesseract.js non installato: npm install tesseract.js');
    console.error('2. Problema con la connessione internet (per scaricare modelli)');
    console.error('3. Permessi insufficienti per scrivere in node_modules');
  }
}

testTesseract();


