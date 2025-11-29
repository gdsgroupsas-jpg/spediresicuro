/**
 * Mock OCR Adapter
 *
 * Implementazione mock per sviluppo e testing
 * Simula estrazione OCR con dati casuali realistici
 * 
 * NOTA: Per OCR reale, usa TesseractAdapter (richiede: npm install tesseract.js)
 */

import { OCRAdapter, type OCRResult, type OCROptions } from './base';

export class MockOCRAdapter extends OCRAdapter {
  constructor() {
    super('mock');
  }

  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    // Simula latenza realistica
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Genera dati mock realistici
    const mockData = this.generateMockData();

    return {
      success: true,
      confidence: 0.75 + Math.random() * 0.2, // 75-95% confidence
      extractedData: mockData,
      rawText: this.generateRawText(mockData),
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Mock sempre disponibile
  }

  private generateMockData() {
    const names = [
      'Mario Rossi',
      'Laura Bianchi',
      'Giuseppe Verdi',
      'Anna Ferrari',
      'Luca Romano',
      'Giulia Esposito',
      'Marco Colombo',
      'Sofia Ricci',
    ];

    const streets = [
      'Via Roma',
      'Via Garibaldi',
      'Corso Italia',
      'Piazza Duomo',
      'Via Mazzini',
      'Viale Europa',
      'Via XX Settembre',
      'Corso Vittorio Emanuele',
    ];

    const cities = [
      { city: 'Milano', zip: '20100', province: 'MI' },
      { city: 'Roma', zip: '00100', province: 'RM' },
      { city: 'Torino', zip: '10100', province: 'TO' },
      { city: 'Napoli', zip: '80100', province: 'NA' },
      { city: 'Bologna', zip: '40100', province: 'BO' },
      { city: 'Firenze', zip: '50100', province: 'FI' },
      { city: 'Genova', zip: '16100', province: 'GE' },
      { city: 'Venezia', zip: '30100', province: 'VE' },
    ];

    const name = names[Math.floor(Math.random() * names.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const number = Math.floor(Math.random() * 200) + 1;
    const cityData = cities[Math.floor(Math.random() * cities.length)];
    const phone = `3${Math.floor(Math.random() * 9)}${Math.floor(10000000 + Math.random() * 90000000)}`;

    return {
      recipient_name: name,
      recipient_address: `${street}, ${number}`,
      recipient_city: cityData.city,
      recipient_zip: cityData.zip,
      recipient_province: cityData.province,
      recipient_phone: phone,
      recipient_email: Math.random() > 0.5 ? `${name.toLowerCase().replace(' ', '.')}@example.com` : undefined,
      notes: Math.random() > 0.7 ? 'Citofono: Piano 2' : undefined,
    };
  }

  private generateRawText(data: any): string {
    return `
DESTINATARIO: ${data.recipient_name}
Indirizzo: ${data.recipient_address}
${data.recipient_zip} ${data.recipient_city} (${data.recipient_province})
Tel: ${data.recipient_phone}
${data.recipient_email ? `Email: ${data.recipient_email}` : ''}
${data.notes ? `Note: ${data.notes}` : ''}
    `.trim();
  }
}

/**
 * Improved Mock OCR Adapter
 * 
 * Versione migliorata che simula meglio l'estrazione reale
 * (usata come fallback se Tesseract non disponibile)
 */
export class ImprovedMockOCRAdapter extends MockOCRAdapter {
  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    // Simula latenza più realistica
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

    // Genera dati più vari e realistici
    const mockData = this.generateImprovedMockData();

    return {
      success: true,
      confidence: 0.80 + Math.random() * 0.15, // 80-95% confidence
      extractedData: mockData,
      rawText: this.generateRawText(mockData),
    };
  }

  private generateImprovedMockData() {
    const names = [
      'Mario Rossi', 'Laura Bianchi', 'Giuseppe Verdi', 'Anna Ferrari',
      'Luca Romano', 'Giulia Esposito', 'Marco Colombo', 'Sofia Ricci',
      'Francesco Russo', 'Elena Marino', 'Alessandro Greco', 'Chiara Conti',
      'Davide Galli', 'Valentina Moretti', 'Andrea Costa', 'Martina Fontana',
    ];

    const streets = [
      'Via Roma', 'Via Garibaldi', 'Corso Italia', 'Piazza Duomo',
      'Via Mazzini', 'Viale Europa', 'Via XX Settembre', 'Corso Vittorio Emanuele',
      'Via Dante', 'Via Manzoni', 'Via Verdi', 'Via Cavour',
      'Via Nazionale', 'Via del Corso', 'Via Veneto', 'Via Appia',
    ];

    const cities = [
      { city: 'Milano', zip: '20100', province: 'MI' },
      { city: 'Roma', zip: '00100', province: 'RM' },
      { city: 'Torino', zip: '10100', province: 'TO' },
      { city: 'Napoli', zip: '80100', province: 'NA' },
      { city: 'Bologna', zip: '40100', province: 'BO' },
      { city: 'Firenze', zip: '50100', province: 'FI' },
      { city: 'Genova', zip: '16100', province: 'GE' },
      { city: 'Venezia', zip: '30100', province: 'VE' },
      { city: 'Palermo', zip: '90100', province: 'PA' },
      { city: 'Bari', zip: '70100', province: 'BA' },
    ];

    const name = names[Math.floor(Math.random() * names.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const number = Math.floor(Math.random() * 200) + 1;
    const cityData = cities[Math.floor(Math.random() * cities.length)];
    
    // Telefono più realistico
    const phonePrefix = ['3', '3', '3', '3', '3', '0'][Math.floor(Math.random() * 6)]; // Preferenza per mobile
    const phoneNumber = phonePrefix === '3' 
      ? `${phonePrefix}${Math.floor(100000000 + Math.random() * 900000000)}`
      : `0${Math.floor(10000000 + Math.random() * 90000000)}`;

    return {
      recipient_name: name,
      recipient_address: `${street}, ${number}`,
      recipient_city: cityData.city,
      recipient_zip: cityData.zip,
      recipient_province: cityData.province,
      recipient_phone: phoneNumber,
      recipient_email: Math.random() > 0.3 ? `${name.toLowerCase().replace(/\s+/g, '.')}@${['gmail.com', 'yahoo.it', 'hotmail.com', 'libero.it'][Math.floor(Math.random() * 4)]}` : undefined,
      notes: Math.random() > 0.6 ? ['Citofono: Piano 2', 'Consegna solo mattina', 'Presso portiere', 'Campanello: Bianchi'][Math.floor(Math.random() * 4)] : undefined,
    };
  }
}
