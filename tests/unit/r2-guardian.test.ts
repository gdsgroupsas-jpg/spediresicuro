/**
 * Guardian test R2: Verifica strutturale delle feature R2
 *
 * Se qualcuno rimuove accidentalmente una feature R2, questo test fallisce.
 * 6 test strutturali che verificano l'integrità del codice.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

describe('R2 Guardian — structural integrity', () => {
  it('active_delegation definito in AgentState', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/agent/orchestrator/state.ts'), 'utf8');
    expect(content).toContain('active_delegation');
    expect(content).toContain('DelegationContext');
  });

  it('delegation_info in sanitizeAgentStateForClient', () => {
    const content = fs.readFileSync(path.join(ROOT, 'app/api/ai/agent-chat/route.ts'), 'utf8');
    expect(content).toContain('delegation_info');
    // Privacy: NON espone subClientUserId
    const delegationBlock = content.match(/delegation_info:[\s\S]*?(?=\/\/ NO:|^\s*\};)/m);
    if (delegationBlock) {
      expect(delegationBlock[0]).not.toContain('subClientUserId');
    }
  });

  it('one_shot_eligible e one_shot_courier in AgentState', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/agent/orchestrator/state.ts'), 'utf8');
    expect(content).toContain('one_shot_eligible');
    expect(content).toContain('one_shot_courier');
  });

  it('detectEndDelegationIntent esportato da intent-detector', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/agent/intent-detector.ts'), 'utf8');
    expect(content).toContain('export function detectEndDelegationIntent');
  });

  it('extractDelegationTarget applica NFC', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/agent/intent-detector.ts'), 'utf8');
    // Verifica che .normalize('NFC') appare nella funzione extractDelegationTarget
    const fnBlock = content.match(/extractDelegationTarget[\s\S]*?return null;\s*\}/);
    expect(fnBlock).toBeTruthy();
    expect(fnBlock![0]).toContain("normalize('NFC')");
  });

  it('context-builder NON usa supabaseAdmin su cod_items/audit_logs senza guard workspaceId', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/ai/context-builder.ts'), 'utf8');

    // Verifica che NON esiste il pattern "workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin"
    // per tabelle WORKSPACE_SCOPED (cod_items, audit_logs)
    // Il pattern corretto è: if (workspaceId) { const db = workspaceQuery(workspaceId); ... }
    const ternaryFallbackPattern =
      /workspaceId\s*\?\s*workspaceQuery\(workspaceId\)\s*:\s*supabaseAdmin/g;
    const matches = content.match(ternaryFallbackPattern);

    // Nessun ternario fallback deve esistere per tabelle multi-tenant
    expect(matches).toBeNull();
  });

  it('agent-chat/route.ts NON usa ternario pericoloso su audit_logs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'app/api/ai/agent-chat/route.ts'), 'utf8');

    // Verifica che NON esiste "wsId ? workspaceQuery(wsId) : supabaseAdmin"
    // audit_logs è WORKSPACE_SCOPED — deve usare workspaceQuery con fail-closed
    const ternaryPattern = /wsId\s*\?\s*workspaceQuery\(wsId\)\s*:\s*supabaseAdmin/g;
    const matches = content.match(ternaryPattern);

    expect(matches).toBeNull();
  });
});
