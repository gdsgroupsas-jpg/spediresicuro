/**
 * Debug Worker
 *
 * Worker per analisi log e suggerimenti fix.
 * Analizza errori, status e confidence per suggerire soluzioni.
 *
 * Input: Messaggio con intent debug (es. "perché non funziona", "errore", "debug")
 * Output: debug_response con analysis, suggestions, links
 */

import { AgentState } from '../orchestrator/state';
import { defaultLogger, type ILogger } from '../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Documenti disponibili per troubleshooting
 */
const DEBUG_DOCUMENTS = [
  {
    path: 'docs/SECURITY.md',
    name: 'Security',
    keywords: ['errore', 'autenticazione', 'authorization', 'rls', 'permission'],
  },
  {
    path: 'docs/ARCHITECTURE.md',
    name: 'Architecture',
    keywords: ['errore', 'sistema', 'componente', 'pattern', 'bug'],
  },
  {
    path: 'docs/DB_SCHEMA.md',
    name: 'Database Schema',
    keywords: ['errore', 'database', 'sql', 'migration', 'constraint'],
  },
  {
    path: 'MIGRATION_MEMORY.md',
    name: 'Migration Memory',
    keywords: ['errore', 'bug', 'fix', 'workaround', 'issue'],
  },
];

/**
 * Analizza errori di validazione e suggerisce fix
 */
function analyzeValidationErrors(errors: string[]): {
  analysis: string;
  suggestions: string[];
  links: string[];
} {
  if (errors.length === 0) {
    return {
      analysis: 'Nessun errore di validazione rilevato.',
      suggestions: [],
      links: [],
    };
  }

  const suggestions: string[] = [];
  const links: string[] = [];
  let analysis = `Ho rilevato ${errors.length} errore/i di validazione:\n\n`;

  for (const error of errors) {
    const errorLower = error.toLowerCase();

    // Analizza tipo di errore
    if (errorLower.includes('campo') || errorLower.includes('field')) {
      suggestions.push('Verifica che tutti i campi obbligatori siano compilati correttamente.');
      links.push('docs/DB_SCHEMA.md');
    }

    if (errorLower.includes('indirizzo') || errorLower.includes('address')) {
      suggestions.push(
        "Controlla che l'indirizzo sia completo: via, numero civico, CAP e provincia."
      );
      links.push('docs/ARCHITECTURE.md');
    }

    if (errorLower.includes('peso') || errorLower.includes('weight')) {
      suggestions.push('Il peso deve essere un numero positivo maggiore di zero.');
    }

    if (errorLower.includes('cap') || errorLower.includes('zip')) {
      suggestions.push('Il CAP deve essere un numero di 5 cifre valido per la provincia indicata.');
      links.push('docs/DB_SCHEMA.md');
    }

    if (errorLower.includes('provincia') || errorLower.includes('province')) {
      suggestions.push('La provincia deve essere un codice di 2 lettere valido (es. RM, MI, TO).');
      links.push('docs/DB_SCHEMA.md');
    }

    if (errorLower.includes('wallet') || errorLower.includes('saldo')) {
      suggestions.push('Verifica che il saldo del wallet sia sufficiente per la spedizione.');
      links.push('docs/MONEY_FLOWS.md');
    }

    if (errorLower.includes('autenticazione') || errorLower.includes('authentication')) {
      suggestions.push(
        'Verifica di essere autenticato correttamente. Prova a fare logout e login.'
      );
      links.push('docs/SECURITY.md');
    }

    analysis += `• ${error}\n`;
  }

  // Rimuovi duplicati
  const uniqueSuggestions = [...new Set(suggestions)];
  const uniqueLinks = [...new Set(links)];

  return {
    analysis,
    suggestions: uniqueSuggestions,
    links: uniqueLinks,
  };
}

/**
 * Analizza processingStatus e suggerisce azioni
 */
function analyzeProcessingStatus(status: AgentState['processingStatus']): {
  analysis: string;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let analysis = '';

  switch (status) {
    case 'error':
      analysis = '⚠️ Lo stato è "error". Il processo ha riscontrato un errore.';
      suggestions.push("Controlla i log per dettagli sull'errore specifico.");
      suggestions.push("Prova a ripetere l'operazione con dati diversi.");
      suggestions.push("Se l'errore persiste, contatta il supporto tecnico.");
      break;

    case 'idle':
      analysis = 'ℹ️ Lo stato è "idle". Il processo è in attesa di input.';
      suggestions.push('Fornisci i dati necessari per procedere.');
      break;

    case 'extracting':
      analysis = '🔄 Lo stato è "extracting". Il sistema sta estraendo dati dal messaggio.';
      suggestions.push("Attendi il completamento dell'estrazione.");
      suggestions.push('Assicurati che il messaggio contenga informazioni chiare e complete.');
      break;

    case 'validating':
      analysis = '✅ Lo stato è "validating". Il sistema sta validando i dati inseriti.';
      suggestions.push('Verifica che tutti i campi siano compilati correttamente.');
      break;

    case 'calculating':
      analysis = '💰 Lo stato è "calculating". Il sistema sta calcolando i preventivi.';
      suggestions.push('Attendi il completamento del calcolo.');
      break;

    case 'complete':
      analysis = '✅ Lo stato è "complete". Il processo è completato con successo.';
      suggestions.push('Puoi procedere con la conferma della spedizione.');
      break;

    default:
      analysis = `ℹ️ Stato sconosciuto: ${status}`;
      suggestions.push('Contatta il supporto tecnico se il problema persiste.');
  }

  return { analysis, suggestions };
}

/**
 * Analizza confidenceScore e suggerisce miglioramenti
 */
function analyzeConfidenceScore(score: number): {
  analysis: string;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let analysis = '';

  if (score >= 80) {
    analysis = `✅ Confidence score alto (${score}%). I dati sono stati estratti con alta confidenza.`;
    suggestions.push('Puoi procedere con fiducia.');
  } else if (score >= 50) {
    analysis = `⚠️ Confidence score medio (${score}%). I dati potrebbero non essere completamente accurati.`;
    suggestions.push('Verifica manualmente i dati estratti.');
    suggestions.push('Fornisci informazioni più dettagliate per migliorare la confidenza.');
  } else {
    analysis = `❌ Confidence score basso (${score}%). I dati potrebbero essere incompleti o errati.`;
    suggestions.push('Fornisci informazioni più dettagliate e specifiche.');
    suggestions.push('Verifica che il messaggio contenga tutti i dati necessari.');
    suggestions.push('Prova a riformulare la richiesta in modo più chiaro.');
  }

  return { analysis, suggestions };
}

/**
 * Cerca documentazione rilevante per troubleshooting
 */
async function searchDebugDocs(query: string, logger: ILogger): Promise<string[]> {
  const links: string[] = [];
  const queryLower = query.toLowerCase();

  for (const doc of DEBUG_DOCUMENTS) {
    const hasKeyword = doc.keywords.some((kw) => queryLower.includes(kw.toLowerCase()));
    if (hasKeyword) {
      links.push(doc.path);
    }
  }

  return [...new Set(links)];
}

/**
 * Debug Worker Node
 *
 * Analizza errori, status e confidence per suggerire soluzioni.
 * Restituisce debug_response con analysis, suggestions, links.
 */
export async function debugWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🐛 [Debug Worker] Esecuzione...');

  try {
    // Analizza errori di validazione
    const validationAnalysis = analyzeValidationErrors(state.validationErrors || []);

    // Analizza processingStatus
    const statusAnalysis = analyzeProcessingStatus(state.processingStatus);

    // Analizza confidenceScore
    const confidenceAnalysis = analyzeConfidenceScore(state.confidenceScore || 0);

    // Cerca documentazione rilevante
    const lastMessage = state.messages[state.messages.length - 1];
    const query = lastMessage?.content?.toString() || '';
    const debugLinks = await searchDebugDocs(query, logger);

    // Combina tutti i link
    const allLinks = [...new Set([...validationAnalysis.links, ...debugLinks])];

    // Costruisci risposta completa
    let analysis = `## Analisi Debug\n\n`;
    analysis += `${validationAnalysis.analysis}\n\n`;
    analysis += `${statusAnalysis.analysis}\n\n`;
    analysis += `${confidenceAnalysis.analysis}\n\n`;

    // Combina suggerimenti
    const allSuggestions = [
      ...validationAnalysis.suggestions,
      ...statusAnalysis.suggestions,
      ...confidenceAnalysis.suggestions,
    ];

    // Aggiungi suggerimenti generici se non ci sono errori specifici
    if (allSuggestions.length === 0) {
      allSuggestions.push(
        'Non ho rilevato problemi specifici. Se riscontri ancora errori, prova a:'
      );
      allSuggestions.push('1. Ricaricare la pagina');
      allSuggestions.push('2. Verificare la connessione internet');
      allSuggestions.push('3. Contattare il supporto tecnico');
    }

    // Aggiungi retry strategies
    if (
      state.processingStatus === 'error' ||
      (state.validationErrors && state.validationErrors.length > 0)
    ) {
      allSuggestions.push('💡 Strategie di retry:');
      allSuggestions.push("- Prova a ripetere l'operazione con dati leggermente diversi");
      allSuggestions.push('- Verifica che tutti i campi obbligatori siano compilati');
      allSuggestions.push('- Controlla che i dati siano nel formato corretto');
    }

    logger.log(
      `✅ [Debug Worker] Analisi completata (${allSuggestions.length} suggerimenti, ${allLinks.length} link)`
    );

    return {
      debug_response: {
        analysis,
        suggestions: allSuggestions,
        links: allLinks,
      },
      next_step: 'END', // Debug worker termina sempre (risposta pronta)
    };
  } catch (error: any) {
    logger.error('❌ [Debug Worker] Errore:', error);
    return {
      clarification_request:
        "Mi dispiace, ho riscontrato un errore nell'analisi. Riprova più tardi.",
      processingStatus: 'error',
    };
  }
}

/**
 * Detect Debug Intent - Verifica se il messaggio è una richiesta di debug
 *
 * Pattern: "perché non funziona", "errore", "debug", "log", "problema"
 */
export function detectDebugIntent(message: string): boolean {
  const debugPatterns = [
    /perché non funziona/i,
    /non funziona/i,
    /errore/i,
    /error/i,
    /debug/i,
    /log/i,
    /problema/i,
    /issue/i,
    /bug/i,
    /cosa non va/i,
    /cosa c'è che non va/i,
    /aiuto/i,
    /help/i,
    /fix/i,
    /risolvi/i,
    /correggi/i,
  ];

  return debugPatterns.some((pattern) => pattern.test(message));
}
