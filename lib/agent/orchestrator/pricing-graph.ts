/**
 * Pricing Graph
 * 
 * Grafo LangGraph per la gestione dei preventivi:
 * Supervisor -> Pricing Worker -> Supervisor (loop fino a completamento)
 */

import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { supervisor } from './supervisor';
import { pricingWorker } from '../workers/pricing';

// Limite iterazioni per prevenire loop infiniti
const MAX_ITERATIONS = 2;

/**
 * Router dopo Supervisor: decide se andare a pricing_worker o END
 */
const routeAfterSupervisor = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > MAX_ITERATIONS) {
    console.warn(`⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`);
    return 'END';
  }
  
  // Se abbiamo già preventivi, termina
  if (state.pricing_options && state.pricing_options.length > 0) {
    return 'END';
  }
  
  // Se il supervisor dice di andare a pricing_worker, vai
  if (state.next_step === 'pricing_worker') {
    return 'pricing_worker';
  }
  
  // Se serve chiarimento o errore, termina (l'API gestirà la risposta)
  if (state.next_step === 'request_clarification' || state.next_step === 'END') {
    return 'END';
  }
  
  // Default: termina
  return 'END';
};

/**
 * Router dopo Pricing Worker: torna sempre al supervisor per valutare il risultato
 */
const routeAfterPricingWorker = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > MAX_ITERATIONS) {
    console.warn(`⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`);
    return 'END';
  }
  
  // Se abbiamo preventivi, il supervisor deciderà se terminare
  if (state.pricing_options && state.pricing_options.length > 0) {
    return 'supervisor';
  }
  
  // Se c'è un errore o richiesta chiarimento, termina
  if (state.clarification_request || state.processingStatus === 'error') {
    return 'END';
  }
  
  // Altrimenti torna al supervisor per valutare
  return 'supervisor';
};

// Crea il grafo
const pricingWorkflow = new StateGraph<AgentState>({
  channels: {
    // Messaggi conversazione
    messages: {
      reducer: (a, b) => a.concat(b),
      default: () => [],
    },
    
    // Dati spedizione (per compatibilità con stato esistente)
    shipmentData: {
      reducer: (a, b) => ({ ...a, ...b }),
      default: () => ({}),
    },
    
    // Nuovi campi per preventivi
    shipment_details: {
      reducer: (a, b) => ({ ...a, ...b }),
      default: () => undefined,
    },
    
    pricing_options: {
      reducer: (a, b) => b ?? a,
      default: () => undefined,
    },
    
    next_step: {
      reducer: (a, b) => b ?? a,
      default: () => undefined,
    },
    
    clarification_request: {
      reducer: (a, b) => b ?? a,
      default: () => undefined,
    },
    
    iteration_count: {
      reducer: (a, b) => (b ?? a ?? 0) + 1, // Incrementa ad ogni update
      default: () => 0,
    },
    
    // Campi esistenti (per compatibilità)
    shipmentId: { reducer: (a, b) => b ?? a },
    processingStatus: { reducer: (a, b) => b ?? a },
    validationErrors: { reducer: (a, b) => b ?? a },
    confidenceScore: { reducer: (a, b) => b ?? a },
    needsHumanReview: { reducer: (a, b) => b ?? a },
    selectedCourier: { reducer: (a, b) => b ?? a },
    userId: { reducer: (a, b) => b ?? a },
    userEmail: { reducer: (a, b) => b ?? a },
  },
});

// Aggiungi nodi
pricingWorkflow.addNode('supervisor', supervisor);
pricingWorkflow.addNode('pricing_worker', pricingWorker);

// Entry point: supervisor
pricingWorkflow.setEntryPoint('supervisor' as any);

// Conditional edge dopo supervisor
pricingWorkflow.addConditionalEdges(
  'supervisor' as any,
  routeAfterSupervisor,
  {
    pricing_worker: 'pricing_worker',
    END: END,
  } as any
);

// Conditional edge dopo pricing_worker
pricingWorkflow.addConditionalEdges(
  'pricing_worker' as any,
  routeAfterPricingWorker,
  {
    supervisor: 'supervisor',
    END: END,
  } as any
);

// Compila il grafo
export const pricingGraph = pricingWorkflow.compile();

