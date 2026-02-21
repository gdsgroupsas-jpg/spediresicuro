import type {
  AnneOrchestratorInput,
  RequestClassification,
  StageTraceEntry,
} from '../../types/orchestrator';
import type { OrchestratorDependencies } from '../../types/dependencies';
import { parseRequestManagerContract, ContractValidationError } from '../contracts';
import { getSystemPrompt } from '../../prompts';
import { runModelStage } from './shared';

const DOMAIN_CHANNEL_MAP: Record<RequestClassification['domain'], RequestClassification['channel']> = {
  quote: 'quote',
  shipment: 'create_shipment',
  support: 'support',
  crm: 'crm',
  outreach: 'outreach',
  listini: 'listini',
  mentor: 'mentor',
  debug: 'debug',
  explain: 'explain',
};

export async function runRequestManagerStage(
  input: AnneOrchestratorInput,
  deps: OrchestratorDependencies,
  pipelineId: string,
  maxAttempts: number
): Promise<{ classification: RequestClassification; traces: StageTraceEntry[] }> {
  const buildAttemptInstruction = (attempt: number): string => {
    if (attempt <= 1) {
      return [
        'Classifica la richiesta in uno dei domini ammessi.',
        'Priorita: evita support quando c e una richiesta di preventivo/prezzo.',
      ].join(' ');
    }

    return [
      'STRICT RETRY MODE.',
      'L output precedente era incoerente o non valido.',
      'Applica in modo rigoroso le regole di disambiguazione del system prompt.',
      'Non usare crm per richieste di enrollment/sequenza outreach.',
      'Non usare quote per confronto costo fornitore/prezzo vendita (usa listini).',
      'Non usare explain per mentoring tecnico interno su ANNE (usa mentor).',
      'Se la richiesta e una spiegazione concettuale (spiegami come/perche) senza fetch/compare di record, usa explain.',
      'Usa listini solo quando l utente chiede mostra/lista/confronta dati listino specifici.',
      'Per saluti semplici usa support.',
    ].join(' ');
  };

  const result = await runModelStage<RequestClassification>({
    stage: 'request_manager',
    role: 'request_manager',
    domain: undefined,
    deps,
    pipelineId,
    traceId: input.traceId,
    maxAttempts: Math.max(maxAttempts, 3),
    buildMessages: (attempt, lastError) => [
      {
        role: 'system',
        content: getSystemPrompt('request_manager'),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            instruction: buildAttemptInstruction(attempt),
            attempt,
            ...(lastError ? { previousError: lastError } : {}),
            allowedDomains: Object.keys(DOMAIN_CHANNEL_MAP),
            strictChannelMap: DOMAIN_CHANNEL_MAP,
            message: input.message,
          },
          null,
          2
        ),
      },
    ],
    parse: (raw) => {
      const parsed = parseRequestManagerContract(raw);
      const expectedChannel = DOMAIN_CHANNEL_MAP[parsed.domain];
      if (parsed.channel !== expectedChannel) {
        throw new ContractValidationError(
          `Channel/domain mismatch: domain ${parsed.domain} requires channel ${expectedChannel}`
        );
      }

      return parsed;
    },
  });

  return {
    classification: result.output,
    traces: result.traces,
  };
}
