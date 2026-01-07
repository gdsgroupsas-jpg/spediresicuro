/**
 * Reconciliation Service
 * 
 * Servizio per riconciliazione costi piattaforma con fatture corrieri.
 * Estrae la logica di riconciliazione in un servizio dedicato.
 * 
 * @module lib/services/financial/reconciliation-service
 * @since Sprint 3 - Refactoring
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type ReconciliationStatus = 'pending' | 'matched' | 'discrepancy' | 'resolved'

export interface ReconciliationItem {
  id: string
  shipmentId: string
  trackingNumber: string
  billedAmount: number
  providerCost: number
  margin: number
  marginPercent: number
  courierCode: string
  status: ReconciliationStatus
  createdAt: Date
  ageDays: number
}

export interface ReconciliationStats {
  totalPending: number
  totalMatched: number
  totalDiscrepancy: number
  totalResolved: number
  pendingValue: number
  discrepancyValue: number
}

export interface BulkReconciliationResult {
  processed: number
  matched: number
  discrepancies: number
  errors: string[]
}

/**
 * Servizio per gestione riconciliazione
 */
export class ReconciliationService {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Ottiene statistiche di riconciliazione
   */
  async getStats(): Promise<ReconciliationStats> {
    const [pending, matched, discrepancy, resolved] = await Promise.all([
      this.supabase
        .from('platform_provider_costs')
        .select('billed_amount', { count: 'exact' })
        .eq('reconciliation_status', 'pending'),
      this.supabase
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('reconciliation_status', 'matched'),
      this.supabase
        .from('platform_provider_costs')
        .select('billed_amount', { count: 'exact' })
        .eq('reconciliation_status', 'discrepancy'),
      this.supabase
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('reconciliation_status', 'resolved'),
    ])
    
    const pendingValue = (pending.data || []).reduce((sum, r) => sum + (r.billed_amount || 0), 0)
    const discrepancyValue = (discrepancy.data || []).reduce((sum, r) => sum + (r.billed_amount || 0), 0)
    
    return {
      totalPending: pending.count || 0,
      totalMatched: matched.count || 0,
      totalDiscrepancy: discrepancy.count || 0,
      totalResolved: resolved.count || 0,
      pendingValue,
      discrepancyValue,
    }
  }
  
  /**
   * Ottiene items da riconciliare con paginazione
   */
  async getPendingItems(options: {
    page?: number
    pageSize?: number
    courierFilter?: string
    sortBy?: 'created_at' | 'billed_amount' | 'margin'
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<{ items: ReconciliationItem[]; total: number }> {
    const {
      page = 1,
      pageSize = 50,
      courierFilter,
      sortBy = 'created_at',
      sortOrder = 'asc'
    } = options
    
    let query = this.supabase
      .from('platform_provider_costs')
      .select(`
        id,
        shipment_id,
        shipment_tracking_number,
        billed_amount,
        provider_cost,
        platform_margin,
        platform_margin_percent,
        courier_code,
        reconciliation_status,
        created_at
      `, { count: 'exact' })
      .in('reconciliation_status', ['pending', 'discrepancy'])
    
    if (courierFilter) {
      query = query.eq('courier_code', courierFilter)
    }
    
    const { data, count, error } = await query
      .order(sortBy === 'margin' ? 'platform_margin' : sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * pageSize, page * pageSize - 1)
    
    if (error) throw error
    
    const now = new Date()
    const items: ReconciliationItem[] = (data || []).map(row => ({
      id: row.id,
      shipmentId: row.shipment_id,
      trackingNumber: row.shipment_tracking_number,
      billedAmount: row.billed_amount,
      providerCost: row.provider_cost,
      margin: row.platform_margin,
      marginPercent: row.platform_margin_percent,
      courierCode: row.courier_code,
      status: row.reconciliation_status,
      createdAt: new Date(row.created_at),
      ageDays: Math.floor((now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    
    return { items, total: count || 0 }
  }
  
  /**
   * Aggiorna status di un singolo item
   */
  async updateStatus(
    id: string,
    status: ReconciliationStatus,
    userId: string,
    notes?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('platform_provider_costs')
      .update({
        reconciliation_status: status,
        reconciliation_notes: notes,
        reconciled_at: new Date().toISOString(),
        reconciled_by: userId,
      })
      .eq('id', id)
    
    if (error) throw error
    
    // Log audit
    await this.supabase.rpc('log_financial_event', {
      p_event_type: status === 'resolved' ? 'reconciliation_completed' : 'reconciliation_discrepancy',
      p_platform_cost_id: id,
      p_message: notes || `Status changed to ${status}`,
      p_severity: status === 'discrepancy' ? 'warning' : 'info',
      p_actor_id: userId,
    }).catch(() => {}) // Best effort
  }
  
  /**
   * Riconciliazione bulk automatica
   * Marca come "matched" tutti i record con margine positivo e > N giorni
   */
  async autoReconcilePositiveMargins(
    minAgeDays: number = 7,
    userId: string
  ): Promise<BulkReconciliationResult> {
    const result: BulkReconciliationResult = {
      processed: 0,
      matched: 0,
      discrepancies: 0,
      errors: [],
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - minAgeDays)
    
    // Trova candidati per auto-riconciliazione
    const { data: candidates, error } = await this.supabase
      .from('platform_provider_costs')
      .select('id, platform_margin')
      .eq('reconciliation_status', 'pending')
      .gte('platform_margin', 0) // Margine positivo
      .lt('created_at', cutoffDate.toISOString())
      .limit(500)
    
    if (error) {
      result.errors.push(error.message)
      return result
    }
    
    // Update in batch
    for (const candidate of (candidates || [])) {
      try {
        await this.updateStatus(candidate.id, 'matched', userId, 'Auto-riconciliato: margine positivo')
        result.matched++
      } catch (err: any) {
        result.errors.push(`${candidate.id}: ${err.message}`)
      }
      result.processed++
    }
    
    return result
  }
  
  /**
   * Marca come discrepancy tutti i margini negativi
   */
  async flagNegativeMargins(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('platform_provider_costs')
      .update({
        reconciliation_status: 'discrepancy',
        reconciliation_notes: 'Auto-flaggato: margine negativo',
        reconciled_at: new Date().toISOString(),
        reconciled_by: userId,
      })
      .eq('reconciliation_status', 'pending')
      .lt('platform_margin', 0)
      .select('id')
    
    if (error) throw error
    
    return data?.length || 0
  }
}

/**
 * Factory function
 */
export function createReconciliationService(supabase: SupabaseClient): ReconciliationService {
  return new ReconciliationService(supabase)
}
