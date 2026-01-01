/**
 * Agent Tools - Index
 * 
 * Export centralizzato per tutti i tools.
 * Auto-registration di tools da vari moduli.
 * 
 * P3 Task 4: Unificazione Tools
 */

export { AgentToolRegistry, toolRegistry, type AgentTool, type ToolExecutionContext } from './registry';

// Tools verranno registrati qui quando creati
// Per ora, manteniamo compatibilità con tools esistenti

// Re-export tools esistenti per compatibilità
export { createFiscalTools } from '../tools';

