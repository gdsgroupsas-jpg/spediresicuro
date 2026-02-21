export type AnneOrchestratorMode = 'shadow' | 'canary' | 'v2';

function normalizeMode(value: string | undefined): AnneOrchestratorMode {
  const normalized = (value || 'v2').trim().toLowerCase();
  if (normalized === 'shadow' || normalized === 'canary' || normalized === 'v2') {
    return normalized;
  }
  return 'v2';
}

function hashStringToPercent(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100);
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function getAnneOrchestratorMode(): AnneOrchestratorMode {
  return normalizeMode(process.env.ANNE_ORCHESTRATOR_MODE);
}

export function isWorkspaceCanary(workspaceId: string | undefined): boolean {
  if (!workspaceId) return false;
  const allowlist = parseAllowlist(process.env.ANNE_ORCHESTRATOR_CANARY_WORKSPACES);
  if (allowlist.size === 0) return false;
  return allowlist.has(workspaceId);
}

export function isCanaryPercentEnabled(userId: string): boolean {
  const raw = process.env.ANNE_ORCHESTRATOR_CANARY_PERCENT;
  const percent = Number(raw || 0);
  if (!Number.isFinite(percent) || percent <= 0) return false;
  if (percent >= 100) return true;
  return hashStringToPercent(userId) < percent;
}

export function shouldUseV2(
  mode: AnneOrchestratorMode,
  input: { userId: string; workspaceId?: string }
): boolean {
  if (mode === 'v2') return true;
  if (mode === 'shadow') return false;
  return isWorkspaceCanary(input.workspaceId) || isCanaryPercentEnabled(input.userId);
}
