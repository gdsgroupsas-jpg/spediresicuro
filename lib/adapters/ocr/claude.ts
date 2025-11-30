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
      throw new Error('Claude Vision API non disponibile. Configura ANTHROPIC_API_KEY in .env.local');
    }

    try {
      // Converti immagine in base64 se è un Buffer
      const base64Image = typeof imageData === 'string'
        ? imageData
        : imageData.toString('base64');

      // Determina media type (assumiamo JPEG, ma potremmo rilevarlo)
      const mediaType = this.detectMediaType(base64Image);

      // Prompt ottimizzato per estrazione dati LDV italiana e screenshot WhatsApp
      const prompt = `Analizza questa immagine. Potrebbe essere una Lettera di Vettura (LDV), documento di spedizione italiano, o uno screenshot WhatsApp.

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

REGOLE CRITICHE PER L'ESTRAZIONE:

1. DISTINGUI ETICHETTE DA VALORI REALI (FONDAMENTALE):
   - NON estrarre MAI etichette come "Nome e Cognome", "Nome cognome", "Nome:", "Telefono:", "Indirizzo:", "Città:", "CAP:", ecc.
   - Queste sono SOLO etichette/label, NON sono dati reali!
   - Estrai SOLO i VALORI REALI che seguono o precedono le etichette
   - Esempi SBAGLIATI (NON fare così):
     * "Nome e Cognome" → SBAGLIATO! È un'etichetta
     * "Nome cognome" → SBAGLIATO! È un'etichetta
     * "Telefono" → SBAGLIATO! È un'etichetta
   - Esempi CORRETTI:
     * "Nome e Cognome: Mario Rossi" → estrai "Mario Rossi"
     * Bolla WhatsApp con "Nome cognome" + bolla con "BENETTI ARIANA" → estrai "BENETTI ARIANA"
     * "Telefono: +39 333 1234567" → estrai "+39 333 1234567"
   - Per screenshot WhatsApp: le etichette sono spesso in bolle separate, cerca il valore nella bolla adiacente
   - Se trovi solo un'etichetta senza valore reale, lascia il campo vuoto "" piuttosto che estrarre l'etichetta

2. TELEFONO (SPECIALMENTE PER WHATSAPP):
   - Se è uno screenshot WhatsApp, il numero è SEMPRE nella parte ALTA dell'immagine
   - Il prefisso è SEMPRE visibile (es: +39, 0039, o solo il numero con prefisso)
   - COPIA IL NUMERO ESATTAMENTE COME APPARE (con prefisso se presente)
   - NON rimuovere spazi, trattini o prefissi - copia tutto pari pari
   - Esempi corretti: "+39 333 1234567", "+39 3331234567", "0039 333 1234567", "333 1234567"
   - Cerca nella parte alta dell'immagine per screenshot WhatsApp
   - Il numero può essere vicino al nome del contatto o in un campo separato

3. NOME E COGNOME (CRITICO - NON SBAGLIARE):
   - NON estrarre MAI etichette come "Nome e Cognome", "Nome cognome", "Nome:", "Cognome:", "Nome e Cognome:", ecc.
   - Queste sono SOLO etichette/label, NON sono il nome reale!
   - Estrai SOLO il valore reale che segue o precede l'etichetta
   - LISTA ETICHETTE DA IGNORARE (NON estrarre MAI):
     * "Nome e Cognome"
     * "Nome cognome"
     * "Nome:"
     * "Cognome:"
     * "Nome e Cognome:"
     * "Nome completo"
     * Qualsiasi testo che sia chiaramente un'etichetta di campo
   - Esempi CORRETTI:
     * Se vedi "Nome e Cognome: Mario Rossi" → estrai "Mario Rossi"
     * Se vedi "Nome: Luigi Verdi" → estrai "Luigi Verdi"
     * Se vedi una bolla WhatsApp con "Nome cognome" e poi una bolla con "BENETTI ARIANA" → estrai "BENETTI ARIANA" (NON "Nome cognome"!)
     * Se vedi solo "BENETTI ARIANA" senza etichette → estrai "BENETTI ARIANA"
   - Per screenshot WhatsApp:
     * Le etichette sono spesso in bolle separate dai valori (bolle verdi = etichette, bolle bianche = valori)
     * Se vedi una bolla con "Nome cognome" o simile, cerca il valore nella bolla successiva o precedente
     * Il valore reale è spesso in una bolla diversa (bianca se l'etichetta è verde, o viceversa)
     * Se trovi solo l'etichetta senza valore reale, lascia il campo vuoto ""
   - REGOLA D'ORO: Se il testo corrisponde a un'etichetta comune (Nome, Cognome, Telefono, Indirizzo, Città, CAP, ecc.), NON estrarlo!
   - Se hai dubbi se un testo è un'etichetta o un valore, è meglio lasciare vuoto che estrarre un'etichetta
   - CONTROLLO FINALE: Prima di inserire nel campo "recipient_name", chiediti: "Questo è un nome reale o un'etichetta?" Se è un'etichetta, NON estrarlo!

4. ALTRI CAMPI:
   - Cerca SEMPRE di estrarre città, provincia e CAP - sono campi CRITICI
   - Se trovi la città ma NON trovi provincia o CAP, cerca attentamente:
     * La provincia può essere scritta per esteso (es: "Milano") o come sigla (es: "MI")
     * Il CAP è sempre un numero di 5 cifre (es: 20100, 00100)
     * Spesso città, CAP e provincia sono sulla stessa riga
   - Per provincia, usa SEMPRE sigla 2 lettere maiuscole (es: "Milano" → "MI")
   - Per il CAP, verifica sia esattamente 5 cifre

5. REGOLE GENERALI:
   - Restituisci SOLO il JSON, nessun altro testo
   - Se un campo NON è presente, usa stringa vuota ""
   - Concentrati SOLO sui dati del destinatario, NON del mittente
   - Se trovi più indirizzi, prendi quello etichettato come "DESTINATARIO" o "CONSEGNA"

Esempi output corretti:

Esempio 1 - Documento normale:
{
  "recipient_name": "Mario Rossi",
  "recipient_address": "Via Roma, 123",
  "recipient_city": "Milano",
  "recipient_zip": "20100",
  "recipient_province": "MI",
  "recipient_phone": "+39 333 1234567",
  "recipient_email": "mario.rossi@example.com",
  "notes": "Citofono: Rossi - Piano 3"
}

Esempio 2 - Screenshot WhatsApp (etichette in bolle separate):
Se vedi:
- Bolla verde: "Nome cognome"
- Bolla bianca: "BENETTI ARIANA"
→ Estrai:
{
  "recipient_name": "BENETTI ARIANA",
  "recipient_address": "Via Ca Diedo 61",
  "recipient_city": "Camponogara",
  "recipient_zip": "",
  "recipient_province": "VE",
  "recipient_phone": "+39 333 854 3594",
  "recipient_email": "",
  "notes": ""
}
NOTA: "Nome cognome" NON va nel campo recipient_name perché è un'etichetta!`;

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

      // Lista etichette comuni da filtrare (NON devono essere estratte come valori)
      const commonLabels = [
        'nome e cognome',
        'nome cognome',
        'nome:',
        'cognome:',
        'nome e cognome:',
        'nome completo',
        'telefono',
        'tel',
        'phone',
        'indirizzo',
        'address',
        'città',
        'city',
        'cap',
        'provincia',
        'province',
        'email',
        'e-mail',
        'mail',
      ];

      // Verifica che il nome non sia un'etichetta
      let recipientName = parsed.recipient_name?.trim() || '';
      const nameLower = recipientName.toLowerCase();
      if (commonLabels.some(label => nameLower === label || nameLower.startsWith(label + ':'))) {
        // Se è un'etichetta, non estrarla
        console.warn('⚠️ Rilevata etichetta invece di nome reale:', recipientName);
        recipientName = '';
      }

      // Normalizza dati
      // Per il telefono, mantieni il formato originale se ha prefisso (es: +39, 0039)
      // Altrimenti normalizza
      let phone = parsed.recipient_phone?.trim() || '';
      if (phone && !phone.match(/^(\+39|0039)/)) {
        // Se non ha prefisso, normalizza
        phone = this.normalizePhone(phone);
      }
      // Se ha prefisso, mantieni così com'è (pari pari come richiesto)

      return {
        recipient_name: recipientName,
        recipient_address: parsed.recipient_address?.trim() || '',
        recipient_city: parsed.recipient_city?.trim() || '',
        recipient_zip: this.validateZip(parsed.recipient_zip) || '',
        recipient_province: parsed.recipient_province?.trim().toUpperCase() || '',
        recipient_phone: phone,
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
    const requiredFields = ['recipient_name', 'recipient_address', 'recipient_city', 'recipient_zip'];
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
