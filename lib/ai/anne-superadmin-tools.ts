/**
 * Anne AI - Superadmin Tools per Accesso Completo Database
 * 
 * Questi tools permettono ad Anne di:
 * - Leggere TUTTE le spedizioni da TUTTE le fonti
 * - Analizzare statistiche per sorgente
 * - Cercare spedizioni con ricerca full-text
 * - Filtrare per categoria/piattaforma
 * 
 * Requisiti:
 * - Eseguire prima: ANNE_SUPERADMIN_ACCESS.sql
 * - User role: 'admin' o 'superadmin'
 */

import { supabaseAdmin } from '@/lib/db/client';

// ============================================
// TYPES
// ============================================

export interface AnneShipment {
  id: string;
  tracking_number: string;
  external_tracking_number?: string;
  status: string;
  user_id?: string;
  created_by_user_email?: string;
  
  // Mittente
  sender_name: string;
  sender_address?: string;
  sender_city?: string;
  sender_zip?: string;
  sender_province?: string;
  sender_country?: string;
  sender_phone?: string;
  sender_email?: string;
  sender_reference?: string;
  
  // Destinatario
  recipient_name: string;
  recipient_type?: string;
  recipient_address?: string;
  recipient_city?: string;
  recipient_zip?: string;
  recipient_province?: string;
  recipient_country?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_notes?: string;
  
  // Pacco
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  volumetric_weight?: number;
  packages_count?: number;
  content?: string;
  declared_value?: number;
  currency?: string;
  
  // Corriere
  courier_id?: string;
  service_type?: string;
  courier_name?: string;
  courier_display_name?: string;
  
  // Pricing
  base_price?: number;
  surcharges?: number;
  total_cost?: number;
  margin_percent?: number;
  final_price?: number;
  cash_on_delivery?: boolean;
  cash_on_delivery_amount?: number;
  insurance?: boolean;
  
  // E-commerce
  ecommerce_platform?: string;
  ecommerce_order_id?: string;
  ecommerce_order_number?: string;
  
  // Sorgente (CRITICO per Anne)
  imported: boolean;
  import_source?: string;
  import_platform?: string;
  created_via_ocr: boolean;
  ocr_confidence_score?: number;
  
  // Metadati
  verified: boolean;
  deleted: boolean;
  deleted_at?: string;
  notes?: string;
  internal_notes?: string;
  ldv?: string;
  
  // Timestamp
  created_at: string;
  updated_at: string;
  shipped_at?: string;
  delivered_at?: string;
  pickup_time?: string;
  gps_location?: string;
  
  // Categorizzazione (generata dalla view)
  source_category: string;
  
  // Info proprietario
  owner_email?: string;
  owner_name?: string;
  owner_role?: string;
  owner_account_type?: string;
}

export interface ShipmentStats {
  total_shipments: number;
  manual_created: number;
  csv_imported: number;
  excel_imported: number;
  pdf_imported: number;
  ocr_created: number;
  ecommerce_synced: number;
  other_platform: number;
  verified_count: number;
  unverified_count: number;
  deleted_count: number;
}

export interface ShipmentSearchResult {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_city: string;
  status: string;
  source_category: string;
  created_at: string;
  relevance: number;
}

// ============================================
// TOOLS PER ANNE AI
// ============================================

/**
 * Tool 1: Ottieni TUTTE le spedizioni
 * Anne può leggere tutte le spedizioni se è superadmin
 */
export async function anneGetAllShipments(
  filters?: {
    limit?: number;
    offset?: number;
    source_category?: string;
    status?: string;
    courier_id?: string;
    date_from?: string;
    date_to?: string;
    only_imported?: boolean;
    only_ocr?: boolean;
    only_verified?: boolean;
    search?: string;
  }
): Promise<{ success: true; data: AnneShipment[] } | { success: false; error: string }> {
  try {
    let query = supabaseAdmin
      .from('anne_all_shipments_view')
      .select('*');

    // Applica filtri
    if (filters?.source_category) {
      query = query.eq('source_category', filters.source_category);
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.courier_id) {
      query = query.eq('courier_id', filters.courier_id);
    }
    
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    
    if (filters?.only_imported) {
      query = query.eq('imported', true);
    }
    
    if (filters?.only_ocr) {
      query = query.eq('created_via_ocr', true);
    }
    
    if (filters?.only_verified !== undefined) {
      query = query.eq('verified', filters.only_verified);
    }
    
    if (filters?.search) {
      query = query.or(`tracking_number.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%,recipient_city.ilike.%${filters.search}%`);
    }

    // Ordina per data (più recenti prima)
    query = query.order('created_at', { ascending: false });

    // Paginazione
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ANNE] Errore lettura spedizioni:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AnneShipment[] };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 2: Ottieni statistiche per sorgente
 * Anne può analizzare quante spedizioni provengono da ogni fonte
 */
export async function anneGetShipmentStats(): Promise<
  { success: true; data: ShipmentStats } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('anne_get_shipments_stats');

    if (error) {
      console.error('[ANNE] Errore statistiche:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { 
        success: true, 
        data: {
          total_shipments: 0,
          manual_created: 0,
          csv_imported: 0,
          excel_imported: 0,
          pdf_imported: 0,
          ocr_created: 0,
          ecommerce_synced: 0,
          other_platform: 0,
          verified_count: 0,
          unverified_count: 0,
          deleted_count: 0,
        }
      };
    }

    return { success: true, data: data[0] as ShipmentStats };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 3: Ricerca full-text spedizioni
 * Anne può cercare spedizioni con ricerca semantica in italiano
 */
export async function anneSearchShipments(
  searchTerm: string,
  limit = 50
): Promise<
  { success: true; data: ShipmentSearchResult[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('anne_search_shipments', {
        p_search_term: searchTerm,
        p_limit: limit
      });

    if (error) {
      console.error('[ANNE] Errore ricerca:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ShipmentSearchResult[] };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 4: Analisi per categoria sorgente
 * Anne può analizzare spedizioni raggruppate per sorgente
 */
export async function anneAnalyzeBySource(): Promise<
  { 
    success: true; 
    data: Array<{
      source_category: string;
      count: number;
      total_revenue: number;
      avg_price: number;
      verified_count: number;
    }> 
  } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabaseAdmin
      .from('anne_all_shipments_view')
      .select('source_category, final_price, verified');

    if (error) {
      console.error('[ANNE] Errore analisi:', error);
      return { success: false, error: error.message };
    }

    // Raggruppa per sorgente
    const grouped = data.reduce((acc: any, row: any) => {
      const category = row.source_category || 'Unknown';
      
      if (!acc[category]) {
        acc[category] = {
          source_category: category,
          count: 0,
          total_revenue: 0,
          verified_count: 0,
          prices: [],
        };
      }
      
      acc[category].count++;
      if (row.final_price) {
        acc[category].total_revenue += row.final_price;
        acc[category].prices.push(row.final_price);
      }
      if (row.verified) {
        acc[category].verified_count++;
      }
      
      return acc;
    }, {});

    // Calcola medie e formatta
    const result = Object.values(grouped).map((group: any) => ({
      source_category: group.source_category,
      count: group.count,
      total_revenue: Math.round(group.total_revenue * 100) / 100,
      avg_price: group.prices.length > 0 
        ? Math.round((group.total_revenue / group.prices.length) * 100) / 100 
        : 0,
      verified_count: group.verified_count,
    }));

    // Ordina per numero di spedizioni
    result.sort((a, b) => b.count - a.count);

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 5: Spedizioni da verificare
 * Anne può trovare spedizioni importate che necessitano verifica
 */
export async function anneGetUnverifiedShipments(limit = 50): Promise<
  { success: true; data: AnneShipment[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabaseAdmin
      .from('anne_all_shipments_view')
      .select('*')
      .eq('verified', false)
      .or('imported.eq.true,created_via_ocr.eq.true')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ANNE] Errore lettura non verificate:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AnneShipment[] };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 6: Spedizioni con errori OCR
 * Anne può trovare spedizioni OCR con bassa confidenza
 */
export async function anneGetLowConfidenceOCR(
  threshold = 0.80,
  limit = 50
): Promise<
  { success: true; data: AnneShipment[] } | { success: false; error: string }
> {
  try {
    const { data, error } = await supabaseAdmin
      .from('anne_all_shipments_view')
      .select('*')
      .eq('created_via_ocr', true)
      .lt('ocr_confidence_score', threshold)
      .order('ocr_confidence_score', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[ANNE] Errore lettura OCR bassa confidenza:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AnneShipment[] };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 7: Top clienti per volume
 * Anne può analizzare i clienti più attivi
 */
export async function anneGetTopCustomers(
  days = 30,
  limit = 10
): Promise<
  { 
    success: true; 
    data: Array<{
      owner_email: string;
      owner_name: string;
      total_shipments: number;
      total_revenue: number;
      imported_shipments: number;
      ocr_shipments: number;
      avg_price: number;
    }> 
  } | { success: false; error: string }
> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('anne_all_shipments_view')
      .select('owner_email, owner_name, final_price, imported, created_via_ocr')
      .gte('created_at', dateFrom.toISOString());

    if (error) {
      console.error('[ANNE] Errore top clienti:', error);
      return { success: false, error: error.message };
    }

    // Raggruppa per cliente
    const grouped = data.reduce((acc: any, row: any) => {
      const email = row.owner_email || 'unknown@example.com';
      
      if (!acc[email]) {
        acc[email] = {
          owner_email: email,
          owner_name: row.owner_name || 'Sconosciuto',
          total_shipments: 0,
          total_revenue: 0,
          imported_shipments: 0,
          ocr_shipments: 0,
          prices: [],
        };
      }
      
      acc[email].total_shipments++;
      if (row.final_price) {
        acc[email].total_revenue += row.final_price;
        acc[email].prices.push(row.final_price);
      }
      if (row.imported) {
        acc[email].imported_shipments++;
      }
      if (row.created_via_ocr) {
        acc[email].ocr_shipments++;
      }
      
      return acc;
    }, {});

    // Calcola medie e formatta
    const result = Object.values(grouped).map((group: any) => ({
      owner_email: group.owner_email,
      owner_name: group.owner_name,
      total_shipments: group.total_shipments,
      total_revenue: Math.round(group.total_revenue * 100) / 100,
      imported_shipments: group.imported_shipments,
      ocr_shipments: group.ocr_shipments,
      avg_price: group.prices.length > 0 
        ? Math.round((group.total_revenue / group.prices.length) * 100) / 100 
        : 0,
    }));

    // Ordina per numero di spedizioni e prendi top N
    result.sort((a, b) => b.total_shipments - a.total_shipments);
    const topN = result.slice(0, limit);

    return { success: true, data: topN };
  } catch (error: any) {
    console.error('[ANNE] Errore imprevisto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tool 8: Dashboard KPI per Anne
 * Anne può ottenere tutti i KPI principali in una sola chiamata
 */
export async function anneGetDashboardKPIs(): Promise<
  { 
    success: true; 
    data: {
      stats: ShipmentStats;
      by_source: any[];
      unverified_count: number;
      low_confidence_ocr: number;
      today_shipments: number;
      week_shipments: number;
      month_revenue: number;
    } 
  } | { success: false; error: string }
> {
  try {
    // Parallelize multiple queries
    const [
      statsResult,
      bySourceResult,
      unverifiedResult,
      lowOcrResult,
      todayResult,
      weekResult,
      monthRevenueResult,
    ] = await Promise.all([
      anneGetShipmentStats(),
      anneAnalyzeBySource(),
      supabaseAdmin.from('anne_all_shipments_view').select('id', { count: 'exact', head: true }).eq('verified', false),
      supabaseAdmin.from('anne_all_shipments_view').select('id', { count: 'exact', head: true }).eq('created_via_ocr', true).lt('ocr_confidence_score', 0.80),
      supabaseAdmin.from('anne_all_shipments_view').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
      supabaseAdmin.from('anne_all_shipments_view').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin.from('anne_all_shipments_view').select('final_price').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Calculate month revenue
    let monthRevenue = 0;
    if (monthRevenueResult.data) {
      monthRevenue = monthRevenueResult.data.reduce((sum: number, row: any) => sum + (row.final_price || 0), 0);
    }

    return {
      success: true,
      data: {
        stats: statsResult.success ? statsResult.data : {} as ShipmentStats,
        by_source: bySourceResult.success ? bySourceResult.data : [],
        unverified_count: unverifiedResult.count || 0,
        low_confidence_ocr: lowOcrResult.count || 0,
        today_shipments: todayResult.count || 0,
        week_shipments: weekResult.count || 0,
        month_revenue: Math.round(monthRevenue * 100) / 100,
      },
    };
  } catch (error: any) {
    console.error('[ANNE] Errore dashboard KPIs:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// EXPORT
// ============================================

export const ANNE_SUPERADMIN_TOOLS = {
  getAllShipments: anneGetAllShipments,
  getShipmentStats: anneGetShipmentStats,
  searchShipments: anneSearchShipments,
  analyzeBySource: anneAnalyzeBySource,
  getUnverifiedShipments: anneGetUnverifiedShipments,
  getLowConfidenceOCR: anneGetLowConfidenceOCR,
  getTopCustomers: anneGetTopCustomers,
  getDashboardKPIs: anneGetDashboardKPIs,
};
