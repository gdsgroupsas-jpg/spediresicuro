# Architettura Anne – Finale

Unico modello: **Ollama** (OLLAMA_BASE_URL, OLLAMA_MODEL). Nessuna chat generale: ogni messaggio viene classificato in un flusso. Per support, crm, outreach, listini, mentor, debug, explain il Supervisor restituisce un **macro**; una figura di **Intermediary** risolve l’azione **specifica** e invoca il flusso dedicato (con fallback/approval se necessario).

---

## Diagramma Anne finale

```mermaid
flowchart TB
  Client[Client]
  Route[Route agent-chat]
  Supervisor[Supervisor unico]
  Client --> Route
  Route --> Supervisor
  Supervisor -->|"Ollama classifica"| Macro[flowId macro]

  Macro --> Direct[Flussi diretti]
  Macro --> ViaInt[Flussi via Intermediary]

  subgraph direct [Flussi diretti]
    RP[Richiesta Preventivo]
    CS[Crea Spedizione]
    Direct --> RP
    Direct --> CS
  end

  subgraph intermediary [Intermediary]
    Resolve[Ollama risolve specifico]
    RunSpec[runSpecificFlow]
    Resolve --> RunSpec
  end

  ViaInt --> Resolve

  subgraph specific [Flussi specifici]
    subgraph sup [support]
      S1[support_tracking]
      S2[support_giacenza]
      S3[support_rimborso]
      S4[support_cancellazione]
      S5[support_problema_consegna]
      S6[support_assistenza]
    end
    subgraph crm [crm]
      C1[crm_pipeline]
      C2[crm_lead]
      C3[crm_opportunita]
      C4[crm_vendite]
    end
    subgraph out [outreach]
      O1[outreach_campagne]
      O2[outreach_comunicazioni]
      O3[outreach_marketing]
    end
    subgraph list [listini]
      L1[listini_visualizza]
      L2[listini_clona]
      L3[listini_assegna]
      L4[listini_gestione]
    end
    subgraph ment [mentor]
      M1[mentor_architettura]
      M2[mentor_wallet]
      M3[mentor_rls]
      M4[mentor_codice]
      M5[mentor_documentazione]
    end
    subgraph deb [debug]
      D1[debug_errore]
      D2[debug_bug]
      D3[debug_troubleshooting]
      D4[debug_analisi]
    end
    subgraph exp [explain]
      E1[explain_business]
      E2[explain_wallet]
      E3[explain_margini]
      E4[explain_flussi]
    end
  end

  RunSpec --> sup
  RunSpec --> crm
  RunSpec --> out
  RunSpec --> list
  RunSpec --> ment
  RunSpec --> deb
  RunSpec --> exp

  RP --> Response[Risposta]
  CS --> Response
  sup --> Response
  crm --> Response
  out --> Response
  list --> Response
  ment --> Response
  deb --> Response
  exp --> Response
  Response --> Client
```

---

## Grafico architettura

```mermaid
flowchart TB
  subgraph entry [Ingresso]
    Client[Client chat]
    Route[POST /api/ai/agent-chat]
  end

  Supervisor[Supervisor unico]
  Route --> Supervisor
  Supervisor -->|Ollama| MacroId[flowId macro]

  MacroId --> Direct[richiesta_preventivo / crea_spedizione]
  MacroId --> Intermediary[Intermediary]

  Direct --> RunFlow[runFlow]
  RunFlow --> RP[Richiesta Preventivo]
  RunFlow --> CS[Crea Spedizione]

  Intermediary -->|Ollama risoluzione specifica| SpecificId[specificFlowId]
  SpecificId --> RunSpecific[runSpecificFlow]
  RunSpecific --> SupportFlows[Flussi support_*]
  RunSpecific --> CrmFlows[Flussi crm_*]
  RunSpecific --> OtherFlows[outreach_* listini_* mentor_* debug_* explain_*]

  SupportFlows --> Out[Response]
  CrmFlows --> Out
  OtherFlows --> Out
  RP --> Out
  CS --> Out
  Out --> Client
```

---

## Flusso dati (semplificato)

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route
  participant S as Supervisor
  participant I as Intermediary
  participant O as Ollama
  participant F as runFlow / runSpecificFlow

  C->>R: POST message
  R->>S: supervisorRoute(message)
  S->>O: chat (classifica macro)
  O-->>S: flowId
  S-->>R: flowId

  alt richiesta_preventivo / crea_spedizione
    R->>F: runFlow(flowId, context)
    F-->>R: FlowResult
  else support / crm / outreach / listini / mentor / debug / explain
    R->>F: runFlow(flowId, context)
    F->>I: runIntermediary(macro, context)
    I->>O: chat (risolvi azione specifica)
    O-->>I: specificFlowId
    I->>F: runSpecificFlow(specificFlowId, context)
    F-->>I: FlowResult
    I-->>F: IntermediaryResult (con eventuale fallback/approval)
    F-->>R: FlowResult
  end
  R-->>C: JSON success, message, metadata (flowId, specificFlowId)
```

---

## Componenti

| Componente               | File                                      | Ruolo                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supervisor**           | `lib/agent/supervisor.ts`                 | Classifica il messaggio con Ollama in un solo **macro** flowId. Nessun grafo, nessun nodo.                                                                                                                  |
| **Intermediary**         | `lib/agent/intermediary.ts`               | Solo per macro support/crm/outreach/listini/mentor/debug/explain: risolve con Ollama l’**azione specifica**, invoca `runSpecificFlow`, gestisce fallback (validazione fallita) e richieste di approvazione. |
| **runFlow**              | `lib/agent/flows/run-flow.ts`             | Se flowId è richiesta_preventivo o crea_spedizione → flusso diretto; se macro con specifici → delega a `runIntermediary`.                                                                                   |
| **runSpecificFlow**      | `lib/agent/flows/run-specific-flow.ts`    | Esegue un singolo flusso specifico (es. support_tracking, crm_lead); ogni azione ha un flowId dedicato.                                                                                                     |
| **Specific flowIds**     | `lib/agent/specific-flows.ts`             | Elenco di tutti i `specificFlowId` e mappa macro → specifici.                                                                                                                                               |
| **Richiesta Preventivo** | `lib/agent/flows/richiesta-preventivo.ts` | Ollama estrae peso, CAP, provincia; se completi → pricing engine; altrimenti chiarimento.                                                                                                                   |
| **Crea Spedizione**      | `lib/agent/workers/shipment-creation/`    | Catena esistente (validation workers → pricing → booking).                                                                                                                                                  |
| **Route**                | `app/api/ai/agent-chat/route.ts`          | Auth, rate limit, `supervisorRoute` → `runFlow(flowId)` → risposta JSON (metadata può includere `specificFlowId`).                                                                                          |

---

## FlowId macro (Supervisor)

- `richiesta_preventivo`
- `crea_spedizione`
- `support`
- `crm`
- `outreach`
- `listini`
- `mentor`
- `debug`
- `explain`

In caso di errore di classificazione Ollama, il Supervisor restituisce `support` come default.

---

## Flussi specifici (per macro)

Ogni macro support/crm/outreach/listini/mentor/debug/explain viene risolta dall’Intermediary in **un’azione specifica**. Ogni azione ha un flusso dedicato.

| Macro        | Flussi specifici                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **support**  | support_tracking, support_giacenza, support_rimborso, support_cancellazione, support_problema_consegna, support_assistenza |
| **crm**      | crm_pipeline, crm_lead, crm_opportunita, crm_vendite                                                                       |
| **outreach** | outreach_campagne, outreach_comunicazioni, outreach_marketing                                                              |
| **listini**  | listini_visualizza, listini_clona, listini_assegna, listini_gestione                                                       |
| **mentor**   | mentor_architettura, mentor_wallet, mentor_rls, mentor_codice, mentor_documentazione                                       |
| **debug**    | debug_errore, debug_bug, debug_troubleshooting, debug_analisi                                                              |
| **explain**  | explain_business, explain_wallet, explain_margini, explain_flussi                                                          |

---

## Note operative

- **WhatsApp** usa lo stesso flusso: webhook `/api/webhooks/whatsapp` chiama `supervisorRoute()` e `runFlow()` come la route web; la risposta viene formattata per WhatsApp (testo, card prezzi, booking).
- **Endpoint e test legacy** sono stati rimossi: `/api/anne/chat`, `/api/dev/test-anne-shipment`, modulo `supervisor-router`, pricing-graph e nodo supervisor dell’orchestrator. L’unico entry point è `supervisorRoute` + `runFlow` (+ Intermediary per i macro).
