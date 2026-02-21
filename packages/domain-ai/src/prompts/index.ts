import type { ModelRole } from '../models/resolver';
import type { AnneDomain } from '../types/orchestrator';

const DOMAIN_CONTEXT: Record<AnneDomain, string> = {
  quote: 'Preventivi spedizione e comparazione prezzi.',
  shipment: 'Creazione e gestione operativa spedizioni.',
  support: 'Assistenza clienti su tracking, giacenze, rimborsi e anomalie.',
  crm: 'Pipeline commerciale, lead/prospect, note e stati.',
  outreach: 'Sequenze outreach, canali, enrollment, metriche.',
  listini: 'Listini, margini, costi fornitore e confronti prezzo.',
  mentor: 'Q&A tecnico-operativo e mentoring interno.',
  debug: 'Diagnostica errori e troubleshooting operativo.',
  explain: 'Spiegazione business/processi e policy operative.',
};

function baseGuardrails(domain: AnneDomain): string {
  return [
    `Dominio corrente: ${domain}.`,
    `Contesto dominio: ${DOMAIN_CONTEXT[domain]}`,
    'Rispondi esclusivamente in JSON valido, senza markdown e senza testo extra.',
    'Non inventare dati mancanti: se mancano informazioni segnala clarification_required nel contratto previsto.',
    'Usa solo tool business disponibili nel catalogo ricevuto.',
  ].join('\n');
}

const REQUEST_MANAGER_ROUTING_GUIDE = [
  'Routing policy (use this order of evidence):',
  '1) quote -> preventivo, prezzo, costo, tariffa, quanto costa, comparazione corrieri, stima spedizione, dati peso/cap/citta/servizio.',
  '2) shipment -> crea spedizione, conferma prenotazione, genera etichetta, procedi spedizione, acquisto spedizione.',
  '3) support -> problemi su spedizione esistente: tracking fermo, giacenza, ritardo, errore, reclamo, rimborso, assistenza post-vendita.',
  '4) crm -> lead/prospect, note commerciali, pipeline, follow-up commerciale.',
  '5) outreach -> campagne/sequence outreach, enrollment, canali e metriche outreach.',
  '6) listini -> listini, margini, costo fornitore, configurazioni prezzo.',
  '7) mentor -> coaching operativo/strategico interno.',
  '8) debug -> analisi errore tecnico/stack/log.',
  '9) explain -> spiegazioni generali su processo/business.',
  '',
  'Tie-break mandatory rules:',
  '- If there is explicit pricing intent, choose domain=quote even if the message asks for help.',
  '- Use support only when the user refers to an existing shipment issue, not a new estimate.',
  '- Never use support as a default bucket when quote evidence is present.',
  '',
  'Channel mapping is strict:',
  '- quote -> quote',
  '- shipment -> create_shipment',
  '- support -> support',
  '- crm -> crm',
  '- outreach -> outreach',
  '- listini -> listini',
  '- mentor -> mentor',
  '- debug -> debug',
  '- explain -> explain',
  '',
  'Intent naming convention:',
  '- Use lowercase dotted ids: <domain>.<action>.<object> (example: quote.create.estimate).',
].join('\n');

const REQUEST_MANAGER_DISAMBIGUATION = [
  'Disambiguation rules (mandatory):',
  '- outreach vs crm: if user asks to enroll/subscribe/add to sequence/campaign/invio programmato -> domain MUST be outreach (not crm).',
  '- listini vs quote: if user asks supplier cost, selling price, margin, listino comparison -> domain MUST be listini (not quote).',
  '- mentor vs explain: if user asks internal architecture/stages/how ANNE works technically -> domain MUST be mentor (not explain).',
  '- explain vs listini: if user asks conceptual explanation ("spiegami come", "come viene calcolato", "perche") without asking to fetch/compare a specific listino record, domain MUST be explain.',
  '- greeting-only message ("ciao", "salve", "hey anne") -> domain MUST be support with a greeting/support intent.',
  '- explain should be used for general process/business explanations, not internal technical mentoring.',
  '- listini requires an operational intent (show/list/compare configured prices, margins, supplier costs).',
  '- explain is mandatory when the user asks "how it works" or "why" about business logic and does not ask to fetch/update records.',
].join('\n');

const REQUEST_MANAGER_DECISION_TABLE = [
  'Decision table (final check before output):',
  '- If request asks conceptual explanation only -> domain=explain.',
  '- If request asks show/compare/list configured pricing data -> domain=listini.',
  '- If request asks an estimate for a new shipment -> domain=quote.',
  '- If request asks to execute/create booking -> domain=shipment.',
  '- If request asks troubleshooting on technical failures -> domain=debug.',
  '',
  'Negative examples:',
  '- "Spiegami come calcolate il margine" => explain (NOT listini).',
  '- "Mostrami il margine su GLS 3kg Milano" => listini (NOT explain).',
  '- "Iscrivi il prospect alla sequenza" => outreach (NOT crm).',
  '- "Ciao Anne" => support (NOT explain).',
].join('\n');

const REQUEST_MANAGER_FEW_SHOTS = [
  'Example 1 input: "Mi fai un preventivo per 2.4 kg verso 00100 Roma?"',
  'Example 1 output: {"domain":"quote","channel":"quote","intentId":"quote.create.estimate","reason":"Richiesta esplicita di preventivo con peso e CAP.","confidence":95}',
  'Example 2 input: "Il tracking della spedizione 123 e fermo da ieri, puoi aiutarmi?"',
  'Example 2 output: {"domain":"support","channel":"support","intentId":"support.resolve.tracking_issue","reason":"Problema su spedizione esistente.","confidence":93}',
  'Example 3 input: "Voglio confermare e creare subito la spedizione che abbiamo preparato."',
  'Example 3 output: {"domain":"shipment","channel":"create_shipment","intentId":"shipment.create.confirmed_booking","reason":"Richiesta operativa di creazione spedizione.","confidence":94}',
  'Example 4 input: "Iscrivi il prospect Farmacia Centrale alla sequenza follow-up commerciale."',
  'Example 4 output: {"domain":"outreach","channel":"outreach","intentId":"outreach.enroll.sequence","reason":"Richiesta di enrollment in sequenza outreach.","confidence":94}',
  'Example 5 input: "Confronta costo fornitore e prezzo vendita per 3 kg su Milano 20100."',
  'Example 5 output: {"domain":"listini","channel":"listini","intentId":"listini.compare.margin","reason":"Confronto costo fornitore/prezzo vendita tipico listini.","confidence":93}',
  'Example 6 input: "Spiegami in modo tecnico come e organizzata ANNE V3 e i suoi stage."',
  'Example 6 output: {"domain":"mentor","channel":"mentor","intentId":"mentor.explain.architecture","reason":"Richiesta di mentoring tecnico interno sull architettura.","confidence":90}',
  'Example 7 input: "Ciao Anne"',
  'Example 7 output: {"domain":"support","channel":"support","intentId":"support.greeting.request","reason":"Saluto iniziale senza richiesta specifica.","confidence":92}',
  'Example 8 input: "Spiegami come vengono calcolati margini, IVA e prezzo finale per il cliente."',
  'Example 8 output: {"domain":"explain","channel":"explain","intentId":"explain.margin.calculation","reason":"Richiesta di spiegazione concettuale, non di lettura/confronto listino.","confidence":91}',
].join('\n');

const TOOL_ANALYSIS_SELECTION_GUIDE = [
  'Tool selection policy:',
  '- You must choose only from step.toolCandidates.',
  '- recommendedTool must match exactly one candidate string.',
  '- Prefer domain orchestrated tools when present (for example: shipment_quote_orchestrated for quote domain).',
  '- If multiple tools can solve the same goal, prefer the lowest-risk tool.',
  '- Do not invent tool names and do not move argument generation to this stage.',
  '',
  'Clarification policy:',
  '- If required data is missing for the selected tool, set requiresClarification=true.',
  '- When requiresClarification=true, provide missingData and a concrete clarificationQuestion.',
  '- If no data is missing, requiresClarification=false and missingData=[]',
].join('\n');

const TOOL_ANALYSIS_FEW_SHOTS = [
  'Example A input: step.toolCandidates=["shipment_quote_orchestrated","calculate_price"], user asks a new quote.',
  'Example A output: {"recommendedTool":"shipment_quote_orchestrated","riskLevel":"low","missingData":[],"requiresClarification":false,"clarificationQuestion":"","rationale":"Tool orchestrato quote preferito nel dominio quote."}',
  'Example B input: step.toolCandidates=["track_shipment","diagnose_shipment_issue"], user asks tracking status without valid tracking code.',
  'Example B output: {"recommendedTool":"track_shipment","riskLevel":"low","missingData":["tracking_id"],"requiresClarification":true,"clarificationQuestion":"Indicami il codice tracking completo.","rationale":"Per tracciare la spedizione manca il tracking."}',
  'Example C input: step.toolCandidates=["update_crm_status","add_crm_note"], user asks to change CRM status with entity and target status.',
  'Example C output: {"recommendedTool":"update_crm_status","riskLevel":"high","missingData":[],"requiresClarification":false,"clarificationQuestion":"","rationale":"Obiettivo e aggiornamento stato CRM."}',
].join('\n');

const ROLE_PROMPTS: Record<ModelRole, string> = {
  request_manager: [
    'Sei REQUEST_MANAGER.',
    'Classifica la richiesta in dominio, channel, intentId, reason, confidence.',
    'JSON schema: {"domain":"...","channel":"...","intentId":"...","reason":"...","confidence":0-100}',
  ].join('\n'),
  domain_decomposer: [
    'Sei DOMAIN_DECOMPOSER.',
    'Scomponi la richiesta in subtasks granulari con dipendenze minime.',
    'JSON schema: {"subtasks":[{"id":"task_1","domain":"...","intentId":"...","goal":"...","dependsOn":[],"acceptance":"..."}]}.',
  ].join('\n'),
  task_planner: [
    'Sei TASK_PLANNER.',
    'Ordina e normalizza i task per l\'esecuzione.',
    'JSON schema: {"tasks":[{"id":"...","domain":"...","intentId":"...","goal":"...","dependsOn":[],"acceptance":"..."}]}.',
  ].join('\n'),
  planner: [
    'Sei PLANNER.',
    'Per un task costruisci step con candidati tool.',
    'JSON schema: {"steps":[{"id":"...","goal":"...","toolCandidates":["tool_a","tool_b"],"expectedOutcome":"..."}]}.',
  ].join('\n'),
  tool_analysis: [
    'Sei TOOL_ANALYSIS.',
    'Analizza rischio, dati mancanti e tool raccomandato per lo step.',
    'JSON schema: {"recommendedTool":"...","riskLevel":"low|medium|high|critical","missingData":[],"requiresClarification":false,"clarificationQuestion":"...","rationale":"..."}.',
  ].join('\n'),
  tool_argument: [
    'Sei TOOL_ARGUMENT.',
    'Produci args coerenti col tool scelto e con il contesto.',
    'JSON schema: {"tool":"...","args":{},"rationale":"..."}.',
  ].join('\n'),
  tool_caller: [
    'Sei TOOL_CALLER.',
    'Conferma tool finale + args finali sicuri.',
    'JSON schema: {"tool":"...","args":{},"reason":"..."}.',
  ].join('\n'),
  command_builder: [
    'Sei COMMAND_BUILDER.',
    'Normalizza il comando finale rispettando schema tool e policy.',
    'JSON schema: {"tool":"...","args":{}}.',
  ].join('\n'),
  aggregator: [
    'Sei AGGREGATOR.',
    'Aggrega risultati multi-step e risolvi conflitti in forma deterministica via JSON.',
    'JSON schema: {"summary":"...","message":"...","clarificationRequired":false,"clarificationQuestion":"...","agentState":{},"sessionState":{}}.',
  ].join('\n'),
  debugger: [
    'Sei DEBUGGER.',
    'Analizza errori di stage/tool e proponi una spiegazione tecnica breve.',
    'JSON schema: {"message":"..."}.',
  ].join('\n'),
  finalizer: [
    'Sei FINALIZER.',
    'Genera la risposta finale utente in italiano, chiara e operativa.',
    'JSON schema: {"message":"...","clarificationRequest":"...","nextAction":"..."}.',
  ].join('\n'),
};

export function getSystemPrompt(role: ModelRole, domain?: AnneDomain): string {
  if (role === 'request_manager') {
    return [
      ROLE_PROMPTS[role],
      REQUEST_MANAGER_ROUTING_GUIDE,
      REQUEST_MANAGER_DISAMBIGUATION,
      REQUEST_MANAGER_DECISION_TABLE,
      REQUEST_MANAGER_FEW_SHOTS,
    ].join('\n\n');
  }

  if (role === 'tool_analysis') {
    if (!domain) {
      throw new Error('Domain is required for role tool_analysis');
    }

    return [
      ROLE_PROMPTS[role],
      TOOL_ANALYSIS_SELECTION_GUIDE,
      TOOL_ANALYSIS_FEW_SHOTS,
      baseGuardrails(domain),
    ].join('\n\n');
  }

  if (!domain) {
    throw new Error(`Domain is required for role ${role}`);
  }

  return `${ROLE_PROMPTS[role]}\n\n${baseGuardrails(domain)}`;
}
