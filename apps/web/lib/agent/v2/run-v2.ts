import type {
  AnneOrchestratorInput,
  AnneOrchestratorOutput,
  OrchestratorLogger,
} from '@ss/domain-ai';
import { runAnneOrchestratorV2 } from '@ss/domain-ai';
import { buildOllamaRoleClient } from './ollama-role-client';
import { buildAnneV2Dependencies } from './business-tool-executor';

const logger: OrchestratorLogger = {
  log(message, metadata) {
    console.log(`[ANNE_V3] ${message}`, metadata || {});
  },
  warn(message, metadata) {
    console.warn(`[ANNE_V3] ${message}`, metadata || {});
  },
  error(message, metadata) {
    console.error(`[ANNE_V3] ${message}`, metadata || {});
  },
};

export async function runAnneV2(input: AnneOrchestratorInput): Promise<AnneOrchestratorOutput> {
  const llm = buildOllamaRoleClient();
  const deps = buildAnneV2Dependencies(llm, logger);
  return runAnneOrchestratorV2(input, deps);
}
