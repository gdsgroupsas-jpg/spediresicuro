import type { AnneRoleLlm, ModelRole } from '@ss/domain-ai';
import { resolveDomainRoleModel } from '@ss/domain-ai';
import { chatWithOllama } from '@/lib/ai/ollama';

export function buildOllamaRoleClient(): AnneRoleLlm {
  return {
    async chat(role: ModelRole, messages, options) {
      const response = await chatWithOllama({
        messages,
        model: options?.model || resolveDomainRoleModel(options?.domain, role),
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
      return response;
    },
  };
}
