import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runLocalCopilot } from '@/lib/agent/copilot/executor';

vi.mock('@/lib/agent/copilot/llm-client', () => ({
  chatWithLocalLLM: vi.fn(),
}));

vi.mock('@/lib/ai/tools', () => ({
  ANNE_TOOLS: [
    { name: 'fill_shipment_form', parameters: { required: [] } },
    { name: 'calculate_price', parameters: { required: [] } },
    { name: 'track_shipment', parameters: { required: [] } },
    { name: 'update_user_memory', parameters: { required: [] } },
    { name: 'create_batch_shipments', parameters: { required: [] } },
    { name: 'analyze_business_health', parameters: { required: [] } },
    { name: 'check_error_logs', parameters: { required: [] } },
  ],
  executeTool: vi.fn(),
}));

vi.mock('@/lib/security/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

import { chatWithLocalLLM } from '@/lib/agent/copilot/llm-client';
import { executeTool } from '@/lib/ai/tools';
import { writeAuditLog } from '@/lib/security/audit-log';

const actingContext: any = {
  actor: { id: 'actor-1', email: 'actor@test.com' },
  target: { id: 'user-1', email: 'user@test.com', role: 'user' },
  isImpersonating: false,
  metadata: { requestId: 'req-1' },
};

describe('runLocalCopilot guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unknown tool and writes audit log', async () => {
    (chatWithLocalLLM as any).mockResolvedValueOnce({
      content: JSON.stringify({
        status: 'ok',
        message: 'ok',
        tool_calls: [{ name: 'unknown_tool', arguments: {} }],
        confidence: 0.7,
      }),
    });

    const result = await runLocalCopilot({
      message: 'fai qualcosa',
      history: [],
      userId: 'user-1',
      userRole: 'user',
      isAdmin: false,
      actingContext,
    });

    expect(result.status).toBe('handled');
    expect(result.message).toMatch(/strumenti autorizzati/i);
    expect(writeAuditLog).toHaveBeenCalledOnce();
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('rejects denylisted categories and writes audit log', async () => {
    (chatWithLocalLLM as any).mockResolvedValueOnce({
      content: JSON.stringify({
        status: 'ok',
        message: 'ok',
        tool_calls: [{ name: 'analyze_business_health', arguments: {} }],
        confidence: 0.8,
      }),
    });

    const result = await runLocalCopilot({
      message: 'analizza business',
      history: [],
      userId: 'user-1',
      userRole: 'admin',
      isAdmin: true,
      actingContext,
    });

    expect(result.status).toBe('handled');
    expect(result.message).toMatch(/non è disponibile nel copilot locale/i);
    expect(writeAuditLog).toHaveBeenCalledOnce();
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('rejects too many tool calls and writes audit log', async () => {
    (chatWithLocalLLM as any).mockResolvedValueOnce({
      content: JSON.stringify({
        status: 'ok',
        message: 'ok',
        tool_calls: [
          { name: 'fill_shipment_form', arguments: {} },
          { name: 'calculate_price', arguments: {} },
          { name: 'track_shipment', arguments: {} },
          { name: 'update_user_memory', arguments: {} },
        ],
        confidence: 0.6,
      }),
    });

    const result = await runLocalCopilot({
      message: 'esegui tutto',
      history: [],
      userId: 'user-1',
      userRole: 'user',
      isAdmin: false,
      actingContext,
    });

    expect(result.status).toBe('handled');
    expect(result.message).toMatch(/una sola operazione/i);
    expect(writeAuditLog).toHaveBeenCalledOnce();
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('executes allowed tool and follows up', async () => {
    (chatWithLocalLLM as any)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          status: 'ok',
          message: 'ok',
          tool_calls: [{ name: 'fill_shipment_form', arguments: { recipient_name: 'Mario' } }],
          confidence: 0.9,
        }),
      })
      .mockResolvedValueOnce({
        content: 'Tool eseguito con successo.',
      });

    (executeTool as any).mockResolvedValueOnce({
      success: true,
      result: { formData: { recipient_name: 'Mario' } },
    });

    const result = await runLocalCopilot({
      message: 'crea spedizione per Mario',
      history: [],
      userId: 'user-1',
      userRole: 'user',
      isAdmin: false,
      actingContext,
    });

    expect(result.status).toBe('handled');
    expect(result.message).toMatch(/Tool eseguito/i);
    expect(executeTool).toHaveBeenCalledOnce();
  });
});
