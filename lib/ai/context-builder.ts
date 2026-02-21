/**
 * Context Builder per Anne
 *
 * Costruisce il contesto operativo per Anne basandosi su:
 * - Dati utente (ruolo, spedizioni recenti)
 * - Dati business (statistiche, margini)
 * - Errori di sistema recenti
 * - Performance corrieri
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import {
  getPipelineSummary,
  getHotEntities,
  getHealthAlerts,
  getPendingQuotes,
} from '@/lib/crm/crm-data-service';
import type { CrmContext } from '@/types/crm-intelligence';
import { getUserMemory, type UserMemory } from '@/lib/ai/user-memory';

export interface UserContext {
  userId: string;
  userRole: 'admin' | 'user' | 'reseller';
  userName: string;
  recentShipments: any[];
  walletBalance?: number;
  monthlyStats?: {
    totalShipments: number;
    totalRevenue: number;
    totalMargin: number;
    avgMargin: number;
  };
  memory?: {
    defaultSender?: UserMemory['defaultSender'];
    preferredCouriers?: string[];
    communicationStyle?: UserMemory['communicationStyle'];
    notes?: string;
  };
}

export interface SystemContext {
  recentErrors: any[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
  lastSyncTime?: string;
}

export interface BusinessContext {
  monthlyRevenue: number;
  monthlyMargin: number;
  topCouriers: Array<{ name: string; shipments: number; revenue: number }>;
  recentTrends: string[];
}

/**
 * Costruisce contesto completo per Anne
 */
export async function buildContext(
  userId: string,
  userRole: 'admin' | 'user' | 'reseller',
  userName: string,
  workspaceId?: string
): Promise<{
  user: UserContext;
  system?: SystemContext;
  business?: BusinessContext;
  crm?: CrmContext;
}> {
  const context: any = {
    user: {
      userId,
      userRole,
      userName,
      recentShipments: [],
      walletBalance: 0, // ⚠️ NUOVO: Wallet balance
    },
  };

  try {
    // 0. Recupera wallet_balance v2 (da workspaces, source of truth)
    try {
      if (workspaceId) {
        const { data: wsData, error: walletError } = await supabaseAdmin
          .from('workspaces')
          .select('wallet_balance')
          .eq('id', workspaceId)
          .single();

        if (!walletError && wsData) {
          context.user.walletBalance = parseFloat(wsData.wallet_balance || '0') || 0;
        }
      } else {
        // Fallback: nessun workspace disponibile, saldo non mostrato
        context.user.walletBalance = 0;
      }
    } catch (walletErr: any) {
      console.warn(
        '⚠️ [ContextBuilder] Errore recupero wallet_balance (non critico):',
        walletErr.message
      );
      // Continua anche se il wallet fallisce
    }

    // 0.5. Recupera memoria utente (user-scoped, non workspace-scoped)
    // communicationStyle e' globale utente, preferredCouriers personali
    try {
      const memory = await getUserMemory(userId);
      if (memory) {
        context.user.memory = {
          defaultSender: memory.defaultSender,
          preferredCouriers: memory.preferredCouriers,
          communicationStyle: memory.communicationStyle,
          notes: memory.notes,
        };
      }
    } catch {
      // Non critico — non rompere buildContext per errore memory
    }

    // 1. Recupera spedizioni recenti dell'utente (ultime 10, workspace-scoped)
    const ctxDb = workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin;
    const { data: shipments, error: shipmentsError } = (await ctxDb
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)) as { data: any[] | null; error: any };

    if (!shipmentsError && shipments) {
      context.user.recentShipments = shipments.map((s) => ({
        id: s.id,
        tracking: s.tracking_number,
        recipient: s.recipient_name,
        city: s.recipient_city,
        status: s.status,
        price: s.final_price,
        weight: s.weight,
        createdAt: s.created_at,
      }));
    }

    // 2. Se admin o reseller, aggiungi statistiche business (workspace-scoped)
    if (userRole === 'admin' || userRole === 'reseller') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Statistiche mese corrente (workspace-scoped)
      const statsDb = workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin;
      const { data: monthlyData, error: monthlyError } = (await statsDb
        .from('shipments')
        .select('final_price, base_price, created_at')
        .gte('created_at', monthStart.toISOString())) as { data: any[] | null; error: any };

      if (!monthlyError && monthlyData) {
        const totalRevenue = monthlyData.reduce(
          (sum, s) => sum + (parseFloat(s.final_price) || 0),
          0
        );
        const totalCost = monthlyData.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0);
        const totalMargin = totalRevenue - totalCost;
        const avgMargin = monthlyData.length > 0 ? totalMargin / monthlyData.length : 0;

        context.user.monthlyStats = {
          totalShipments: monthlyData.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          avgMargin: Math.round(avgMargin * 100) / 100,
        };

        // Top corrieri (workspace-scoped)
        const { data: courierStats } = (await statsDb
          .from('shipments')
          .select('carrier, final_price')
          .gte('created_at', monthStart.toISOString())) as { data: any[] | null };

        if (courierStats) {
          const courierMap = new Map<string, { shipments: number; revenue: number }>();
          courierStats.forEach((s) => {
            const carrier = s.carrier || 'Sconosciuto';
            const existing = courierMap.get(carrier) || { shipments: 0, revenue: 0 };
            courierMap.set(carrier, {
              shipments: existing.shipments + 1,
              revenue: existing.revenue + (parseFloat(s.final_price) || 0),
            });
          });

          context.business = {
            monthlyRevenue: totalRevenue,
            monthlyMargin: totalMargin,
            topCouriers: Array.from(courierMap.entries())
              .map(([name, data]) => ({ name, ...data }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5),
            recentTrends: [],
          };
        }
      }

      // Statistiche contrassegni (COD)
      try {
        const codDb = workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin;
        const { data: codStats } = await codDb.from('cod_items').select('status, pagato');

        if (codStats && codStats.length > 0) {
          const inAttesa = codStats.filter((c: any) => c.status === 'in_attesa');
          const assegnati = codStats.filter((c: any) => c.status === 'assegnato');
          const rimborsati = codStats.filter((c: any) => c.status === 'rimborsato');
          const totalDaPagare = assegnati.reduce((s: number, c: any) => s + (c.pagato || 0), 0);

          (context as any).codStats = {
            totale: codStats.length,
            inAttesa: inAttesa.length,
            assegnati: assegnati.length,
            rimborsati: rimborsati.length,
            totaleDaPagare: Math.round(totalDaPagare * 100) / 100,
          };
        }
      } catch {
        // Non critico
      }

      // Errori di sistema recenti (ultime 24h, workspace-scoped)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const logsDb = workspaceId ? workspaceQuery(workspaceId) : supabaseAdmin;
      const { data: errors, error: errorsError } = (await logsDb
        .from('audit_logs')
        .select('*')
        .in('severity', ['error', 'critical'])
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)) as { data: any[] | null; error: any };

      if (!errorsError && errors) {
        const criticalCount = errors.filter((e: any) => e.severity === 'critical').length;
        context.system = {
          recentErrors: errors.map((e: any) => ({
            severity: e.severity,
            message: e.message,
            timestamp: e.created_at,
          })),
          systemHealth: criticalCount > 0 ? 'critical' : errors.length > 5 ? 'degraded' : 'healthy',
        };
      }
    }
    // 3. CRM Context (per admin e reseller)
    try {
      const summary = await getPipelineSummary(userRole, workspaceId);
      const hot = await getHotEntities(userRole, workspaceId, 3);
      const alerts = await getHealthAlerts(userRole, workspaceId);

      const crmCtx: CrmContext = {
        entityType: userRole === 'admin' ? 'leads' : 'prospects',
        pipelineSummary: summary,
        hotCount: hot.length,
        staleCount: alerts.filter((a) => a.type.includes('stale') || a.type.includes('cold'))
          .length,
        alertCount: alerts.length,
        topActions: alerts.slice(0, 3).map((a) => a.message),
      };

      // Preventivi in attesa (solo reseller)
      if (userRole !== 'admin' && workspaceId) {
        const quotes = await getPendingQuotes(workspaceId);
        crmCtx.pendingQuotesCount = quotes.length;
      }

      context.crm = crmCtx;
    } catch (crmErr: any) {
      console.warn('⚠️ [ContextBuilder] Errore CRM context (non critico):', crmErr?.message);
    }
  } catch (error: any) {
    console.error('Errore costruzione contesto:', error);
    // Continua anche in caso di errore parziale
  }

  return context;
}

/**
 * Formatta contesto in stringa leggibile per Anne
 */
export function formatContextForPrompt(context: {
  user: UserContext;
  system?: SystemContext;
  business?: BusinessContext;
  crm?: CrmContext;
}): string {
  let prompt = `**CONTESTO UTENTE:**\n`;
  prompt += `- Nome: ${context.user.userName}\n`;
  prompt += `- Ruolo: ${context.user.userRole}\n`;

  // ⚠️ NUOVO: Mostra wallet balance se disponibile
  if (context.user.walletBalance !== undefined) {
    prompt += `- Saldo Wallet: €${context.user.walletBalance.toFixed(2)}\n`;
  }

  // Preferenze utente da memory
  if (context.user.memory) {
    const mem = context.user.memory;
    const memParts: string[] = [];

    if (mem.defaultSender?.name) {
      const senderParts = [mem.defaultSender.name];
      if (mem.defaultSender.city) senderParts.push(mem.defaultSender.city);
      memParts.push(`- Mittente predefinito: ${senderParts.join(', ')}`);
    }

    if (mem.preferredCouriers && mem.preferredCouriers.length > 0) {
      memParts.push(`- Corrieri preferiti: ${mem.preferredCouriers.join(', ')}`);
    }

    if (mem.notes) {
      memParts.push(`- Note: ${mem.notes}`);
    }

    if (memParts.length > 0) {
      prompt += `\n**PREFERENZE UTENTE:**\n${memParts.join('\n')}\n`;
    }
  }

  if (context.user.recentShipments.length > 0) {
    prompt += `\n**SPEDIZIONI RECENTI (${context.user.recentShipments.length}):**\n`;
    context.user.recentShipments.slice(0, 5).forEach((s, i) => {
      prompt += `${i + 1}. ${s.tracking} - ${s.recipient} (${s.city}) - ${s.status} - €${s.price || 'N/A'}\n`;
    });
  }

  if (context.user.monthlyStats) {
    prompt += `\n**STATISTICHE MESE CORRENTE:**\n`;
    prompt += `- Spedizioni totali: ${context.user.monthlyStats.totalShipments}\n`;
    prompt += `- Fatturato: €${context.user.monthlyStats.totalRevenue.toFixed(2)}\n`;
    prompt += `- Margine totale: €${context.user.monthlyStats.totalMargin.toFixed(2)}\n`;
    prompt += `- Margine medio: €${context.user.monthlyStats.avgMargin.toFixed(2)}\n`;
  }

  if (context.business?.topCouriers && context.business.topCouriers.length > 0) {
    prompt += `\n**TOP CORRIERI (mese corrente):**\n`;
    context.business.topCouriers.forEach((c, i) => {
      prompt += `${i + 1}. ${c.name}: ${c.shipments} spedizioni, €${c.revenue.toFixed(2)}\n`;
    });
  }

  if ((context as any).codStats) {
    const cod = (context as any).codStats;
    prompt += `\n**CONTRASSEGNI (COD):**\n`;
    prompt += `- Totale: ${cod.totale} (${cod.inAttesa} in attesa, ${cod.assegnati} assegnati, ${cod.rimborsati} rimborsati)\n`;
    prompt += `- Da pagare ai clienti: €${cod.totaleDaPagare.toFixed(2)}\n`;
  }

  if (context.system) {
    prompt += `\n**STATO SISTEMA:**\n`;
    prompt += `- Salute: ${context.system.systemHealth}\n`;
    if (context.system.recentErrors.length > 0) {
      prompt += `- Errori recenti (24h): ${context.system.recentErrors.length}\n`;
      if (context.system.recentErrors.length <= 3) {
        context.system.recentErrors.forEach((e, i) => {
          prompt += `  ${i + 1}. [${e.severity}] ${e.message}\n`;
        });
      }
    }
  }

  // CRM Pipeline Context
  if (context.crm) {
    const crm = context.crm;
    const label = crm.entityType === 'leads' ? 'PIPELINE LEAD' : 'PIPELINE PROSPECT';
    prompt += `\n**${label}:**\n`;

    const statusEntries = Object.entries(crm.pipelineSummary.byStatus);
    if (statusEntries.length > 0) {
      const statusLine = statusEntries.map(([s, c]) => `${c} ${s}`).join(', ');
      prompt += `- Totale: ${crm.pipelineSummary.total} (${statusLine})\n`;
    }
    prompt += `- Score medio: ${crm.pipelineSummary.avgScore} | Valore pipeline: €${crm.pipelineSummary.pipelineValue}\n`;

    if (crm.hotCount > 0) {
      prompt += `- ${crm.hotCount} entita calde (score>=70) che richiedono attenzione\n`;
    }
    if (crm.alertCount > 0) {
      prompt += `- ${crm.alertCount} alert attivi\n`;
      for (const action of crm.topActions) {
        prompt += `  - ${action}\n`;
      }
    }
    if (crm.pendingQuotesCount != null && crm.pendingQuotesCount > 0) {
      prompt += `- ${crm.pendingQuotesCount} preventivi in attesa di risposta\n`;
    }
  }

  return prompt;
}
