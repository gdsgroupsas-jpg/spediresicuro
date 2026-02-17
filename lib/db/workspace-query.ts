/**
 * Workspace-Scoped Query Builder
 *
 * Forza automaticamente il filtro workspace_id su tutte le query
 * verso tabelle multi-tenant. Impossibile dimenticare il filtro.
 *
 * USO:
 *   const wq = workspaceQuery(workspaceId);
 *   const { data } = await wq.from('price_lists').select('*');
 *   // Equivale a: supabaseAdmin.from('price_lists').select('*').eq('workspace_id', workspaceId)
 *
 * TABELLE PROTETTE (con workspace_id):
 *   shipments, wallet_transactions, audit_logs, price_lists,
 *   commercial_quotes, reseller_prospects, leads, emails,
 *   outreach_*, workspace_email_addresses, workspace_announcements,
 *   workspace_custom_domains, suppliers, products, product_suppliers,
 *   warehouses, inventory, warehouse_movements, purchase_orders,
 *   purchase_order_items
 *
 * TABELLE NON FILTRATE (globali o user-scoped):
 *   users, workspaces, workspace_members, couriers, courier_configs,
 *   system_settings, anne_*
 *
 * @module lib/db/workspace-query
 */

import { supabaseAdmin } from '@/lib/db/client';

// Tabelle che DEVONO essere filtrate per workspace_id
const WORKSPACE_SCOPED_TABLES = new Set([
  'shipments',
  'wallet_transactions',
  'audit_logs',
  'price_lists',
  'price_list_assignments',
  'price_list_entries',
  'commercial_quotes',
  'commercial_quote_events',
  'reseller_prospects',
  'prospect_events',
  'leads',
  'lead_events',
  'outreach_channel_config',
  'outreach_templates',
  'outreach_sequences',
  'outreach_enrollments',
  'outreach_executions',
  'workspace_email_addresses',
  'workspace_announcements',
  'workspace_custom_domains',
  'emails',
  'suppliers',
  'products',
  'product_suppliers',
  'warehouses',
  'inventory',
  'warehouse_movements',
  'purchase_orders',
  'purchase_order_items',
]);

// Esportato per test e verifiche
export { WORKSPACE_SCOPED_TABLES };

/**
 * Crea un query builder che forza il filtro workspace_id
 * su tutte le tabelle multi-tenant.
 *
 * @param workspaceId - UUID del workspace corrente
 * @returns Proxy che intercetta .from() e aggiunge .eq('workspace_id', wsId)
 */
export function workspaceQuery(workspaceId: string) {
  if (!workspaceId) {
    throw new Error('workspaceQuery: workspaceId è obbligatorio');
  }

  return {
    /**
     * Query una tabella con filtro workspace_id automatico.
     * Se la tabella è in WORKSPACE_SCOPED_TABLES, il filtro viene applicato.
     * Se non lo è, la query passa direttamente (stessa API di supabaseAdmin).
     */
    from(table: string) {
      const baseQuery = supabaseAdmin.from(table);

      if (WORKSPACE_SCOPED_TABLES.has(table)) {
        // Intercetta la catena: select → eq(workspace_id) automatico
        return new WorkspaceScopedQuery(baseQuery, workspaceId, table);
      }

      // Tabella non multi-tenant: passa direttamente
      return baseQuery;
    },

    /**
     * Passthrough per RPC (non filtrate per workspace — gestiscono internamente)
     */
    rpc: supabaseAdmin.rpc.bind(supabaseAdmin),
  };
}

/**
 * Wrapper che intercetta le operazioni sulla query chain
 * e aggiunge automaticamente il filtro workspace_id.
 *
 * Supporta: select, insert, update, delete, upsert
 */
class WorkspaceScopedQuery {
  private baseQuery: any;
  private wsId: string;
  private tableName: string;

  constructor(baseQuery: any, workspaceId: string, tableName: string) {
    this.baseQuery = baseQuery;
    this.wsId = workspaceId;
    this.tableName = tableName;
  }

  /**
   * SELECT con filtro workspace_id automatico
   */
  select(columns?: string, options?: any) {
    const q = this.baseQuery.select(columns, options);
    return q.eq('workspace_id', this.wsId);
  }

  /**
   * INSERT con workspace_id iniettato nei dati
   */
  insert(data: any | any[], options?: any) {
    const enriched = Array.isArray(data)
      ? data.map((row: any) => ({ ...row, workspace_id: this.wsId }))
      : { ...data, workspace_id: this.wsId };
    return this.baseQuery.insert(enriched, options);
  }

  /**
   * UPDATE con filtro workspace_id automatico
   */
  update(data: any, options?: any) {
    const q = this.baseQuery.update(data, options);
    return q.eq('workspace_id', this.wsId);
  }

  /**
   * DELETE con filtro workspace_id automatico
   */
  delete(options?: any) {
    const q = this.baseQuery.delete(options);
    return q.eq('workspace_id', this.wsId);
  }

  /**
   * UPSERT con workspace_id iniettato nei dati
   */
  upsert(data: any | any[], options?: any) {
    const enriched = Array.isArray(data)
      ? data.map((row: any) => ({ ...row, workspace_id: this.wsId }))
      : { ...data, workspace_id: this.wsId };
    return this.baseQuery.upsert(enriched, options);
  }
}
