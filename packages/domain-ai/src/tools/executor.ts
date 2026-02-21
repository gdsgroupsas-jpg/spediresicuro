import type {
  AnneToolExecutor,
  ToolCall,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolSpec,
} from '../types/index';

type ToolHandler = (call: ToolCall, context: ToolExecutionContext) => Promise<ToolExecutionResult>;

export function createToolExecutor(catalog: ToolSpec[], handler: ToolHandler): AnneToolExecutor {
  return {
    catalog,
    execute(call, context) {
      return handler(call, context);
    },
  };
}


