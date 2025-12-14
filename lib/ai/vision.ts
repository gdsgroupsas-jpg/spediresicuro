import { GoogleGenerativeAI } from '@google/generative-ai';

// Inizializza client Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

interface ReceiptAnalysisResult {
  amount: number | null;
  cro: string | null;
  date: string | null;
  confidence: number;
}

/**
 * Analizza una ricevuta di bonifico (IMG o PDF) usando Gemini Vision
 */
export async function analyzeBankReceipt(
  fileBuffer: ArrayBuffer,
  mimeType: string
): Promise<ReceiptAnalysisResult> {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      console.warn('GOOGLE_API_KEY mancante. Skip analisi AI.');
      return { amount: null, cro: null, date: null, confidence: 0 };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
      Analizza questa immagine di una ricevuta di bonifico bancario.
      Estrai i seguenti dati in formato JSON rigoroso:
      - "amount": l'importo numerico del bonifico (es. 120.50). Se incerto, metti null.
      - "cro": il codice CRO o TRN (codice riferimento operazione). Stringa.
      - "date": la data di esecuzione o valuta (formato ISO YYYY-MM-DD).
      - "confidence": un valore da 0.0 a 1.0 che indica quanto la ricevuta sembra autentica e leggibile. 
        Se sembra uno screenshot di un'app banking o una foto di un foglio, e i dati sono chiari, metti alto (0.8-1.0).
        Se è illeggibile o non sembra un bonifico, metti basso.
      
      Rispondi SOLAMENTE con il JSON raw, senza markdown o backticks.
    `;

    // Converte buffer in base64 per l'API
    const base64Data = Buffer.from(fileBuffer).toString('base64');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Pulisci eventuale markdown
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    console.log('Gemini Analysis Raw:', cleanedText);

    try {
      const data = JSON.parse(cleanedText);
      return {
        amount: typeof data.amount === 'number' ? data.amount : null,
        cro: data.cro || null,
        date: data.date || null,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5
      };
    } catch (parseError) {
      console.error('Errore parsing JSON Gemini:', parseError);
      return { amount: null, cro: null, date: null, confidence: 0 };
    }

  } catch (error) {
    console.error('Errore durante analisi Gemini Vision:', error);
    return { amount: null, cro: null, date: null, confidence: 0 };
  }
}
