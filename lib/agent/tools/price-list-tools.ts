import {
  assignPriceListToUserViaTableAction,
  clonePriceListAction,
  listMasterPriceListsAction,
} from '@/actions/price-lists';
import { supabaseAdmin } from '@/lib/db/client';
import { z } from 'zod';
import { AgentTool, ToolExecutionContext } from './registry';

/**
 * Helper: check permission for price list management
 * - Superadmin: Always true
 * - Reseller: True ONLY if metadata.ai_can_manage_pricelists === true
 */
async function checkPriceListPermission(context: ToolExecutionContext): Promise<boolean> {
  if (context.userRole === 'superadmin') return true;
  if (context.userRole !== 'reseller') return false;

  // Check reseller permission flag in metadata
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('metadata')
      .eq('id', context.userId)
      .single();

    if (error || !user) return false;

    const metadata = user.metadata || {};
    return metadata.ai_can_manage_pricelists === true;
  } catch (e) {
    console.error('Permission check failed:', e);
    return false;
  }
}

// Tool: Search Master Price Lists
export const searchMasterPriceListsTool: AgentTool = {
  name: 'search_master_price_lists',
  description:
    'Search for available master price lists that can be cloned. Useful when looking for a base list to create a new custom list.',
  schema: z.object({
    query: z.string().optional().describe('Search term for list name or courier'),
  }),
  execute: async (args, context) => {
    const hasPermission = await checkPriceListPermission(context);
    if (!hasPermission) {
      return 'PERMISSION_DENIED: You do not have permission to manage price lists.';
    }

    const result = await listMasterPriceListsAction();
    if (!result.success || !result.priceLists) {
      return `Error searching lists: ${result.error || 'Unknown error'}`;
    }

    let lists = result.priceLists;
    if (args.query) {
      const q = args.query.toLowerCase();
      lists = lists.filter(
        (l) => l.name.toLowerCase().includes(q) || l.courier?.name?.toLowerCase().includes(q)
      );
    }

    if (lists.length === 0) return 'No master price lists found.';

    return JSON.stringify(
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        courier: l.courier?.name || 'Generic',
        derived_count: l.derived_count,
      })),
      null,
      2
    );
  },
};

// Tool: Clone Price List
export const clonePriceListTool: AgentTool = {
  name: 'clone_price_list',
  description:
    'Clone a master price list to create a new custom list for a specific user/reseller.',
  schema: z.object({
    source_list_id: z.string().describe('ID of the master price list to clone'),
    new_name: z.string().describe('Name for the new price list'),
    target_user_id: z
      .string()
      .optional()
      .describe('ID of the user who will own/use this list (optional)'),
    margin_percent: z.number().optional().describe('Default margin percentage to apply (optional)'),
  }),
  execute: async (args, context) => {
    const hasPermission = await checkPriceListPermission(context);
    if (!hasPermission) {
      return 'PERMISSION_DENIED: You do not have permission to manage price lists.';
    }

    // Prepare overrides if margin provided
    const overrides: any = {};
    if (args.margin_percent !== undefined) {
      overrides.default_margin_percent = args.margin_percent;
    }

    const result = await clonePriceListAction({
      source_price_list_id: args.source_list_id,
      name: args.new_name,
      target_user_id: args.target_user_id,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });

    if (!result.success) {
      return `Error cloning list: ${result.error}`;
    }

    return `Successfully cloned price list. New List ID: ${result.priceList.id}, Name: ${result.priceList.name}`;
  },
};

// Tool: Assign Price List
export const assignPriceListTool: AgentTool = {
  name: 'assign_price_list',
  description: 'Assign an existing price list to a specific user.',
  schema: z.object({
    price_list_id: z.string().describe('ID of the price list to assign'),
    user_id: z.string().describe('ID of the user to assign the list to'),
    notes: z.string().optional().describe('Optional notes for the assignment'),
  }),
  execute: async (args, context) => {
    const hasPermission = await checkPriceListPermission(context);
    if (!hasPermission)
      return 'PERMISSION_DENIED: You do not have permission to manage price lists.';

    const result = await assignPriceListToUserViaTableAction({
      price_list_id: args.price_list_id,
      user_id: args.user_id,
      notes: args.notes,
    });

    if (!result.success) {
      return `Error assigning list: ${result.error}`;
    }

    return `Successfully assigned price list ${args.price_list_id} to user ${
      args.user_id
    }. Assignment ID: ${result.assignment?.id || 'unknown'}`;
  },
};
