/**
 * Claude Vision OCR Adapter
 *
 * Utilizza Anthropic Claude Vision API per estrazione dati da immagini LDV
 * Molto più accurato dei mock, estrazione reale tramite AI multimodale
 */

import Anthropic from '@anthropic-ai/sdk';
import { OCRAdapter, type OCRResult, type OCROptions } from './base';

export class ClaudeOCRAdapter extends OCRAdapter {
  private client: Anthropic | null = null;
  private apiKey: string | undefined;

  constructor() {
    super('claude-vision');
    this.apiKey = process.env.ANTHROPIC_API_KEY;

    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client && !!this.apiKey;
  }

  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    if (!this.client) {
      throw new Error(
        'Claude Vision API non disponibile. Configura ANTHROPIC_API_KEY in .env.local'
      );
    }

    try {
      // Converti immagine in base64 se è un Buffer
      const base64Image = typeof imageData === 'string' ? imageData : imageData.toString('base64');

      // Determina media type (assumiamo JPEG, ma potremmo rilevarlo)
      const mediaType = this.detectMediaType(base64Image);

      // Prompt ottimizzato per estrazione dati LDV italiana
      const prompt = `Analizza questa immagine di una Lettera di Vettura (LDV) o documento di spedizione italiano.

Estrai SOLO i dati del DESTINATARIO nel seguente formato JSON:

{
  "recipient_name": "Nome completo destinatario",
  "recipient_address": "Via/Corso e numero civico",
  "recipient_city": "Città",
  "recipient_zip": "CAP (5 cifre)",
  "recipient_province": "Sigla provincia (es: MI, RM, TO)",
  "recipient_phone": "Telefono",
  "recipient_email": "Email (se presente)",
  "notes": "Note aggiuntive (es: citofono, piano, orari)"
}

REGOLE IMPORTANTI:
- Restituisci SOLO il JSON, nessun altro testo
- Se un campo non è presente, usa stringa vuota ""
- Per il CAP, verifica sia 5 cifre
- Per provincia, usa SEMPRE sigla 2 lettere (es: "Milano" → "MI")
- Per telefono, normalizza formato italiano (rimuovi spazi/trattini)
- Concentrati SOLO sui dati del destinatario, NON del mittente
- Se trovi più indirizzi, prendi quello etichettato come "DESTINATARIO" o "CONSEGNA"

Esempio output corretto:
{
  "recipient_name": "Mario Rossi",
  "recipient_address": "Via Roma, 123",
  "recipient_city": "Milano",
  "recipient_zip": "20100",
  "recipient_province": "MI",
  "recipient_phone": "3331234567",
  "recipient_email": "mario.rossi@example.com",
  "notes": "Citofono: Rossi - Piano 3"
}`;

      // Chiamata API Claude Vision
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Modello Haiku più veloce ed economico
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      // Estrai testo dalla risposta
      const rawText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      // Parse JSON dalla risposta
      const extractedData = this.parseClaudeResponse(rawText);

      // Calcola confidence basato su completezza dati
      const confidence = this.calculateConfidence(extractedData);

      return {
        success: true,
        confidence,
        extractedData,
        rawText,
      };
    } catch (error) {
      console.error('Errore Claude Vision OCR:', error);

      return {
        success: false,
        confidence: 0,
        extractedData: {},
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Parse risposta Claude e estrai JSON
   */
  private parseClaudeResponse(rawText: string): Record<string, string> {
    try {
      // Trova JSON nella risposta (Claude a volte aggiunge testo prima/dopo)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('Nessun JSON trovato nella risposta Claude:', rawText);
        return {};
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Normalizza dati
      return {
        recipient_name: parsed.recipient_name?.trim() || '',
        recipient_address: parsed.recipient_address?.trim() || '',
        recipient_city: parsed.recipient_city?.trim() || '',
        recipient_zip: this.validateZip(parsed.recipient_zip) || '',
        recipient_province: parsed.recipient_province?.trim().toUpperCase() || '',
        recipient_phone: this.normalizePhone(parsed.recipient_phone || ''),
        recipient_email: parsed.recipient_email?.trim() || '',
        notes: parsed.notes?.trim() || '',
      };
    } catch (error) {
      console.error('Errore parsing JSON Claude:', error, '\nRaw:', rawText);
      return {};
    }
  }

  /**
   * Calcola confidence score basato su completezza dati
   */
  private calculateConfidence(data: Record<string, string>): number {
    const requiredFields = [
      'recipient_name',
      'recipient_address',
      'recipient_city',
      'recipient_zip',
    ];
    const optionalFields = ['recipient_province', 'recipient_phone', 'recipient_email'];

    let score = 0;
    let maxScore = 0;

    // Campi obbligatori (peso 25 punti ciascuno)
    requiredFields.forEach((field) => {
      maxScore += 25;
      if (data[field] && data[field].length > 2) {
        score += 25;
      } else if (data[field] && data[field].length > 0) {
        score += 10; // Presente ma troppo corto
      }
    });

    // Campi opzionali (peso 5 punti ciascuno)
    optionalFields.forEach((field) => {
      if (data[field] && data[field].length > 0) {
        score += 5;
      }
    });

    maxScore += optionalFields.length * 5;

    // Normalizza a 0-1
    return Math.min(score / maxScore, 1);
  }

  /**
   * Rileva media type da base64
   */
  private detectMediaType(base64: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    // Controlla magic bytes nel base64
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';

    // Default JPEG
    return 'image/jpeg';
  }
}
