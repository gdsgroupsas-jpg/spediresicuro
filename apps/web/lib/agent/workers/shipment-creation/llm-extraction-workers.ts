/**
 * Worker LLM per estrazione dati spedizione dal messaggio utente.
 * Un solo compito, un prompt specifico: estrarre tutti i campi possibili e restituire JSON.
 * Nessuna logica rule-based: solo LLM + parsing JSON.
 * Validazione e merge li fa l'orchestratore (chain).
 */

import { chatWithOllama } from '@/lib/ai/ollama';
import type { ShipmentDraft } from '@/lib/address/shipment-draft';
import { mergeShipmentDraft } from '@/lib/address/shipment-draft';
import type { ILogger } from '@/lib/agent/logger';
import { defaultLogger } from '@/lib/agent/logger';

/** Formato JSON atteso dall'LLM (parziale, tutti i campi opzionali) */
export interface LlmExtractionResult {
  sender?: { name?: string; phone?: string; company?: string };
  recipient?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    province?: string;
  };
  parcel?: {
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  };
}

const SYSTEM_PROMPT = `Sei un assistente che estrae dati di spedizione da messaggi in italiano.
Il tuo UNICO compito: dal messaggio dell'utente (e dalla bozza esistente se fornita) estrai tutti i dati relativi a:
- MITTENTE: nome, telefono (opzionale company)
- DESTINATARIO: nome completo, telefono, indirizzo (via e numero civico), città, CAP (5 cifre), provincia (sigla 2 lettere, es. RM, MI)
- PACCO: peso in kg (numero), opzionale dimensioni in cm (lengthCm, widthCm, heightCm)

Regole:
- Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo. Nessun markdown, nessun \`\`\`json.
- Usa esattamente le chiavi: sender (name, phone, company), recipient (fullName, phone, addressLine1, addressLine2, city, postalCode, province), parcel (weightKg, lengthCm, widthCm, heightCm).
- Per campi non presenti nel messaggio non includere la chiave o usa null.
- CAP: solo cifre, 5 caratteri. Provincia: 2 lettere maiuscole (es. RM, MI, NA).
- Peso: numero in kg (es. 2.5). Telefoni: numeri italiani, puoi includere +39 o solo cifre.`;

/**
 * Estrae dal testo un eventuale blocco JSON (rimuove markdown e spazi)
 */
function extractJsonFromResponse(content: string): string {
  const trimmed = content.trim();
  // Rimuovi eventuale wrapper ```json ... ```
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  return trimmed;
}

/**
 * Normalizza provincia a 2 lettere maiuscole
 */
function normalizeProvince(v: string | undefined): string | undefined {
  if (!v || typeof v !== 'string') return undefined;
  const two = v.replace(/\s/g, '').slice(0, 2).toUpperCase();
  return two.length === 2 ? two : undefined;
}

/**
 * Normalizza CAP a 5 cifre
 */
function normalizePostalCode(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const digits = String(v).replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : undefined;
}

/**
 * Worker LLM: estrazione completa dati spedizione da messaggio + bozza esistente.
 * Restituisce un ShipmentDraft ottenuto merge di existingDraft con i campi estratti dall'LLM.
 */
export async function runLlmExtractionWorker(
  message: string,
  existingDraft: ShipmentDraft | undefined,
  logger: ILogger = defaultLogger
): Promise<ShipmentDraft> {
  const contextLine = existingDraft
    ? `Bozza già presente (integrala con il nuovo messaggio): ${JSON.stringify({
        sender: existingDraft.sender,
        recipient: existingDraft.recipient,
        parcel: existingDraft.parcel,
      })}`
    : 'Nessuna bozza precedente.';

  const userContent = `${contextLine}\n\nMessaggio utente:\n${message}`;

  try {
    const response = await chatWithOllama({
      messages: [{ role: 'user', content: userContent }],
      system: SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 1024,
    });

    const raw = response?.content ?? '';
    const jsonStr = extractJsonFromResponse(raw);
    let parsed: LlmExtractionResult;

    try {
      parsed = JSON.parse(jsonStr) as LlmExtractionResult;
    } catch {
      logger.warn('[LLM Extraction] Risposta non JSON valido, uso draft esistente');
      return (
        existingDraft ?? {
          sender: undefined,
          recipient: undefined,
          parcel: undefined,
          missingFields: [],
        }
      );
    }

    // Normalizza province e CAP
    if (parsed.recipient) {
      if (parsed.recipient.province)
        parsed.recipient.province = normalizeProvince(parsed.recipient.province);
      if (parsed.recipient.postalCode)
        parsed.recipient.postalCode = normalizePostalCode(parsed.recipient.postalCode);
    }

    const updates = {
      sender: parsed.sender,
      recipient: parsed.recipient,
      parcel: parsed.parcel,
    };

    const merged = mergeShipmentDraft(existingDraft, updates);
    logger.log('[LLM Extraction] Estratti campi, merge completato');
    return merged;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[LLM Extraction] Errore:', msg);
    return (
      existingDraft ?? {
        sender: undefined,
        recipient: undefined,
        parcel: undefined,
        missingFields: [],
      }
    );
  }
}
