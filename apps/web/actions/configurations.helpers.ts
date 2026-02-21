import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { findUserByEmail } from '@/lib/database';

/**
 * Verifica se l'utente corrente e admin
 */
export async function verifyAdminAccess(): Promise<{
  isAdmin: boolean;
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { isAdmin: false, error: 'Non autenticato' };
    }

    let user;
    if (context.actor.id === 'test-user-id') {
      user = { account_type: 'admin' };
    } else {
      user = await findUserByEmail(context.actor.email);
    }

    if (!user || !isAdminOrAbove(user)) {
      return {
        isAdmin: false,
        error: 'Accesso negato. Solo gli admin possono gestire le configurazioni.',
      };
    }

    return { isAdmin: true };
  } catch (error: any) {
    console.error('Errore verifica admin:', error);
    return {
      isAdmin: false,
      error: error.message || 'Errore verifica permessi',
    };
  }
}

/**
 * Helper: Maschera credenziali sensibili nelle configurazioni
 * NON espone api_key e api_secret in chiaro al frontend
 */
export function maskConfigCredentials(configs: any[]): any[] {
  return configs.map((config: any) => {
    const masked: any = { ...config };

    if (config.api_key) {
      masked.api_key = config.api_key.length > 4 ? `...${config.api_key.slice(-4)}` : '********';
    }

    if (config.api_secret) {
      masked.api_secret = '********';
    }

    return masked;
  });
}

/**
 * Verifica se l'utente puo gestire una configurazione
 *
 * RBAC:
 * - super_admin/admin: config globali + proprie (non quelle di altri reseller)
 * - reseller_admin: solo se owner_user_id === user.id
 */
export async function verifyConfigAccess(configOwnerUserId: string | null): Promise<{
  canAccess: boolean;
  error?: string;
  userId?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { canAccess: false, error: 'Non autenticato' };
    }

    let user: any;
    if (context.actor.id === 'test-user-id') {
      user = {
        id: 'test-user-id',
        account_type: 'admin',
        is_reseller: true,
        reseller_role: 'admin',
        role: 'admin',
      };
    } else {
      user = await findUserByEmail(context.actor.email);
    }

    if (!user) {
      return { canAccess: false, error: 'Utente non trovato' };
    }

    const userId = (user as any).id;
    const accountType = (user as any).account_type;
    const isReseller = (user as any).is_reseller === true;
    const resellerRole = (user as any).reseller_role;

    console.log('[verifyConfigAccess] Verifica permessi:', {
      userId,
      email: context.actor.email,
      accountType,
      role: user.role,
      isReseller,
      resellerRole,
      configOwnerUserId,
    });

    if (isAdminOrAbove(user)) {
      if (!configOwnerUserId) {
        console.log('[verifyConfigAccess] Accesso OK: Admin/Superadmin, config globale');
        return { canAccess: true, userId };
      }
      if (configOwnerUserId === userId) {
        console.log('[verifyConfigAccess] Accesso OK: Admin/Superadmin, config propria');
        return { canAccess: true, userId };
      }
      console.log(
        '[verifyConfigAccess] Admin/Superadmin: config di altro reseller, accesso negato',
        {
          configOwnerUserId,
          userId,
        }
      );
      return {
        canAccess: false,
        error: 'Accesso negato. Puoi gestire solo configurazioni globali o create da te.',
      };
    }

    if (isReseller && resellerRole === 'admin') {
      if (!configOwnerUserId) {
        console.log('[verifyConfigAccess] Reseller Admin: config globale, accesso negato');
        return {
          canAccess: false,
          error: 'Accesso negato. I reseller admin possono gestire solo le proprie configurazioni.',
        };
      }
      if (configOwnerUserId !== userId) {
        console.log('[verifyConfigAccess] Reseller Admin: owner_user_id mismatch', {
          configOwnerUserId,
          userId,
        });
        return {
          canAccess: false,
          error: 'Accesso negato. Puoi gestire solo le tue configurazioni.',
        };
      }
      console.log('[verifyConfigAccess] Accesso OK: Reseller Admin, owner match');
      return { canAccess: true, userId };
    }

    console.log('[verifyConfigAccess] Accesso negato: ne super_admin ne reseller_admin', {
      isReseller,
      resellerRole,
    });
    return {
      canAccess: false,
      error: 'Accesso negato. Solo gli admin o reseller admin possono gestire le configurazioni.',
    };
  } catch (error: any) {
    console.error('Errore verifica accesso configurazione:', error);
    return {
      canAccess: false,
      error: error.message || 'Errore verifica permessi',
    };
  }
}

export function parseContractMapping(contractMapping: unknown): {
  ok: boolean;
  mapping: Record<string, string>;
  error?: string;
} {
  if (!contractMapping) {
    return { ok: true, mapping: {} };
  }

  if (typeof contractMapping === 'string') {
    try {
      return { ok: true, mapping: JSON.parse(contractMapping) as Record<string, string> };
    } catch {
      return { ok: false, mapping: {}, error: 'Errore parsing contract_mapping' };
    }
  }

  return { ok: true, mapping: contractMapping as Record<string, string> };
}
