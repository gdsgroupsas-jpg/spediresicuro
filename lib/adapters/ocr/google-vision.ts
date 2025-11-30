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
   */
  private parseItalianAddress(text: string): Record<string, string> {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

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

      // CAP (5 cifre)
      const zipMatch = line.match(/\b(\d{5})\b/);
      if (zipMatch && !result.recipient_zip) {
        result.recipient_zip = zipMatch[1];

        // La riga con CAP di solito contiene città e provincia
        // Es: "20100 Milano (MI)" o "00100 Roma RM"
        const cityMatch = line.match(/\d{5}\s+([A-Za-zàèéìòù\s]+?)(?:\s*\(?([A-Z]{2})\)?)?$/i);
        if (cityMatch) {
          result.recipient_city = cityMatch[1].trim();
          if (cityMatch[2]) {
            result.recipient_province = cityMatch[2].toUpperCase();
          }
        }
      }

      // Telefono
      const phone = this.extractPhone(line);
      if (phone && !result.recipient_phone) {
        result.recipient_phone = phone;
      }

      // Email
      const email = this.extractEmail(line);
      if (email && !result.recipient_email) {
        result.recipient_email = email;
      }

      // Nome/Cognome/Ragione Sociale (di solito prima riga o dopo "Destinatario:")
      // Distingui tra persona fisica e giuridica
      if (i === 0 && !result.recipient_name && line.length > 3 && line.length < 80) {
        // Se contiene indicatori aziendali, è ragione sociale
        const isCompany = /\b(S\.r\.l\.|S\.p\.A\.|S\.n\.c\.|S\.a\.s\.|S\.r\.l|SPA|SRL|SNC|SAS)\b/i.test(line);
        // Se contiene titoli, è persona fisica
        const isPerson = /\b(Dott\.|Dott\.ssa|Sig\.|Sig\.ra|Sig\.na|Avv\.|Ing\.|Arch\.)\b/i.test(line);
        
        if (isCompany || isPerson || !/\d/.test(line)) {
          // Probabilmente è un nome, non un indirizzo
          result.recipient_name = line;
        }
      }

      // Cerca dopo etichette comuni
      const lowerLine = line.toLowerCase();
      if ((lowerLine.includes('destinatario') || 
           lowerLine.includes('spedire a') || 
           lowerLine.includes('consegna a') ||
           lowerLine.includes('nome:')) && 
          i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.length > 2 && nextLine.length < 80) {
          result.recipient_name = nextLine;
        }
      }

      // Indirizzo completo (cerca via, corso, piazza, ecc. + numero civico)
      if (!result.recipient_address) {
        // Pattern per indirizzo: tipo strada + nome + numero
        const addressPattern = /^(via|corso|piazza|viale|largo|strada|vicolo|piazzale|lungomare|borgo|contrada|frazione)\s+[a-zàèéìòù\s]+(?:\s*,?\s*)(\d+[a-z]?)(?:\s*[/-]\s*\d+[a-z]?)?/i;
        const addressMatch = line.match(addressPattern);
        
        if (addressMatch) {
          // Estrai indirizzo completo con numero civico
          result.recipient_address = line.trim();
        } else if (/^(via|corso|piazza|viale|largo|strada|vicolo|piazzale|lungomare|borgo|contrada|frazione)/i.test(line)) {
          // Se inizia con tipo di strada ma non ha numero, prendi anche la riga successiva se ha numero
          if (i + 1 < lines.length && /\d+/.test(lines[i + 1])) {
            result.recipient_address = `${line.trim()}, ${lines[i + 1].trim()}`;
          } else {
            result.recipient_address = line.trim();
          }
        }
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
}
