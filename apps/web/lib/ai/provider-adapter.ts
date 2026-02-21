/**
 * AI Provider Adapter
 *
 * Astrazione per supportare multiple AI providers (Anthropic, DeepSeek, etc.)
 * Pattern Adapter per isolare la logica specifica di ogni provider
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export type AIProvider = 'anthropic' | 'deepseek' | 'gemini';
export type AIModel = string;

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AITool {
  name: string;
  description: string;
  input_schema: any;
}

export interface AIResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
  }>;
  model?: string;
  provider?: AIProvider;
}

export interface AIClient {
  chat(params: {
    model: AIModel;
    messages: AIMessage[];
    system?: string;
    tools?: AITool[];
    maxTokens?: number;
  }): Promise<AIResponse>;
}

/**
 * Anthropic Client Adapter
 */
export class AnthropicClient implements AIClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params: {
    model: AIModel;
    messages: AIMessage[];
    system?: string;
    tools?: AITool[];
    maxTokens?: number;
  }): Promise<AIResponse> {
    // Converte messaggi nel formato Anthropic
    const anthropicMessages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Formatta tools per Anthropic
    const anthropicTools = params.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      system: params.system,
      messages: anthropicMessages as any,
      tools: anthropicTools,
    });

    // Estrae contenuto e tool calls
    let content = '';
    const toolCalls: Array<{ name: string; arguments: any }> = [];

    if (response.content && Array.isArray(response.content)) {
      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            name: block.name,
            arguments: block.input,
          });
        }
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: params.model,
      provider: 'anthropic',
    };
  }
}

/**
 * DeepSeek Client Adapter (API compatibile OpenAI)
 */
export class DeepSeekClient implements AIClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(params: {
    model: AIModel;
    messages: AIMessage[];
    system?: string;
    tools?: AITool[];
    maxTokens?: number;
  }): Promise<AIResponse> {
    // DeepSeek usa formato OpenAI-compatible
    const openaiMessages = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Aggiungi system message se presente
    if (params.system) {
      openaiMessages.unshift({
        role: 'system',
        content: params.system,
      });
    }

    // Formatta tools per OpenAI format (DeepSeek compatibile)
    const openaiTools = params.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || 'deepseek-chat',
        messages: openaiMessages,
        tools: openaiTools && openaiTools.length > 0 ? openaiTools : undefined,
        max_tokens: params.maxTokens || 4096,
        temperature: 0.7, // Default temperature per DeepSeek
      }),
    });

    if (!response.ok) {
      let errorMessage = `DeepSeek API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Estrae contenuto e tool calls
    let content = '';
    const toolCalls: Array<{ name: string; arguments: any }> = [];

    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      const message = choice.message;

      if (message.content) {
        content = message.content;
      }

      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function) {
            // DeepSeek/OpenAI: arguments può essere stringa JSON o oggetto
            let parsedArgs: any = {};
            try {
              if (typeof toolCall.function.arguments === 'string') {
                parsedArgs = JSON.parse(toolCall.function.arguments);
              } else if (typeof toolCall.function.arguments === 'object') {
                parsedArgs = toolCall.function.arguments;
              }
            } catch (parseError) {
              console.warn('Errore parsing tool arguments:', parseError);
              parsedArgs = {};
            }

            toolCalls.push({
              name: toolCall.function.name,
              arguments: parsedArgs,
            });
          }
        }
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model || params.model,
      provider: 'deepseek',
    };
  }
}

/**
 * Gemini Client Adapter (Google Generative AI)
 */
export class GeminiClient implements AIClient {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async chat(params: {
    model: AIModel;
    messages: AIMessage[];
    system?: string;
    tools?: AITool[];
    maxTokens?: number;
  }): Promise<AIResponse> {
    const genModel = this.client.getGenerativeModel({
      model: params.model || this.model,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: 0.7,
      },
      systemInstruction: params.system || undefined,
    });

    // Converte messaggi per Gemini
    // Gemini usa formato: contents array con role e parts
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Converte messaggi conversazione (escludi system, gestito via systemInstruction)
    for (const msg of params.messages) {
      if (msg.role === 'system') {
        // System già gestito via systemInstruction
        continue;
      }

      // Gemini usa 'user' e 'model' (non 'assistant')
      const geminiRole = msg.role === 'user' ? 'user' : 'model';
      contents.push({
        role: geminiRole,
        parts: [{ text: msg.content }],
      });
    }

    // Formatta tools per Gemini (Function Calling)
    const tools =
      params.tools && params.tools.length > 0
        ? [
            {
              functionDeclarations: params.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: {
                  type: SchemaType.OBJECT,
                  properties: tool.input_schema.properties || {},
                  required: tool.input_schema.required || [],
                },
              })),
            },
          ]
        : undefined;

    try {
      const result = await genModel.generateContent({
        contents,
        tools,
      });

      const response = result.response;

      // Gestione robusta di response.text() - può lanciare eccezione se ci sono solo tool calls
      let text = '';
      try {
        text = response.text();
      } catch (textError) {
        console.warn('[Gemini] No text in response (tool calls only?)', textError);
        // Continua comunque, potrebbe esserci solo tool call
      }

      // Estrae tool calls se presenti
      const toolCalls: Array<{ name: string; arguments: any }> = [];

      // functionCalls() è una funzione che ritorna FunctionCall[]
      const functionCalls = response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        for (const funcCall of functionCalls) {
          toolCalls.push({
            name: funcCall.name,
            arguments: funcCall.args || {},
          });
        }
      }

      return {
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: params.model || this.model,
        provider: 'gemini',
      };
    } catch (error: any) {
      let errorMessage = `Gemini API error: ${error.message || 'Unknown error'}`;
      if (error.status) {
        errorMessage += ` (status: ${error.status})`;
      }
      throw new Error(errorMessage);
    }
  }
}

/**
 * Factory per creare il client AI corretto
 */
export async function createAIClient(
  provider: AIProvider,
  apiKey: string,
  model?: string
): Promise<AIClient> {
  switch (provider) {
    case 'anthropic':
      return new AnthropicClient(apiKey);
    case 'deepseek':
      return new DeepSeekClient(apiKey);
    case 'gemini':
      return new GeminiClient(apiKey, model);
    default:
      throw new Error(`Provider AI non supportato: ${provider}`);
  }
}

/**
 * Ottiene il provider AI configurato dal database
 */
export async function getConfiguredAIProvider(): Promise<{
  provider: AIProvider;
  model: AIModel;
}> {
  const { supabaseAdmin } = await import('@/lib/db/client');

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'ai_provider')
    .single();

  if (error || !data) {
    // Fallback a Anthropic se non configurato
    return {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
    };
  }

  const value = data.setting_value as any;
  const provider = (value.provider || 'anthropic') as AIProvider;

  // Determina model default basato su provider
  let defaultModel: string;
  switch (provider) {
    case 'deepseek':
      defaultModel = 'deepseek-chat';
      break;
    case 'gemini':
      defaultModel = 'gemini-2.0-flash-exp';
      break;
    default:
      defaultModel = 'claude-3-haiku-20240307';
  }

  return {
    provider,
    model: value.model || defaultModel,
  };
}

/**
 * Ottiene l'API key per il provider specificato
 */
export function getAPIKeyForProvider(provider: AIProvider): string | undefined {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY;
    case 'gemini':
      return process.env.GOOGLE_API_KEY;
    default:
      return undefined;
  }
}
