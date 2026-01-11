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

import { graphConfig } from "@/lib/config";
import { END, StateGraph } from "@langchain/langgraph";
import { defaultLogger } from "../logger";
import { addressWorker } from "../workers/address";
import { bookingWorker } from "../workers/booking";
import { debugWorker } from "../workers/debug";
import { explainWorker } from "../workers/explain";
import { mentorWorker } from "../workers/mentor";
import { ocrWorker } from "../workers/ocr";
import { priceListManagerWorker } from "../workers/price-list-manager";
import { pricingWorker } from "../workers/pricing";
import { AgentState } from "./state";
import { supervisor } from "./supervisor";

/**
 * Router dopo Supervisor: decide se andare a pricing_worker, address_worker, ocr_worker, o END
 */
const routeAfterSupervisor = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > graphConfig.MAX_ITERATIONS) {
    defaultLogger.warn(
      `⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`
    );
    return "END";
  }

  // Se abbiamo già preventivi, termina
  if (state.pricing_options && state.pricing_options.length > 0) {
    return "END";
  }

  // Se il supervisor dice di andare a pricing_worker, vai
  if (state.next_step === "pricing_worker") {
    return "pricing_worker";
  }

  // Sprint 2.4: Se il supervisor dice di andare a ocr_worker, vai
  if (state.next_step === "ocr_worker") {
    return "ocr_worker";
  }

  // Sprint 2.6: Se il supervisor dice di andare a booking_worker, vai
  if (state.next_step === "booking_worker") {
    return "booking_worker";
  }

  // P2: Se il supervisor dice di andare a explain_worker, vai
  if (state.next_step === "explain_worker") {
    return "explain_worker";
  }

  if (state.next_step === "debug_worker") {
    return "debug_worker";
  }

  // P3: Se il supervisor dice di andare a price_list_worker, vai
  if (state.next_step === "price_list_worker") {
    return "price_list_worker";
  }

  // P1: Se il supervisor dice di andare a mentor_worker, vai
  if (state.next_step === "mentor_worker") {
    return "mentor_worker";
  }

  // Sprint 2.3: Se il supervisor dice di andare a address_worker, vai
  if (state.next_step === "address_worker") {
    return "address_worker";
  }

  // Se il supervisor dice END o legacy, termina (l'API gestirà la risposta)
  if (state.next_step === "END" || state.next_step === "legacy") {
    return "END";
  }

  // Default: termina
  return "END";
};

/**
 * Router dopo Pricing Worker: torna sempre al supervisor per valutare il risultato
 */
const routeAfterPricingWorker = (state: AgentState): string => {
  // SAFE: Controlla limite iterazioni
  const iterationCount = (state.iteration_count || 0) + 1;
  if (iterationCount > graphConfig.MAX_ITERATIONS) {
    defaultLogger.warn(
      `⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`
    );
    return "END";
  }

  // Se abbiamo preventivi, il supervisor deciderà se terminare
  if (state.pricing_options && state.pricing_options.length > 0) {
    return "supervisor";
  }

  // Se c'è un errore o richiesta chiarimento, termina
  if (state.clarification_request || state.processingStatus === "error") {
    return "END";
  }

  // Altrimenti torna al supervisor per valutare
  return "supervisor";
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
  if (iterationCount > graphConfig.MAX_ITERATIONS) {
    defaultLogger.warn(
      `⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`
    );
    return "END";
  }

  // Se address_worker dice di andare a pricing_worker
  if (state.next_step === "pricing_worker") {
    return "pricing_worker";
  }

  // Se c'è richiesta chiarimento, termina
  if (state.clarification_request) {
    return "END";
  }

  // Se c'è errore, termina
  if (state.processingStatus === "error") {
    return "END";
  }

  // Default: termina (l'address_worker avrà impostato next_step = END)
  return "END";
};

/**
 * Router dopo Mentor Worker (P1)
 *
 * Mentor worker termina sempre (risposta pronta) → END
 */
const routeAfterMentorWorker = (state: AgentState): string => {
  // Mentor worker termina sempre (ha già impostato next_step = END)
  if (state.mentor_response) {
    return "END";
  }

  // Se c'è errore o clarification, termina
  if (state.clarification_request || state.processingStatus === "error") {
    return "END";
  }

  // Default: termina
  return "END";
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
  if (iterationCount > graphConfig.MAX_ITERATIONS) {
    defaultLogger.warn(
      `⚠️ [Pricing Graph] Limite iterazioni raggiunto (${iterationCount}), termino`
    );
    return "END";
  }

  // Se ocr_worker dice di andare a address_worker
  if (state.next_step === "address_worker") {
    return "address_worker";
  }

  // Se ocr_worker dice di andare direttamente a pricing_worker
  if (state.next_step === "pricing_worker") {
    return "pricing_worker";
  }

  // Se c'è richiesta chiarimento, termina
  if (state.clarification_request) {
    return "END";
  }

  // Se c'è errore, termina
  if (state.processingStatus === "error") {
    return "END";
  }

  // Default: termina
  return "END";
};

/**
 * Router dopo Booking Worker (Sprint 2.6)
 *
 * Booking worker termina sempre con END.
 * Non c'è loop: il booking è un'azione finale.
 */
const routeAfterBookingWorker = (state: AgentState): string => {
  // Booking sempre termina, non c'è retry automatico
  return "END";
};

/**
 * Router dopo Debug Worker (P2)
 *
 * Debug worker termina sempre con END (risposta pronta).
 */
const routeAfterDebugWorker = (state: AgentState): string => {
  // Debug worker sempre termina con risposta pronta
  return "END";
};

/**
 * Router dopo Explain Worker (P2)
 *
 * Explain worker termina sempre con END (risposta pronta).
 */
const routeAfterExplainWorker = (state: AgentState): string => {
  // Explain worker sempre termina con risposta pronta
  return "END";
};

/**
 * Router dopo Price List Worker (P3)
 */
const routeAfterPriceListWorker = (state: AgentState): string => {
  // Price List worker sempre termina con risposta pronta
  return "END";
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

    // P1: Risposta mentor worker
    mentor_response: {
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

// Wrapper per i worker e supervisor che usano logger (LangGraph non supporta parametri opzionali aggiuntivi)
const supervisorWrapper = (state: AgentState) => supervisor(state);
const pricingWorkerWrapper = (state: AgentState) => pricingWorker(state);
const addressWorkerWrapper = (state: AgentState) => addressWorker(state);
const ocrWorkerWrapper = (state: AgentState) => ocrWorker(state);
const bookingWorkerWrapper = (state: AgentState) => bookingWorker(state);
const mentorWorkerWrapper = (state: AgentState) => mentorWorker(state); // P1
const debugWorkerWrapper = (state: AgentState) => debugWorker(state); // P2
const explainWorkerWrapper = (state: AgentState) => explainWorker(state); // P2
const priceListWorkerWrapper = (state: AgentState) =>
  priceListManagerWorker(state); // P3

// Aggiungi nodi
pricingWorkflow.addNode("supervisor", supervisorWrapper);
pricingWorkflow.addNode("pricing_worker", pricingWorkerWrapper);
pricingWorkflow.addNode("address_worker", addressWorkerWrapper); // Sprint 2.3
pricingWorkflow.addNode("ocr_worker", ocrWorkerWrapper); // Sprint 2.4
pricingWorkflow.addNode("booking_worker", bookingWorkerWrapper); // Sprint 2.6
pricingWorkflow.addNode("mentor_worker", mentorWorkerWrapper); // P1
pricingWorkflow.addNode("debug_worker", debugWorkerWrapper); // P2
pricingWorkflow.addNode("explain_worker", explainWorkerWrapper); // P2
pricingWorkflow.addNode("price_list_worker", priceListWorkerWrapper); // P3

// NOTE: I cast `as any` qui sono necessari a causa di limitazioni di tipo in LangGraph.
// LangGraph non ha tipi perfetti per i nomi dei nodi (string literal types).
// Il comportamento runtime è corretto, ma TypeScript richiede questi cast.
// P3 Task 5: Manteniamo cast per compatibilità LangGraph API, ma documentati.

// Entry point: supervisor
pricingWorkflow.setEntryPoint("supervisor" as any);

// Conditional edge dopo supervisor
pricingWorkflow.addConditionalEdges("supervisor" as any, routeAfterSupervisor, {
  pricing_worker: "pricing_worker",
  address_worker: "address_worker", // Sprint 2.3
  ocr_worker: "ocr_worker", // Sprint 2.4
  booking_worker: "booking_worker", // Sprint 2.6
  mentor_worker: "mentor_worker", // P1
  debug_worker: "debug_worker", // P2
  explain_worker: "explain_worker", // P2
  price_list_worker: "price_list_worker", // P3
  END: END,
} as any);

// Conditional edge dopo pricing_worker
pricingWorkflow.addConditionalEdges(
  "pricing_worker" as any,
  routeAfterPricingWorker,
  {
    supervisor: "supervisor",
    END: END,
  } as any
);

// Sprint 2.3: Conditional edge dopo address_worker
pricingWorkflow.addConditionalEdges(
  "address_worker" as any,
  routeAfterAddressWorker,
  {
    pricing_worker: "pricing_worker",
    END: END,
  } as any
);

// Sprint 2.4: Conditional edge dopo ocr_worker
pricingWorkflow.addConditionalEdges("ocr_worker" as any, routeAfterOcrWorker, {
  address_worker: "address_worker",
  pricing_worker: "pricing_worker",
  END: END,
} as any);

// Sprint 2.6: Conditional edge dopo booking_worker
pricingWorkflow.addConditionalEdges(
  "booking_worker" as any,
  routeAfterBookingWorker,
  {
    END: END,
  } as any
);

// P1: Conditional edge dopo mentor_worker
pricingWorkflow.addConditionalEdges(
  "mentor_worker" as any,
  routeAfterMentorWorker,
  {
    END: END,
  } as any
);

// P2: Conditional edge dopo debug_worker
pricingWorkflow.addConditionalEdges(
  "debug_worker" as any,
  routeAfterDebugWorker,
  {
    END: END,
  } as any
);

// P2: Conditional edge dopo explain_worker
pricingWorkflow.addConditionalEdges(
  "explain_worker" as any,
  routeAfterExplainWorker,
  {
    END: END,
  } as any
);

// P3: Conditional edge dopo price_list_worker
pricingWorkflow.addConditionalEdges(
  "price_list_worker" as any,
  routeAfterPriceListWorker,
  {
    END: END,
  } as any
);

// Compila il grafo
// P3 Task 1: Checkpointer opzionale per persistenza stato
// Il checkpointer viene passato al compile() quando disponibile (da supervisor-router)
export const pricingGraph = pricingWorkflow.compile();

/**
 * Factory per creare graph con checkpointer (P3 Task 1).
 * Usa checkpointer per persistenza stato conversazioni multi-turn.
 */
export function createPricingGraphWithCheckpointer(checkpointer: any) {
  return pricingWorkflow.compile({ checkpointer });
}
