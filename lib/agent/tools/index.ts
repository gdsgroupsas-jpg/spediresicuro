/**
 * Agent Tools - Index
 *
 * Export centralizzato per tutti i tools.
 * Auto-registration di tools da vari moduli.
 *
 * P3 Task 4: Unificazione Tools
 */

import {
  assignPriceListTool,
  clonePriceListTool,
  searchMasterPriceListsTool,
} from "./price-list-tools";
import { toolRegistry } from "./registry";

export {
  AgentToolRegistry,
  toolRegistry,
  type AgentTool,
  type ToolExecutionContext,
} from "./registry";

// Re-export specific tools
export * from "./price-list-tools";

// Registration
toolRegistry.register(searchMasterPriceListsTool);
toolRegistry.register(clonePriceListTool);
toolRegistry.register(assignPriceListTool);

// Re-export tools esistenti per compatibilità
export { createFiscalTools } from "../tools";
