/**
 * Explain Worker
 * 
 * Worker per spiegare business flows (wallet, spedizioni, margini).
 * Usa RAG (Retrieval Augmented Generation) su documentazione business:
 * - docs/MONEY_FLOWS.md
 * - docs/ARCHITECTURE.md
 * - docs/DB_SCHEMA.md
 * 
 * Input: Domanda su business flows (es. "spiega come funziona il wallet", "come funziona il business")
 * Output: explain_response con explanation e diagrammi testuali
 */

import { AgentState } from '../orchestrator/state';
import { defaultLogger, type ILogger } from '../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { agentCache } from '@/lib/services/cache';

/**
 * Documenti disponibili per RAG (business flows)
 */
const BUSINESS_DOCUMENTS = [
  { 
    path: 'docs/MONEY_FLOWS.md', 
    name: 'Money Flows', 
    keywords: ['wallet', 'pagamento', 'credito', 'addebito', 'transazione', 'balance', 'ricarica', 'top-up', 'margine', 'spread'] 
  },
  { 
    path: 'docs/ARCHITECTURE.md', 
    name: 'Architecture', 
    keywords: ['spedizione', 'shipment', 'processo', 'flusso', 'workflow', 'business', 'modello'] 
  },
  { 
    path: 'docs/DB_SCHEMA.md', 
    name: 'Database Schema', 
    keywords: ['shipment', 'wallet', 'transazione', 'tabella', 'schema'] 
  },
  { 
    path: 'README.md', 
    name: 'README', 
    keywords: ['business', 'modello', 'ricavo', 'broker', 'arbitraggio', 'margine'] 
  },
];

/**
 * Cerca keyword nel contenuto del documento (stesso pattern di mentor)
 */
function findRelevantSections(content: string, query: string, keywords: string[]): string[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  // Cerca sezioni che contengono keyword o parole della query
  const lines = content.split('\n');
  const relevantSections: string[] = [];
  let currentSection: string[] = [];
  let inRelevantSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Verifica se la riga contiene keyword o parole della query
    const hasKeyword = keywords.some(kw => lineLower.includes(kw.toLowerCase()));
    const hasQueryWord = queryWords.some(word => word.length > 3 && lineLower.includes(word));
    
    if (hasKeyword || hasQueryWord) {
      inRelevantSection = true;
      currentSection.push(line);
    } else if (inRelevantSection) {
      // Continua a raccogliere righe fino a un header o fine sezione
      if (line.startsWith('#') && currentSection.length > 0) {
        relevantSections.push(currentSection.join('\n'));
        currentSection = [];
        inRelevantSection = false;
      } else if (line.trim().length > 0) {
        currentSection.push(line);
      }
    }
    
    // Limita dimensione sezione (max 25 righe per business flows)
    if (currentSection.length > 25) {
      relevantSections.push(currentSection.slice(0, 25).join('\n'));
      currentSection = [];
      inRelevantSection = false;
    }
  }
  
  if (currentSection.length > 0) {
    relevantSections.push(currentSection.join('\n'));
  }
  
  return relevantSections.slice(0, 4); // Max 4 sezioni rilevanti per business flows
}

/**
 * Legge un documento dalla documentazione
 */
async function readDocument(docPath: string, logger: ILogger): Promise<string | null> {
  try {
    const fullPath = join(process.cwd(), docPath);
    const content = await readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    logger.warn(`⚠️ [Explain] Errore lettura documento ${docPath}:`, error);
    return null;
  }
}

/**
 * Cerca documenti rilevanti per la query
 */
async function searchDocuments(query: string, logger: ILogger): Promise<Array<{ path: string; name: string; sections: string[] }>> {
  const results: Array<{ path: string; name: string; sections: string[] }> = [];
  
  for (const doc of BUSINESS_DOCUMENTS) {
    const content = await readDocument(doc.path, logger);
    if (!content) continue;
    
    const sections = findRelevantSections(content, query, doc.keywords);
    if (sections.length > 0) {
      results.push({
        path: doc.path,
        name: doc.name,
        sections,
      });
    }
  }
  
  return results;
}

/**
 * Genera diagramma testuale per flussi business
 */
function generateTextDiagram(topic: string, documents: Array<{ path: string; name: string; sections: string[] }>): string {
  const topicLower = topic.toLowerCase();
  
  // Diagramma wallet flow
  if (topicLower.includes('wallet') || topicLower.includes('pagamento') || topicLower.includes('credito')) {
    return `
\`\`\`
┌─────────────┐
│   User      │
│ Balance: €X │
└──────┬──────┘
       │
       │ 1. Request Top-Up
       ↓
┌──────────────────────┐
│ top_up_requests      │
│ status: pending      │
└──────┬───────────────┘
       │
       │ 2. Admin Approves
       ↓
┌──────────────────────┐
│ add_wallet_credit()   │
│ (RPC function)        │
└──────┬───────────────┘
       │
       │ 3. Atomic Update
       ↓
┌──────────────────────┐
│ wallet_balance += X │
│ wallet_transactions │
│ (audit trail)       │
└─────────────────────┘
       │
       │ 4. Create Shipment
       ↓
┌──────────────────────┐
│ decrement_wallet_    │
│ balance() (RPC)      │
│ "No Credit, No Label"│
└──────────────────────┘
\`\`\`
`;
  }
  
  // Diagramma spedizione flow
  if (topicLower.includes('spedizione') || topicLower.includes('shipment') || topicLower.includes('processo')) {
    return `
\`\`\`
┌─────────────────┐
│  User Input     │
│  (peso, CAP,    │
│   destinazione) │
└────────┬────────┘
         │
         │ 1. Extract Data
         ↓
┌─────────────────┐
│ Address Worker  │
│ (normalizza)    │
└────────┬────────┘
         │
         │ 2. Calculate
         ↓
┌─────────────────┐
│ Pricing Worker  │
│ (calcola costo) │
└────────┬────────┘
         │
         │ 3. Apply Margin
         ↓
┌─────────────────┐
│ Final Price     │
│ (con margine)   │
└────────┬────────┘
         │
         │ 4. User Confirms
         ↓
┌─────────────────┐
│ Booking Worker  │
│ (crea spedizione)│
└─────────────────┘
\`\`\`
`;
  }
  
  // Diagramma margine flow
  if (topicLower.includes('margine') || topicLower.includes('spread') || topicLower.includes('ricavo')) {
    return `
\`\`\`
┌─────────────────┐
│  Costo Corriere │
│  (listino)      │
└────────┬────────┘
         │
         │ + Margine %
         ↓
┌─────────────────┐
│  Prezzo Utente  │
│  (con margine)  │
└────────┬────────┘
         │
         │ - Costo Corriere
         ↓
┌─────────────────┐
│  Margine Netto  │
│  (ricavo)       │
└─────────────────┘

Modello: Broker/Arbitraggio
- Utente paga: Prezzo con margine
- Noi paghiamo: Costo corriere
- Ricavo: Differenza (margine)
\`\`\`
`;
  }
  
  return '';
}

/**
 * Genera risposta basata sui documenti trovati
 */
function generateExplanation(query: string, documents: Array<{ path: string; name: string; sections: string[] }>): {
  explanation: string;
  diagram: string;
} {
  if (documents.length === 0) {
    return {
      explanation: 'Mi dispiace, non ho trovato informazioni rilevanti nella documentazione per questa domanda. Puoi essere più specifico? Ad esempio:\n- "Spiega come funziona il wallet"\n- "Come funziona il processo di spedizione"\n- "Spiega il calcolo dei margini"',
      diagram: '',
    };
  }
  
  // Genera diagramma testuale
  const diagram = generateTextDiagram(query, documents);
  
  // Costruisci spiegazione combinando sezioni rilevanti
  let explanation = `Basandomi sulla documentazione, ecco come funziona:\n\n`;
  
  for (const doc of documents) {
    explanation += `**${doc.name}** (${doc.path}):\n`;
    for (const section of doc.sections.slice(0, 2)) {
      // Prendi prime 8 righe della sezione per business flows
      const lines = section.split('\n').slice(0, 8).join('\n');
      explanation += `${lines}\n\n`;
    }
  }
  
  if (diagram) {
    explanation += `\n**Diagramma Flusso:**\n${diagram}\n\n`;
  }
  
  explanation += `\n💡 *Per maggiori dettagli, consulta i file nella documentazione.*`;
  
  return { explanation, diagram };
}

/**
 * Explain Worker Node
 * 
 * Spiega business flows usando RAG su documentazione.
 * Restituisce explain_response con explanation e diagrammi testuali.
 */
export async function explainWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('📚 [Explain Worker] Esecuzione...');
  
  try {
    // Estrai query dal messaggio più recente
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      return {
        clarification_request: 'Non ho capito la domanda. Puoi riformularla? Ad esempio: "Spiega come funziona il wallet" o "Come funziona il processo di spedizione"?',
      };
    }
    
    const query = lastMessage.content.toString();
    logger.log(`🔍 [Explain] Cerca spiegazione per: "${query.substring(0, 50)}..."`);
    
    // P3 Task 6: Check cache RAG
    const cachedResult = agentCache.getRAG(query, 'explain');
    
    if (cachedResult) {
      logger.log(`✅ [Explain] Risultato da cache`);
      return {
        explain_response: cachedResult,
        next_step: 'END',
      };
    }
    
    // Cerca documenti rilevanti
    const documents = await searchDocuments(query, logger);
    
    // Genera spiegazione
    const { explanation, diagram } = generateExplanation(query, documents);
    
    // P3 Task 6: Salva in cache
    agentCache.setRAG(query, { explanation, diagram }, 'explain');
    
    logger.log(`✅ [Explain] Spiegazione generata (${documents.length} documenti trovati)`);
    
    // Estrai sources dai documenti
    const sources = documents.map(d => d.path);
    
    return {
      explain_response: {
        explanation,
        diagram,
      },
      next_step: 'END', // Explain worker termina sempre (risposta pronta)
    };
  } catch (error: any) {
    logger.error('❌ [Explain Worker] Errore:', error);
    return {
      clarification_request: 'Mi dispiace, ho riscontrato un errore nel cercare la spiegazione. Riprova più tardi.',
      processingStatus: 'error',
    };
  }
}

/**
 * Detect Explain Intent - Verifica se il messaggio è una richiesta di spiegazione business flows
 * 
 * Pattern specifici per business flows (wallet, spedizioni, margini).
 * Più specifico di mentor (che gestisce domande tecniche generali).
 * 
 * Esempi: "spiega il flusso del wallet", "come funziona il processo di spedizione", "spiega il calcolo dei margini"
 */
export function detectExplainIntent(message: string): boolean {
  const messageLower = message.toLowerCase();
  
  // Pattern specifici per business flows espliciti
  const explainPatterns = [
    // Flussi espliciti
    /flusso.*wallet/i,
    /flusso.*spedizione/i,
    /flusso.*pagamento/i,
    /flusso.*business/i,
    /processo.*spedizione/i,
    /processo.*wallet/i,
    /processo.*pagamento/i,
    /workflow.*spedizione/i,
    /workflow.*wallet/i,
    
    // Spiegazioni esplicite di business flows
    /spiega.*flusso/i,
    /spiega.*processo/i,
    /spiega.*workflow/i,
    /spiega.*business flow/i,
    /spiega.*calcolo.*margine/i,
    /spiega.*calcolo.*spread/i,
    /spiega.*calcolo.*ricavo/i,
    /spiega.*modello.*business/i,
    /spiega.*modello.*ricavo/i,
    
    // Margini e ricavi (business-specific)
    /come.*calcolo.*margine/i,
    /come.*calcolo.*spread/i,
    /come.*calcolo.*ricavo/i,
    /come.*funziona.*margine/i,
    /come.*funziona.*spread/i,
    /come.*funziona.*ricavo/i,
    
    // Processi business espliciti
    /come.*funziona.*processo.*spedizione/i,
    /come.*funziona.*processo.*wallet/i,
    /come.*funziona.*processo.*pagamento/i,
  ];
  
  // Verifica pattern specifici
  const hasSpecificPattern = explainPatterns.some(pattern => pattern.test(message));
  
  // Se ha pattern specifici, è explain
  if (hasSpecificPattern) {
    return true;
  }
  
  // Altrimenti, verifica se è una domanda generica su business (non tecnica)
  // Esclude domande tecniche che vanno a mentor
  const isBusinessQuestion = 
    (messageLower.includes('business') || messageLower.includes('modello') || messageLower.includes('ricavo')) &&
    !messageLower.includes('architettura') &&
    !messageLower.includes('database') &&
    !messageLower.includes('schema') &&
    !messageLower.includes('rls') &&
    !messageLower.includes('sicurezza');
  
  return isBusinessQuestion;
}

