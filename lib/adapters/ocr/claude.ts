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

      // Prompt specializzato per estrazione dati da messaggi WhatsApp informali
      // Gestione linguaggio naturale colloquiale italiano
      const prompt = `RUOLO: Assistente esperto in estrazione dati da messaggi WhatsApp informali per spedizioni.

CONTESTO: I clienti scrivono messaggi colloquiali, non strutturati. L'AI DEVE interpretare il linguaggio naturale e riconoscere i dati corretti.

═══════════════════════════════════════════════════════
STEP 1: ANALISI MESSAGGIO
═══════════════════════════════════════════════════════

Leggi ATTENTAMENTE il messaggio WhatsApp/screenshot e identifica:

🔹 NOME DESTINATARIO
- Spesso scritto DOPO l'indirizzo
- Può essere: "marchese maria", "Mario Rossi", "sig. Bianchi"
- NON confondere con nomi di città

🔹 INDIRIZZO COMPLETO
- Via/Viale/Corso + nome strada
- Numero civico (spesso indicato con "n" o "numero")
- Esempi: 
  • "Via Roma n 20" → Indirizzo: "Via Roma, n 20"
  • "Via luca Giordano n 24, San Giorgio a Cremano" → Indirizzo: "Via luca Giordano Sangiorgi, n 24"

🔹 CITTÀ
- Comuni italiani (es. San Giorgio a Cremano, Napoli, Roma, Milano)
- NON confondere con nomi di persona
- Esempi: "cremano", "Napoli", "Sarno"

🔹 CAP
- 5 cifre
- Se non presente, fai ricerca esatta deducendola dalla città
- Se presente, fai un check sulla correttezza del valore!

🔹 PROVINCIA
- Sigla 2 lettere (NA, RM, MI, SA, etc.)
- Se non presente, DEDUCILA dalla città se possibile

🔹 TELEFONO
- 10 cifre (es. 3939116394) ma va dedotto dal documento caricato
- ⚠️ CRITICO: Se il numero inizia con + (es. "+39"), DEVI includere il simbolo + nel numero estratto
- Formato richiesto: "+393911639459" (con + e senza spazi) oppure "393911639459" (senza + se non presente)
- Dedurre prefisso internazionale e inserire SENZA SPAZI
- Può essere scritto con spazi o separatori, ma estrai SEMPRE senza spazi
- ⚠️ IMPORTANTE: Se il numero NON è presente esplicitamente nel messaggio, CERCALO nella PARTE ALTA dello screenshot
- Nella parte alta degli screenshot WhatsApp appare spesso il numero del contatto/destinatario
- Estrai quel numero e usalo come telefono destinatario
- Se vedi "+39 333 123 4567" → estrai "+393331234567" (CON il +)
- Se vedi "0039 333 123 4567" → estrai "+393331234567" (converti 0039 in +39)
- Se vedi "333 123 4567" senza prefisso → estrai "+393331234567" (aggiungi +39)

🔹 CONTRASSEGNO
- Importo in € (es. "45€", "paghi 45€")
- Se dice "tutto incluso" o "contrassegno incluso" → è l'importo TOTALE cliente

🔹 NOTE
- Parole tipo: "Fragile", "Urgente", "Scusa", "Grazie"
- Tempo consegna: "2/3 giorni"
- Interni/piani: "Interno 25", "Piano 3"

═══════════════════════════════════════════════════════
STEP 2: REGOLE INTERPRETAZIONE
═══════════════════════════════════════════════════════

✅ QUANDO VEDI:
"Via [nome strada] a [città] n [numero] [nome persona]"

INTERPRETA COSÌ:
- Indirizzo: Via [nome strada], n [numero]
- Città: [città]
- Destinatario: [nome persona]

📌 ESEMPIO PRATICO:
Input: "Via luca Giordano Sangiorgi a cremano n 24 marchese maria"

ANALISI:
- Via: luca Giordano Sangiorgi
- Città: San Giorgio a Cremano (è un comune in provincia di Napoli)
- Numero civico: 24
- Destinatario: marchese maria

OUTPUT:
- Indirizzo: Via luca Giordano Sangiorgi, n 24
- Città: San Giorgio a Cremano
- Provincia: NA
- Destinatario: Marchese Maria (maiuscole corrette)

═══════════════════════════════════════════════════════
STEP 3: CASI COMUNI
═══════════════════════════════════════════════════════

CASO 1: "Via Roma 20 Napoli Mario Rossi"
→ Destinatario: Mario Rossi
→ Indirizzo: Via Roma, n 20
→ Città: Napoli
→ Provincia: NA

CASO 2: "Giuseppe Verdi Via Garibaldi n 15 Sarno SA"
→ Destinatario: Giuseppe Verdi
→ Indirizzo: Via Garibaldi, n 15
→ Città: Sarno
→ Provincia: SA

CASO 3: "Spedisci a Maria Bianchi via Dante 8 Milano"
→ Destinatario: Maria Bianchi
→ Indirizzo: Via Dante, n 8
→ Città: Milano
→ Provincia: MI

═══════════════════════════════════════════════════════
STEP 4: OUTPUT JSON RICHIESTO
═══════════════════════════════════════════════════════

Restituisci SOLO un JSON con questa struttura (nessun altro testo):

{
  "recipient_name": "Nome Cognome destinatario",
  "recipient_address": "Via/Corso + nome strada, n numero civico",
  "recipient_city": "Nome città completo",
  "recipient_zip": "CAP 5 cifre",
  "recipient_province": "Sigla provincia 2 lettere maiuscole",
  "country": "IT",
  "peso": "Peso in kg con punto decimale",
  "colli": "1",
  "contrassegno": "Importo con punto decimale o vuoto",
  "rif_mittente": "Riferimento mittente o vuoto",
  "rif_destinatario": "Nome destinatario",
  "notes": "Note aggiuntive (interni, piani, fragile, etc.)",
  "recipient_phone": "Telefono 10 cifre con prefisso",
  "recipient_email": "Email o vuoto",
  "contenuto": "Contenuto pacco o vuoto",
  "order_id": "ID ordine o vuoto",
  "totale_ordine": "Totale con punto decimale o vuoto"
}

═══════════════════════════════════════════════════════
STEP 5: VERIFICA FINALE
═══════════════════════════════════════════════════════

Prima di fornire il JSON, controlla:
✓ Il DESTINATARIO è un NOME di PERSONA (non una città)
✓ La CITTÀ è un COMUNE italiano riconosciuto
✓ L'INDIRIZZO contiene VIA + NUMERO CIVICO
✓ La PROVINCIA è corretta per quella città
✓ Il TELEFONO ha 10 cifre (con prefisso se presente)
✓ I decimali usano il PUNTO (non virgola)
✓ Il CAP corrisponde alla città (se possibile verificare)

═══════════════════════════════════════════════════════
ESEMPIO COMPLETO: CASO REALE
═══════════════════════════════════════════════════════

📱 MESSAGGIO WHATSAPP:
"Via luca Giordano Sangiorgi a cremano n 24 marchese maria
Numero 25
Scusa
Paghi 45€ tutto Spedizione e contrassegno incluse"

🧠 ANALISI AI:
1. Indirizzo: "Via luca Giordano Sangiorgi" → via principale
2. Città: "cremano" → San Giorgio a Cremano, comune in provincia NA
3. Numero civico: "24" (dopo "n")
4. Destinatario: "marchese maria" → nome persona (DOPO indirizzo)
5. "Numero 25" → potrebbe essere interno/piano → AGGIUNGI a note
6. "Scusa" → nota informale → IGNORA o metti in note
7. "Paghi 45€" → contrassegno = 45
8. Telefono: se presente nel documento, estrai con prefisso

✅ OUTPUT JSON:
{
  "recipient_name": "Marchese Maria",
  "recipient_address": "Via luca Giordano Sangiorgi, n 24",
  "recipient_city": "San Giorgio a Cremano",
  "recipient_zip": "80040",
  "recipient_province": "NA",
  "country": "IT",
  "peso": "",
  "colli": "1",
  "contrassegno": "45",
  "rif_mittente": "",
  "rif_destinatario": "Marchese Maria",
  "notes": "Interno/Piano 25",
  "recipient_phone": "393911639459",
  "recipient_email": "",
  "contenuto": "",
  "order_id": "",
  "totale_ordine": "45"
}

NOTA: Il telefono "393911639459" è stato estratto dalla parte alta dello screenshot (header WhatsApp del contatto), non era presente nel messaggio.

═══════════════════════════════════════════════════════
NOTE FINALI
═══════════════════════════════════════════════════════

🔴 ERRORI DA EVITARE:
- ❌ Mettere "cremano n 24" come destinatario
- ❌ Mettere "marchese maria" come città
- ❌ Dimenticare il numero civico nell'indirizzo
- ❌ Non dedurre CAP/provincia dalla città quando mancanti

✅ COSA FARE SEMPRE:
- ✓ Ragiona sulla grammatica italiana
- ✓ "a [città]" significa che [città] è la località
- ✓ Il nome persona di solito è DOPO l'indirizzo
- ✓ Se manca CAP, deducilo dalla città (es. San Giorgio a Cremano → 80040)
- ✓ Se manca provincia, deducila dalla città (es. Cremano → NA, Napoli → NA)
- ✓ Se manca telefono nel messaggio, CERCALO nella PARTE ALTA dello screenshot (header WhatsApp)
- ✓ Il numero telefono va sempre senza spazi (es. "393911639459" non "393 911 639 459")

IMPORTANTE:
- Restituisci SOLO il JSON, nessun altro testo
- Se un dato non è presente, usa stringa vuota ""
- Concentrati SOLO sui dati del destinatario, NON del mittente
- Interpreta il linguaggio naturale italiano colloquiale`;

      // Chiamata API Claude Vision
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Modello Haiku più veloce ed economico
        max_tokens: 2048, // Aumentato per gestire prompt più dettagliato e output completo
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

      // Normalizza dati secondo formato spedisci.online
      return {
        recipient_name: parsed.recipient_name?.trim() || '',
        recipient_address: parsed.recipient_address?.trim() || '',
        recipient_city: parsed.recipient_city?.trim() || parsed.localita?.trim() || '',
        recipient_zip: this.validateZip(parsed.recipient_zip) || '',
        recipient_province: parsed.recipient_province?.trim().toUpperCase().slice(0, 2) || '',
        recipient_phone: this.normalizePhone(parsed.recipient_phone || ''),
        recipient_email: parsed.recipient_email?.trim() || parsed.email_destinatario?.trim() || '',
        notes: parsed.notes?.trim() || '',
        // Campi aggiuntivi per formato spedisci.online
        peso: parsed.peso?.replace(',', '.') || '',
        colli: parsed.colli || '1',
        contrassegno: parsed.contrassegno?.replace(',', '.') || '',
        contenuto: parsed.contenuto?.trim() || '',
        order_id: parsed.order_id?.trim() || '',
        totale_ordine: parsed.totale_ordine?.replace(',', '.') || '',
        rif_mittente: parsed.rif_mittente?.trim() || '',
        rif_destinatario: parsed.rif_destinatario?.trim() || parsed.recipient_name?.trim() || '',
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
