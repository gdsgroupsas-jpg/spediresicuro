import { isSuperAdminCheck } from '@/lib/auth-helpers';
import { getWorkspaceAuth } from '@/lib/workspace-auth';

export async function verifySuperAdmin(): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();

    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }

    if (!isSuperAdminCheck(wsContext.actor)) {
      return {
        success: false,
        error: 'Accesso non autorizzato: solo SuperAdmin',
      };
    }

    return { success: true, userId: wsContext.actor.id };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] verifySuperAdmin error:', error);
    return { success: false, error: error?.message || 'Errore di autenticazione' };
  }
}
