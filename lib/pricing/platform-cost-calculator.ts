/**
 * Platform Cost Calculator
 * 
 * Determina:
 * 1. api_source - quale contratto è stato usato (platform, reseller_own, byoc_own)
 * 2. provider_cost - quanto SpedireSicuro paga effettivamente al corriere
 * 
 * @module lib/pricing/platform-cost-calculator
 * @since Sprint 1 - Financial Tracking
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ApiSource, CostSource } from '@/lib/shipments/platform-cost-recorder';

export interface DetermineApiSourceParams {
  userId: string;
  priceListId?: string;
  courierCode?: string;
}

export interface DetermineApiSourceResult {
  apiSource: ApiSource;
  masterPriceListId?: string;
  priceListId?: string;
  reason: string;
}

/**
 * Determina quale fonte API è stata usata per una spedizione.
 * 
 * Logica:
 * 1. Se listino ha master_list_id → 'platform' (derivato da master)
 * 2. Se listino is_global → 'platform' (listino globale SpedireSicuro)
 * 3. Se listino assegnato via price_list_assignments → 'platform'
 * 4. Se utente è BYOC con proprio contratto → 'byoc_own'
 * 5. Altrimenti → 'reseller_own' (contratto proprio del reseller)
 * 
 * @param supabaseAdmin - Client Supabase con privilegi admin
 * @param params - Parametri per determinare la fonte
 * @returns Risultato con api_source e metadata
 */
export async function determineApiSource(
  supabaseAdmin: SupabaseClient,
  params: DetermineApiSourceParams
): Promise<DetermineApiSourceResult> {
  const { userId, priceListId, courierCode } = params;

  // Se abbiamo un priceListId, verifica le sue caratteristiche
  if (priceListId) {
    const { data: priceList, error } = await supabaseAdmin
      .from('price_lists')
      .select('id, master_list_id, is_global, list_type, created_by, assigned_to_user_id')
      .eq('id', priceListId)
      .single();

    if (!error && priceList) {
      // Check 1: Listino derivato da master
      if (priceList.master_list_id) {
        return {
          apiSource: 'platform',
          masterPriceListId: priceList.master_list_id,
          priceListId: priceList.id,
          reason: 'Listino derivato da master (clonato da SuperAdmin)',
        };
      }

      // Check 2: Listino globale
      if (priceList.is_global && priceList.list_type === 'global') {
        return {
          apiSource: 'platform',
          priceListId: priceList.id,
          reason: 'Listino globale SpedireSicuro',
        };
      }

      // Check 3: Listino assegnato da SuperAdmin (non creato dall'utente)
      if (priceList.assigned_to_user_id === userId && priceList.created_by !== userId) {
        // Verifica se creato da superadmin
        const { data: creator } = await supabaseAdmin
          .from('users')
          .select('account_type')
          .eq('id', priceList.created_by)
          .single();

        if (creator?.account_type === 'superadmin') {
          return {
            apiSource: 'platform',
            priceListId: priceList.id,
            reason: 'Listino assegnato da SuperAdmin',
          };
        }
      }
    }
  }

  // Check 4: Verifica se utente ha assegnazioni via price_list_assignments
  const { data: assignments } = await supabaseAdmin
    .from('price_list_assignments')
    .select(`
      price_list_id,
      price_lists (
        id,
        master_list_id,
        is_global,
        list_type
      )
    `)
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (assignments && assignments.length > 0) {
    // Se ha almeno un'assegnazione attiva, potrebbe usare contratti piattaforma
    // Ma dobbiamo verificare se il listino usato è tra quelli assegnati
    for (const assignment of assignments) {
      const assignedList = assignment.price_lists as any;
      if (assignedList && (assignedList.master_list_id || assignedList.is_global)) {
        // L'utente ha accesso a listini piattaforma
        // Se non abbiamo specificato un priceListId, assumiamo che usi quello assegnato
        if (!priceListId) {
          return {
            apiSource: 'platform',
            masterPriceListId: assignedList.master_list_id,
            priceListId: assignedList.id,
            reason: 'Utente con listino piattaforma assegnato (default)',
          };
        }
      }
    }
  }

  // Check 5: Verifica tipo utente
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('account_type, is_reseller')
    .eq('id', userId)
    .single();

  if (user?.account_type === 'byoc') {
    return {
      apiSource: 'byoc_own',
      priceListId,
      reason: 'Utente BYOC con contratto proprio',
    };
  }

  // Default: reseller con proprio contratto
  return {
    apiSource: 'reseller_own',
    priceListId,
    reason: 'Reseller/utente con contratto proprio',
  };
}

export interface CalculateProviderCostParams {
  courierCode: string;
  weight: number;
  destination: {
    zip?: string;
    province?: string;
    country?: string;
  };
  serviceType?: string;
  masterPriceListId?: string;
}

export interface CalculateProviderCostResult {
  cost: number;
  source: CostSource;
  confidence: 'high' | 'medium' | 'low';
  details?: string;
}

/**
 * Calcola il costo reale che SpedireSicuro paga al corriere.
 * 
 * Fallback chain:
 * 1. API realtime corriere (se disponibile) → HIGH confidence
 * 2. Listino master (costi base) → HIGH confidence
 * 3. Media storica → MEDIUM confidence
 * 4. Stima percentuale → LOW confidence
 * 
 * @param supabaseAdmin - Client Supabase con privilegi admin
 * @param params - Parametri per il calcolo
 * @returns Costo stimato con fonte e confidence
 */
export async function calculateProviderCost(
  supabaseAdmin: SupabaseClient,
  params: CalculateProviderCostParams
): Promise<CalculateProviderCostResult> {
  const { courierCode, weight, destination, serviceType, masterPriceListId } = params;

  // 1. Prova listino master (se specificato)
  if (masterPriceListId) {
    const masterCost = await getCostFromMasterList(
      supabaseAdmin,
      masterPriceListId,
      weight,
      destination,
      serviceType
    );
    
    if (masterCost !== null) {
      return {
        cost: masterCost,
        source: 'master_list',
        confidence: 'high',
        details: `Da listino master ${masterPriceListId}`,
      };
    }
  }

  // 2. Cerca listino master per corriere
  const { data: masterLists } = await supabaseAdmin
    .from('price_lists')
    .select('id, name')
    .eq('is_global', true)
    .eq('status', 'active')
    .or(`list_type.eq.global,list_type.eq.supplier`)
    .ilike('name', `%${courierCode}%`)
    .limit(1);

  if (masterLists && masterLists.length > 0) {
    const masterCost = await getCostFromMasterList(
      supabaseAdmin,
      masterLists[0].id,
      weight,
      destination,
      serviceType
    );
    
    if (masterCost !== null) {
      return {
        cost: masterCost,
        source: 'master_list',
        confidence: 'high',
        details: `Da listino ${masterLists[0].name}`,
      };
    }
  }

  // 3. Media storica (ultimi 30 giorni)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: historicalCosts } = await supabaseAdmin
    .from('platform_provider_costs')
    .select('provider_cost')
    .eq('courier_code', courierCode)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  if (historicalCosts && historicalCosts.length >= 10) {
    const avgCost = historicalCosts.reduce((sum, r) => sum + r.provider_cost, 0) / historicalCosts.length;
    return {
      cost: Math.round(avgCost * 100) / 100,
      source: 'historical_avg',
      confidence: 'medium',
      details: `Media di ${historicalCosts.length} spedizioni ${courierCode}`,
    };
  }

  // 4. Stima basata su peso (fallback finale)
  // Stima conservativa: €5 base + €0.50/kg
  const estimatedCost = 5 + (weight * 0.5);
  
  return {
    cost: Math.round(estimatedCost * 100) / 100,
    source: 'estimate',
    confidence: 'low',
    details: `Stima basata su peso (${weight}kg). Richiede verifica.`,
  };
}

/**
 * Recupera costo base da listino master.
 */
async function getCostFromMasterList(
  supabaseAdmin: SupabaseClient,
  priceListId: string,
  weight: number,
  destination: { zip?: string; province?: string; country?: string },
  serviceType?: string
): Promise<number | null> {
  try {
    // Cerca entry nel listino per peso e zona
    const { data: entries } = await supabaseAdmin
      .from('price_list_entries')
      .select('base_price, fuel_surcharge_percent')
      .eq('price_list_id', priceListId)
      .lte('weight_from', weight)
      .gte('weight_to', weight)
      .limit(1);

    if (entries && entries.length > 0) {
      let cost = entries[0].base_price;
      
      // Aggiungi fuel surcharge se presente
      if (entries[0].fuel_surcharge_percent) {
        cost += cost * (entries[0].fuel_surcharge_percent / 100);
      }
      
      return Math.round(cost * 100) / 100;
    }

    // Fallback: prova con regole JSONB
    const { data: priceList } = await supabaseAdmin
      .from('price_lists')
      .select('rules, default_margin_percent')
      .eq('id', priceListId)
      .single();

    if (priceList?.rules && Array.isArray(priceList.rules)) {
      // Cerca regola che matcha
      for (const rule of priceList.rules) {
        if (rule.weight_from <= weight && rule.weight_to >= weight) {
          if (rule.base_price_override) {
            return rule.base_price_override;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[PROVIDER_COST] Error getting cost from master list:', error);
    return null;
  }
}

/**
 * Calcola il margine dato billed_amount e provider_cost.
 * Utility function per consistenza.
 */
export function calculateMargin(billedAmount: number, providerCost: number): {
  margin: number;
  marginPercent: number;
} {
  const margin = billedAmount - providerCost;
  const marginPercent = providerCost > 0
    ? Math.round((margin / providerCost * 100) * 100) / 100
    : billedAmount > 0 ? 100 : 0;

  return { margin, marginPercent };
}
