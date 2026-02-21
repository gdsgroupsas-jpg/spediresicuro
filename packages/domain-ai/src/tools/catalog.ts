import type { ToolSpec } from '../types/index';

export const CORE_TOOL_CATALOG: ToolSpec[] = [];

export function buildDefaultToolCatalog(extraTools: ToolSpec[] = []): ToolSpec[] {
  return [...CORE_TOOL_CATALOG, ...extraTools];
}

export function getToolByName(catalog: ToolSpec[], name: string): ToolSpec | null {
  return catalog.find((tool) => tool.name === name) || null;
}
