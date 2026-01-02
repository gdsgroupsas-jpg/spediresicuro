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

export interface UserContext {
  userId: string;
  userRole: 'admin' | 'user';
  userName: string;
  recentShipments: any[];
  walletBalance?: number; // ⚠️ NUOVO: Wallet balance
  monthlyStats?: {
    totalShipments: number;
    totalRevenue: number;
    totalMargin: number;
    avgMargin: number;
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
  userRole: 'admin' | 'user',
  userName: string
): Promise<{
  user: UserContext;
  system?: SystemContext;
  business?: BusinessContext;
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
    // 0. Recupera wallet_balance dell'utente
    try {
      const { data: userData, error: walletError } = await supabaseAdmin
        .from('users')
        .select('wallet_balance')
        .eq('id', userId)
        .single();
      
      if (!walletError && userData) {
        context.user.walletBalance = parseFloat(userData.wallet_balance || '0') || 0;
      }
    } catch (walletErr: any) {
      console.warn('⚠️ [ContextBuilder] Errore recupero wallet_balance (non critico):', walletErr.message);
      // Continua anche se il wallet fallisce
    }
    
    // 1. Recupera spedizioni recenti dell'utente (ultime 10)
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!shipmentsError && shipments) {
      context.user.recentShipments = shipments.map(s => ({
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
    
    // 2. Se admin, aggiungi statistiche business
    if (userRole === 'admin') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Statistiche mese corrente
      const { data: monthlyData, error: monthlyError } = await supabaseAdmin
        .from('shipments')
        .select('final_price, base_price, created_at')
        .gte('created_at', monthStart.toISOString());
      
      if (!monthlyError && monthlyData) {
        const totalRevenue = monthlyData.reduce((sum, s) => sum + (parseFloat(s.final_price) || 0), 0);
        const totalCost = monthlyData.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0);
        const totalMargin = totalRevenue - totalCost;
        const avgMargin = monthlyData.length > 0 ? totalMargin / monthlyData.length : 0;
        
        context.user.monthlyStats = {
          totalShipments: monthlyData.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          avgMargin: Math.round(avgMargin * 100) / 100,
        };
        
        // Top corrieri
        const { data: courierStats } = await supabaseAdmin
          .from('shipments')
          .select('carrier, final_price')
          .gte('created_at', monthStart.toISOString());
        
        if (courierStats) {
          const courierMap = new Map<string, { shipments: number; revenue: number }>();
          courierStats.forEach(s => {
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
      
      // Errori di sistema recenti (ultime 24h)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { data: errors, error: errorsError } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .in('severity', ['error', 'critical'])
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      
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
}): string {
  let prompt = `**CONTESTO UTENTE:**\n`;
  prompt += `- Nome: ${context.user.userName}\n`;
  prompt += `- Ruolo: ${context.user.userRole}\n`;
  
  // ⚠️ NUOVO: Mostra wallet balance se disponibile
  if (context.user.walletBalance !== undefined) {
    prompt += `- Saldo Wallet: €${context.user.walletBalance.toFixed(2)}\n`;
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
  
  return prompt;
}

