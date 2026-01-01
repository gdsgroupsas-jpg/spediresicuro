/**
 * AgentTool Registry
 * 
 * Registry centralizzato per unificare tools sparsi.
 * Auto-discovery e validazione input/output con Zod.
 * 
 * P3 Task 4: Unificazione Tools
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// ==================== INTERFACCIA TOOL ====================

export interface AgentTool {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  execute: (args: any, context: ToolExecutionContext) => Promise<string>;
  requiredRole?: 'user' | 'admin' | 'superadmin'; // Controllo accesso
}

export interface ToolExecutionContext {
  userId: string;
  userRole: string;
  actingContext?: any; // ActingContext per impersonation
}

// ==================== REGISTRY ====================

export class AgentToolRegistry {
  private tools = new Map<string, AgentTool>();

  /**
   * Registra un tool nel registry.
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} già registrato`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Recupera tool per nome.
   */
  get(name: string): AgentTool | null {
    return this.tools.get(name) || null;
  }

  /**
   * Lista tutti i tools registrati.
   */
  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Converte tool in DynamicStructuredTool (LangChain).
   */
  toLangChainTool(tool: AgentTool): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
      func: async (args: any) => {
        // Validazione schema è automatica da LangChain
        // Esecuzione tool
        const context: ToolExecutionContext = {
          userId: '', // Sarà iniettato dal caller
          userRole: 'user',
        };
        return await tool.execute(args, context);
      },
    });
  }

  /**
   * Lista tools come DynamicStructuredTool[] per LangChain.
   */
  toLangChainTools(context: ToolExecutionContext): DynamicStructuredTool[] {
    return this.list()
      .filter(tool => {
        // Filtra per ruolo se necessario
        if (tool.requiredRole) {
          if (tool.requiredRole === 'superadmin' && context.userRole !== 'superadmin') {
            return false;
          }
          if (tool.requiredRole === 'admin' && context.userRole !== 'admin' && context.userRole !== 'superadmin') {
            return false;
          }
        }
        return true;
      })
      .map(tool => {
        return new DynamicStructuredTool({
          name: tool.name,
          description: tool.description,
          schema: tool.schema,
          func: async (args: any) => {
            return await tool.execute(args, context);
          },
        });
      });
  }
}

// ==================== SINGLETON ====================

/**
 * Registry globale (singleton).
 */
export const toolRegistry = new AgentToolRegistry();

