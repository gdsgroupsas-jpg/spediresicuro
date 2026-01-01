/**
 * Mentor Worker
 * 
 * Worker per Q&A tecnico su architettura, wallet, RLS, business flows.
 * Usa RAG (Retrieval Augmented Generation) su documentazione:
 * - docs/MONEY_FLOWS.md
 * - docs/ARCHITECTURE.md
 * - docs/DB_SCHEMA.md
 * 
 * Input: Domanda tecnica dell'utente
 * Output: Risposta con sources (file paths referenziati) e confidence
 */

import { AgentState } from '../orchestrator/state';
import { defaultLogger, type ILogger } from '../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Documenti disponibili per RAG
 */
const DOCUMENTS = [
  { path: 'docs/MONEY_FLOWS.md', name: 'Money Flows', keywords: ['wallet', 'pagamento', 'credito', 'addebito', 'transazione', 'balance'] },
  { path: 'docs/ARCHITECTURE.md', name: 'Architecture', keywords: ['architettura', 'sistema', 'componente', 'pattern', 'design'] },
  { path: 'docs/DB_SCHEMA.md', name: 'Database Schema', keywords: ['database', 'tabella', 'schema', 'sql', 'migration', 'rls'] },
  { path: 'docs/SECURITY.md', name: 'Security', keywords: ['sicurezza', 'rls', 'autenticazione', 'authorization', 'audit'] },
];

/**
 * Cerca keyword nel contenuto del documento
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
    
    // Limita dimensione sezione (max 20 righe)
    if (currentSection.length > 20) {
      relevantSections.push(currentSection.slice(0, 20).join('\n'));
      currentSection = [];
      inRelevantSection = false;
    }
  }
  
  if (currentSection.length > 0) {
    relevantSections.push(currentSection.join('\n'));
  }
  
  return relevantSections.slice(0, 3); // Max 3 sezioni rilevanti
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
    logger.warn(`⚠️ [Mentor] Errore lettura documento ${docPath}:`, error);
    return null;
  }
}

/**
 * Cerca documenti rilevanti per la query
 */
async function searchDocuments(query: string, logger: ILogger): Promise<Array<{ path: string; name: string; sections: string[] }>> {
  const results: Array<{ path: string; name: string; sections: string[] }> = [];
  
  for (const doc of DOCUMENTS) {
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
 * Genera risposta basata sui documenti trovati
 */
function generateAnswer(query: string, documents: Array<{ path: string; name: string; sections: string[] }>): {
  answer: string;
  sources: string[];
  confidence: number;
} {
  if (documents.length === 0) {
    return {
      answer: 'Mi dispiace, non ho trovato informazioni rilevanti nella documentazione per questa domanda. Puoi riformulare la domanda o essere più specifico?',
      sources: [],
      confidence: 0,
    };
  }
  
  const sources = documents.map(d => d.path);
  const confidence = Math.min(90, 50 + (documents.length * 10)); // 50-90% basato su numero documenti
  
  // Costruisci risposta combinando sezioni rilevanti
  let answer = `Basandomi sulla documentazione, ecco cosa ho trovato:\n\n`;
  
  for (const doc of documents) {
    answer += `**${doc.name}** (${doc.path}):\n`;
    for (const section of doc.sections.slice(0, 2)) {
      // Prendi prime 5 righe della sezione
      const lines = section.split('\n').slice(0, 5).join('\n');
      answer += `${lines}\n\n`;
    }
  }
  
  answer += `\n💡 *Per maggiori dettagli, consulta i file nella documentazione.*`;
  
  return { answer, sources, confidence };
}

/**
 * Mentor Worker Node
 * 
 * Risponde a domande tecniche usando RAG su documentazione.
 * Restituisce risposta con sources e confidence.
 */
export async function mentorWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🎓 [Mentor Worker] Esecuzione...');
  
  try {
    // Estrai query dal messaggio più recente
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      return {
        clarification_request: 'Non ho capito la domanda. Puoi riformularla?',
      };
    }
    
    const query = lastMessage.content.toString();
    logger.log(`🔍 [Mentor] Cerca risposta per: "${query.substring(0, 50)}..."`);
    
    // Cerca documenti rilevanti
    const documents = await searchDocuments(query, logger);
    
    // Genera risposta
    const { answer, sources, confidence } = generateAnswer(query, documents);
    
    logger.log(`✅ [Mentor] Risposta generata (confidence: ${confidence}%, sources: ${sources.length})`);
    
    return {
      mentor_response: {
        answer,
        sources,
        confidence,
      },
      next_step: 'END', // Mentor worker termina sempre (risposta pronta)
    };
  } catch (error: any) {
    logger.error('❌ [Mentor Worker] Errore:', error);
    return {
      clarification_request: 'Mi dispiace, ho riscontrato un errore nel cercare la risposta. Riprova più tardi.',
      processingStatus: 'error',
    };
  }
}

/**
 * Detect Mentor Intent - Verifica se il messaggio è una domanda tecnica
 * 
 * Pattern: "Come funziona...", "Spiega...", "Perché...", "Che cos'è..."
 */
export function detectMentorIntent(message: string): boolean {
  const mentorPatterns = [
    /come funziona/i,
    /spiega/i,
    /perché/i,
    /che cos'è/i,
    /che cosa è/i,
    /come si/i,
    /dove si trova/i,
    /dove è/i,
    /quale/i,
    /architettura/i,
    /wallet/i,
    /rls/i,
    /database/i,
    /schema/i,
  ];
  
  return mentorPatterns.some(pattern => pattern.test(message));
}

