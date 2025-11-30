/**
 * Google Cloud Vision OCR Adapter
 *
 * OCR REALE con Google Cloud Vision API
 * Molto accurato per testo italiano
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { OCRAdapter, type OCRResult, type OCROptions } from './base';

export class GoogleVisionOCRAdapter extends OCRAdapter {
  private client: ImageAnnotatorClient | null = null;

  constructor() {
    super('google-vision');

    // Configura client se credenziali disponibili
    if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        this.client = new ImageAnnotatorClient({
          credentials,
        });
      } catch (error) {
        console.error('Errore parsing GOOGLE_CLOUD_CREDENTIALS:', error);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Oppure usa file di credenziali
      this.client = new ImageAnnotatorClient();
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }

  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    if (!this.client) {
      throw new Error(
        'Google Cloud Vision non disponibile. Configura GOOGLE_CLOUD_CREDENTIALS in .env.local'
      );
    }

    try {
      // Converti in Buffer se string
      const imageBuffer = typeof imageData === 'string' 
        ? Buffer.from(imageData, 'base64') 
        : imageData;

      // Esegui OCR con Google Vision
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer },
        imageContext: {
          languageHints: ['it', 'en'], // Italiano prioritario
        },
      });

      const detections = result.textAnnotations || [];
      
      if (detections.length === 0) {
        return {
          success: false,
          confidence: 0,
          extractedData: {},
          error: 'Nessun testo rilevato nell\'immagine',
        };
      }

      // Il primo elemento contiene tutto il testo
      const fullText = detections[0]?.description || '';

      // Estrai dati strutturati dal testo
      const extractedData = this.parseItalianAddress(fullText);

      // Calcola confidence
      const confidence = this.calculateConfidence(extractedData);

      return {
        success: true,
        confidence,
        extractedData,
        rawText: fullText,
      };
    } catch (error) {
      console.error('Errore Google Vision OCR:', error);

      return {
        success: false,
        confidence: 0,
        extractedData: {},
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Parse indirizzo italiano da testo OCR
   * Migliorato per distinguere etichette da valori e gestire screenshot WhatsApp
   */
  private parseItalianAddress(text: string): Record<string, string> {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    
    // Per screenshot WhatsApp, le prime righe contengono spesso nome e telefono
    const isWhatsAppScreenshot = this.detectWhatsAppScreenshot(lines);

    const result: Record<string, string> = {
      recipient_name: '',
      recipient_address: '',
      recipient_city: '',
      recipient_zip: '',
      recipient_province: '',
      recipient_phone: '',
      recipient_email: '',
      notes: '',
    };

    // Cerca pattern specifici
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // CAP (5 cifre) - cerca pattern più comuni
      const zipMatch = line.match(/\b(\d{5})\b/);
      if (zipMatch && !result.recipient_zip) {
        result.recipient_zip = zipMatch[1];

        // La riga con CAP di solito contiene città e provincia
        // Pattern comuni:
        // - "20100 Milano (MI)"
        // - "00100 Roma RM"
        // - "20100 Milano MI"
        // - "CAP 20100 Milano (MI)"
        const cityMatch = line.match(/\d{5}\s+([A-Za-zàèéìòù\s]+?)(?:\s*\(?([A-Z]{2})\)?|\s+([A-Z]{2}))?$/i);
        if (cityMatch) {
          result.recipient_city = cityMatch[1].trim();
          // Provincia può essere in parentesi o dopo la città
          const province = cityMatch[2] || cityMatch[3];
          if (province) {
            result.recipient_province = province.toUpperCase();
          }
        }
      }

      // Se abbiamo CAP ma non città, cerca città nella stessa riga o nelle righe successive
      if (result.recipient_zip && !result.recipient_city) {
        // Cerca città dopo il CAP nella stessa riga
        const cityAfterZip = line.match(/\d{5}\s+([A-Za-zàèéìòù\s]+)/i);
        if (cityAfterZip) {
          result.recipient_city = cityAfterZip[1].trim();
        }
      }

      // Se abbiamo città ma non provincia, cerca provincia nella stessa riga o nelle righe vicine
      if (result.recipient_city && !result.recipient_province) {
        // Cerca sigla provincia (2 lettere maiuscole) nella stessa riga
        const provinceMatch = line.match(/\b([A-Z]{2})\b/);
        if (provinceMatch && provinceMatch[1] !== result.recipient_zip) {
          result.recipient_province = provinceMatch[1];
        }
      }

      // Telefono - per screenshot WhatsApp cerca nelle prime righe e mantieni prefisso
      if (!result.recipient_phone) {
        // Se è screenshot WhatsApp, cerca nelle prime 5 righe (parte alta) e mantieni prefisso
        if (isWhatsAppScreenshot && i < 5) {
          const phone = this.extractPhoneWithPrefix(line);
          if (phone) {
            result.recipient_phone = phone;
          }
        } else {
          // Altrimenti cerca normalmente ma mantieni prefisso se presente
          const phone = this.extractPhoneWithPrefix(line);
          if (phone) {
            result.recipient_phone = phone;
          }
        }
      }

      // Email
      const email = this.extractEmail(line);
      if (email && !result.recipient_email) {
        result.recipient_email = email;
      }

      // Nome - DISTINGUI ETICHETTE DA VALORI REALI
      // Lista etichette comuni da NON estrarre
      const nameLabels = [
        'nome e cognome',
        'nome cognome',
        'nome:',
        'cognome:',
        'nome e cognome:',
        'nome completo',
      ];
      const isNameLabel = nameLabels.some(label => line.toLowerCase().trim() === label || line.toLowerCase().trim().startsWith(label));
      
      if (isNameLabel) {
        // Questa è un'etichetta, cerca il valore nella riga successiva
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Verifica che la riga successiva non sia un'altra etichetta
          const isNextLineLabel = nameLabels.some(label => nextLine.toLowerCase() === label || nextLine.toLowerCase().startsWith(label));
          if (!isNextLineLabel && nextLine.length > 2) {
            result.recipient_name = nextLine;
          }
        }
      } else if (line.toLowerCase().includes('destinatario') && i + 1 < lines.length) {
        // Se c'è "Destinatario:", prendi la riga successiva
        const nextLine = lines[i + 1].trim();
        if (!nameLabels.some(label => nextLine.toLowerCase() === label)) {
          result.recipient_name = nextLine;
        }
      } else if (i === 0 && !result.recipient_name && line.length > 3 && line.length < 50) {
        // Prima riga solo se non è un'etichetta
        if (!isNameLabel && !/^(telefono|tel|phone|indirizzo|via|corso|cap|provincia)/i.test(line)) {
          result.recipient_name = line;
        }
      }
      
      // Pattern per "Nome: Valore" o "Nome e Cognome: Valore"
      const nameValuePattern = /^(nome\s+e\s+cognome|nome|cognome)[\s:]+(.+)$/i;
      const nameValueMatch = line.match(nameValuePattern);
      if (nameValueMatch && nameValueMatch[2]) {
        const value = nameValueMatch[2].trim();
        // Verifica che il valore non sia un'etichetta
        if (!nameLabels.some(label => value.toLowerCase() === label)) {
          result.recipient_name = value;
        }
      }

      // Indirizzo (cerca via, corso, piazza, ecc.)
      if (!result.recipient_address && /^(via|corso|piazza|viale|largo|strada|vicolo)/i.test(line)) {
        result.recipient_address = line;
      }
    }

    // Se non trovato indirizzo, prova riga dopo nome
    if (!result.recipient_address && result.recipient_name) {
      const nameIndex = lines.findIndex((l) => l === result.recipient_name);
      if (nameIndex >= 0 && nameIndex + 1 < lines.length) {
        const potentialAddress = lines[nameIndex + 1];
        if (!/\d{5}/.test(potentialAddress)) {
          // Non è la riga del CAP
          result.recipient_address = potentialAddress;
        }
      }
    }

    return result;
  }

  /**
   * Calcola confidence score
   */
  private calculateConfidence(data: Record<string, string>): number {
    const requiredFields = ['recipient_name', 'recipient_address', 'recipient_city', 'recipient_zip'];
    
    let score = 0;
    let maxScore = 0;

    // Campi obbligatori (25 punti ciascuno)
    requiredFields.forEach((field) => {
      maxScore += 25;
      if (data[field] && data[field].length > 2) {
        score += 25;
      } else if (data[field] && data[field].length > 0) {
        score += 10;
      }
    });

    // Campi opzionali (5 punti ciascuno)
    const optionalFields = ['recipient_province', 'recipient_phone', 'recipient_email'];
    optionalFields.forEach((field) => {
      if (data[field] && data[field].length > 0) {
        score += 5;
      }
    });

    maxScore += optionalFields.length * 5;

    return Math.min(score / maxScore, 1);
  }

  /**
   * Rileva se è uno screenshot WhatsApp
   */
  private detectWhatsAppScreenshot(lines: string[]): boolean {
    // Cerca pattern tipici di WhatsApp nelle prime righe
    const firstLines = lines.slice(0, 5).join(' ').toLowerCase();
    return (
      firstLines.includes('whatsapp') ||
      firstLines.includes('wa.me') ||
      firstLines.includes('chat') ||
      // Pattern comune: nome contatto seguito da numero con prefisso nella parte alta
      (lines.length > 0 && lines[0].length > 0 && lines[0].length < 50 && 
       lines.some((l, i) => i < 3 && /(\+39|0039|\d{10,})/.test(l)))
    );
  }

  /**
   * Estrae telefono mantenendo prefisso se presente
   * Override del metodo base per mantenere prefisso per screenshot WhatsApp
   */
  protected extractPhoneWithPrefix(text: string): string | undefined {
    if (!text) return undefined;

    // Pattern per numeri con prefisso +39 o 0039 (mantieni tutto pari pari)
    const phoneWithPrefix = text.match(/(\+39|0039)[\s\-]?[\d\s\-]{8,12}/);
    if (phoneWithPrefix) {
      return phoneWithPrefix[0].trim(); // Mantieni spazi e formato originale
    }

    // Pattern per numeri italiani (3xx seguito da 6-7 cifre)
    const phonePattern = /(?:tel[elefono]*[\s:]*)?([\d\s\+\-\(\)]{8,15})/i;
    const match = text.match(phonePattern);
    if (match) {
      const phone = match[1].trim();
      // Se ha prefisso, mantienilo
      if (phone.match(/^(\+39|0039)/)) {
        return phone; // Mantieni formato originale
      }
      // Altrimenti usa il metodo base (normalizza)
      return this.extractPhone(text);
    }

    return undefined;
  }
}
