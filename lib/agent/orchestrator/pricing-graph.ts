/**
 * Pricing Graph (Sprint 2.3)
 * 
 * Grafo LangGraph per la gestione dei preventivi:
 * Supervisor -> Address Worker (se mancano dati) -> Pricing Worker -> Supervisor
 * 
 * FLUSSO:
 * 1. supervisor decide next_step
 * 2. Se address_worker: estrae/normalizza dati, poi torna a supervisor
 * 3. Se pricing_worker: calcola preventivo
 * 4. Se END: risposta pronta
 */

import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { supervisor } from './supervisor';
import { pricingWorker } from '../workers/pricing';
import { addressWorker } from '../workers/address';
import { ocrWorker } from '../workers/ocr';
import { bookingWorker } from '../workers/booking';

// Limite iterazioni per prevenire loop infiniti
const MAX_ITERATIONS = 2;

/**
 * Router dopo Supervisor: decide se andare a pricing_worker, address_worker, ocr_worker, o END
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
  
  // Sprint 2.4: Se il supervisor dice di andare a ocr_worker, vai
  if (state.next_step === 'ocr_worker') {
    return 'ocr_worker';
  }
  
  // Sprint 2.6: Se il supervisor dice di andare a booking_worker, vai
  if (state.next_step === 'booking_worker') {
    return 'booking_worker';
  }
  
  // Sprint 2.3: Se il supervisor dice di andare a address_worker, vai
  if (state.next_step === 'address_worker') {
    return 'address_worker';
  }
  
  // Se il supervisor dice END o legacy, termina (l'API gestirà la risposta)
  if (state.next_step === 'END' || state.next_step === 'legacy') {
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

/**
 * Router dopo Address Worker (Sprint 2.3)
 * 
 * Se address_worker ha raccolto abbastanza dati → pricing_worker
 * Se address_worker ha generato clarification → END
 * Altrimenti → supervisor per rivalutare
 */
const routeAfterAddressWorker = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > MAX_ITERATIONS) {
    console.warn(`⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`);
    return 'END';
  }
  
  // Se address_worker dice di andare a pricing_worker
  if (state.next_step === 'pricing_worker') {
    return 'pricing_worker';
  }
  
  // Se c'è richiesta chiarimento, termina
  if (state.clarification_request) {
    return 'END';
  }
  
  // Se c'è errore, termina
  if (state.processingStatus === 'error') {
    return 'END';
  }
  
  // Default: termina (l'address_worker avrà impostato next_step = END)
  return 'END';
};

/**
 * Router dopo OCR Worker (Sprint 2.4)
 * 
 * Se ocr_worker ha estratto abbastanza dati → address_worker (per normalizzazione)
 * Se ocr_worker ha generato clarification → END
 * Se ocr_worker non ha trovato nulla → END con clarification
 */
const routeAfterOcrWorker = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > MAX_ITERATIONS) {
    console.warn(`⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`);
    return 'END';
  }
  
  // Se ocr_worker dice di andare a address_worker
  if (state.next_step === 'address_worker') {
    return 'address_worker';
  }
  
  // Se ocr_worker dice di andare direttamente a pricing_worker
  if (state.next_step === 'pricing_worker') {
    return 'pricing_worker';
  }
  
  // Se c'è richiesta chiarimento, termina
  if (state.clarification_request) {
    return 'END';
  }
  
  // Se c'è errore, termina
  if (state.processingStatus === 'error') {
    return 'END';
  }
  
  // Default: termina
  return 'END';
};

/**
 * Router dopo Booking Worker (Sprint 2.6)
 * 
 * Booking worker termina sempre con END.
 * Non c'è loop: il booking è un'azione finale.
 */
const routeAfterBookingWorker = (state: AgentState): string => {
  // Booking sempre termina, non c'è retry automatico
  return 'END';
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
    
    // Sprint 2.3: Bozza spedizione (merge non distruttivo)
    shipmentDraft: {
      reducer: (a, b) => {
        if (!b) return a;
        if (!a) return b;
        // Merge profondo
        return {
          sender: { ...a.sender, ...b.sender },
          recipient: { ...a.recipient, ...b.recipient },
          parcel: { ...a.parcel, ...b.parcel },
          missingFields: b.missingFields ?? a.missingFields ?? [],
        };
      },
      default: () => undefined,
    },
    
    // Sprint 2.6: Risultato booking
    booking_result: {
      reducer: (a, b) => b ?? a,
      default: () => undefined,
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

// Wrapper per i worker che usano logger (LangGraph non supporta parametri opzionali aggiuntivi)
const pricingWorkerWrapper = (state: AgentState) => pricingWorker(state);
const addressWorkerWrapper = (state: AgentState) => addressWorker(state);
const ocrWorkerWrapper = (state: AgentState) => ocrWorker(state);
const bookingWorkerWrapper = (state: AgentState) => bookingWorker(state);

// Aggiungi nodi
pricingWorkflow.addNode('supervisor', supervisor);
pricingWorkflow.addNode('pricing_worker', pricingWorkerWrapper);
pricingWorkflow.addNode('address_worker', addressWorkerWrapper); // Sprint 2.3
pricingWorkflow.addNode('ocr_worker', ocrWorkerWrapper); // Sprint 2.4
pricingWorkflow.addNode('booking_worker', bookingWorkerWrapper); // Sprint 2.6

// NOTE: I cast `as any` qui sono necessari a causa di limitazioni di tipo in LangGraph.
// LangGraph non ha tipi perfetti per i nomi dei nodi (string literal types).
// Il comportamento runtime è corretto, ma TypeScript richiede questi cast.
// TODO: Rimuovere quando LangGraph migliorerà i tipi.

// Entry point: supervisor
pricingWorkflow.setEntryPoint('supervisor' as any);

// Conditional edge dopo supervisor
pricingWorkflow.addConditionalEdges(
  'supervisor' as any,
  routeAfterSupervisor,
  {
    pricing_worker: 'pricing_worker',
    address_worker: 'address_worker', // Sprint 2.3
    ocr_worker: 'ocr_worker', // Sprint 2.4
    booking_worker: 'booking_worker', // Sprint 2.6
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

// Sprint 2.3: Conditional edge dopo address_worker
pricingWorkflow.addConditionalEdges(
  'address_worker' as any,
  routeAfterAddressWorker,
  {
    pricing_worker: 'pricing_worker',
    END: END,
  } as any
);

// Sprint 2.4: Conditional edge dopo ocr_worker
pricingWorkflow.addConditionalEdges(
  'ocr_worker' as any,
  routeAfterOcrWorker,
  {
    address_worker: 'address_worker',
    pricing_worker: 'pricing_worker',
    END: END,
  } as any
);

// Sprint 2.6: Conditional edge dopo booking_worker
pricingWorkflow.addConditionalEdges(
  'booking_worker' as any,
  routeAfterBookingWorker,
  {
    END: END,
  } as any
);

// Compila il grafo
export const pricingGraph = pricingWorkflow.compile();

