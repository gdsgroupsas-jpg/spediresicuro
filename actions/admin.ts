'use server';

/**
 * Server Actions per Gestione Admin e Gerarchia Multi-Livello
 *
 * Gestisce la creazione di sotto-admin e la gestione della gerarchia
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { createUser } from '@/lib/database';
import type { User } from '@/lib/database';
import { validateEmail } from '@/lib/validators';
import { getUserByEmail, userExists, getUserWorkspaceId } from '@/lib/db/user-helpers';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { isAdminOrAbove, isSuperAdminCheck } from '@/lib/auth-helpers';

/**
 * Verifica se un utente ha la killer feature multi_level_admin attiva
 */
async function hasMultiLevelAdminFeature(userEmail: string): Promise<boolean> {
  try {
    // Usa funzione SQL user_has_feature
    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_email: userEmail,
      p_feature_code: 'multi_level_admin',
    });

    if (error) {
      console.error('Errore verifica feature multi_level_admin:', error);
      return false;
    }

    return data === true;
  } catch (error: any) {
    console.error('Errore in hasMultiLevelAdminFeature:', error);
    return false;
  }
}

/**
 * Server Action: Crea un nuovo sotto-admin
 *
 * @param childEmail - Email del nuovo sotto-admin da creare
 * @param childName - Nome del nuovo sotto-admin
 * @param childPassword - Password iniziale (opzionale, se non fornita genera invito)
 * @returns Oggetto con success e dati utente creato
 */
export async function createSubAdmin(
  childEmail: string,
  childName: string,
  childPassword?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  userId?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per creare sotto-admin.',
      };
    }

    const parentEmail = context.actor.email;

    // 2. Valida input
    if (!childEmail || !childEmail.trim() || !childName || !childName.trim()) {
      return {
        success: false,
        error: 'Email e nome sono obbligatori.',
      };
    }

    // Validazione email
    if (!validateEmail(childEmail)) {
      return {
        success: false,
        error: 'Email non valida.',
      };
    }

    // 3. Ottieni parent admin
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .select('id, email, account_type, admin_level, role')
      .eq('email', parentEmail)
      .single();

    if (parentError || !parent) {
      return {
        success: false,
        error: 'Utente parent non trovato.',
      };
    }

    // 4. Verifica che parent sia admin o superadmin
    if (!isAdminOrAbove(parent)) {
      return {
        success: false,
        error: 'Solo gli admin possono creare sotto-admin.',
      };
    }

    // 5. Verifica permessi (superadmin può sempre, altri devono avere feature)
    if (!isSuperAdminCheck(parent)) {
      // Verifica che abbia killer feature multi_level_admin
      const hasFeature = await hasMultiLevelAdminFeature(parentEmail);

      if (!hasFeature) {
        return {
          success: false,
          error:
            'Devi avere la killer feature "Multi-Livello Admin" attiva per creare sotto-admin.',
        };
      }

      // Verifica profondità gerarchica usando funzione SQL
      const { data: canCreate, error: canCreateError } = await supabaseAdmin.rpc(
        'can_create_sub_admin',
        {
          p_admin_id: parent.id,
        }
      );

      if (canCreateError || !canCreate) {
        return {
          success: false,
          error:
            'Non puoi creare sotto-admin. Verifica di avere i permessi e che la gerarchia non superi 5 livelli.',
        };
      }
    }

    // 6. Verifica profondità gerarchica manualmente (backup)
    if (parent.admin_level !== null && parent.admin_level >= 5) {
      return {
        success: false,
        error: 'Limite gerarchia raggiunto (max 5 livelli).',
      };
    }

    // 7. Verifica se child esiste già
    const exists = await userExists(childEmail.trim());

    if (exists) {
      return {
        success: false,
        error: 'Un utente con questa email esiste già.',
      };
    }

    // 8. Genera password se non fornita
    const password = childPassword || generateRandomPassword();

    // 9. Crea nuovo utente
    try {
      const newUser = await createUser({
        email: childEmail.trim(),
        password: password,
        name: childName.trim(),
        role: 'admin',
        accountType: 'admin',
        parentAdminId: parent.id,
      });

      return {
        success: true,
        message: `Sotto-admin creato con successo! ${!childPassword ? 'Password generata: ' + password : ''}`,
        userId: newUser.id,
      };
    } catch (createError: any) {
      console.error('Errore creazione utente:', createError);
      return {
        success: false,
        error: createError.message || 'Errore durante la creazione del sotto-admin.',
      };
    }
  } catch (error: any) {
    console.error('Errore in createSubAdmin:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la creazione del sotto-admin.',
    };
  }
}

/**
 * Genera password casuale per invito
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Ottiene tutti i sotto-admin diretti di un admin
 */
export async function getDirectSubAdmins(parentEmail: string): Promise<{
  success: boolean;
  subAdmins?: any[];
  error?: string;
}> {
  try {
    // Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email || context.actor.email !== parentEmail) {
      return {
        success: false,
        error: 'Non autorizzato.',
      };
    }

    // Ottieni parent ID
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', parentEmail)
      .single();

    if (parentError || !parent) {
      return {
        success: false,
        error: 'Admin non trovato.',
      };
    }

    // Ottieni sotto-admin diretti
    const { data: subAdmins, error: subAdminsError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, account_type, admin_level, created_at')
      .eq('parent_admin_id', parent.id)
      .eq('account_type', 'admin')
      .order('created_at', { ascending: false });

    if (subAdminsError) {
      return {
        success: false,
        error: subAdminsError.message || 'Errore recupero sotto-admin.',
      };
    }

    return {
      success: true,
      subAdmins: subAdmins || [],
    };
  } catch (error: any) {
    console.error('Errore in getDirectSubAdmins:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Ottiene statistiche aggregate per la gerarchia di un admin
 */
export async function getHierarchyStats(parentEmail: string): Promise<{
  success: boolean;
  stats?: {
    totalSubAdmins: number;
    totalShipments: number;
    totalRevenue: number;
    subAdminsByLevel: Record<number, number>;
  };
  error?: string;
}> {
  try {
    // Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email || context.actor.email !== parentEmail) {
      return {
        success: false,
        error: 'Non autorizzato.',
      };
    }

    // Ottieni parent ID
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', parentEmail)
      .single();

    if (parentError || !parent) {
      return {
        success: false,
        error: 'Admin non trovato.',
      };
    }

    // Ottieni tutti i sotto-admin ricorsivamente
    const { data: allSubAdmins, error: hierarchyError } = await supabaseAdmin.rpc(
      'get_all_sub_admins',
      {
        p_admin_id: parent.id,
        p_max_level: 5,
      }
    );

    if (hierarchyError) {
      return {
        success: false,
        error: hierarchyError.message || 'Errore recupero gerarchia.',
      };
    }

    const allUserIds = [parent.id, ...(allSubAdmins?.map((u: any) => u.id) || [])];

    // Calcola statistiche
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('final_price')
      .in('user_id', allUserIds)
      .eq('deleted', false);

    if (shipmentsError) {
      console.error('Errore recupero spedizioni:', shipmentsError);
    }

    const totalShipments = shipments?.length || 0;
    const totalRevenue =
      shipments?.reduce((sum: number, s: any) => sum + (parseFloat(s.final_price) || 0), 0) || 0;

    // Conta sotto-admin per livello
    const subAdminsByLevel: Record<number, number> = {};
    if (allSubAdmins) {
      allSubAdmins.forEach((admin: any) => {
        const level = admin.admin_level || 1;
        subAdminsByLevel[level] = (subAdminsByLevel[level] || 0) + 1;
      });
    }

    return {
      success: true,
      stats: {
        totalSubAdmins: allSubAdmins?.length || 0,
        totalShipments,
        totalRevenue,
        subAdminsByLevel,
      },
    };
  } catch (error: any) {
    console.error('Errore in getHierarchyStats:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Elimina (soft delete) un sotto-admin
 *
 * @param subAdminId - ID del sotto-admin da eliminare
 * @returns Oggetto con success e messaggio
 */
export async function deleteSubAdmin(subAdminId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    const parentEmail = context.actor.email;

    // 2. Ottieni parent ID
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', parentEmail)
      .single();

    if (parentError || !parent) {
      return {
        success: false,
        error: 'Utente non trovato.',
      };
    }

    // 3. Verifica che sia admin o superadmin
    if (!isAdminOrAbove(parent)) {
      return {
        success: false,
        error: 'Solo gli admin possono eliminare sotto-admin.',
      };
    }

    // 4. Verifica che il sotto-admin esista e sia figlio di questo admin
    const { data: subAdmin, error: subAdminError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, parent_admin_id, account_type')
      .eq('id', subAdminId)
      .single();

    if (subAdminError || !subAdmin) {
      return {
        success: false,
        error: 'Sotto-admin non trovato.',
      };
    }

    // Superadmin può eliminare chiunque, admin solo i propri figli
    if (!isSuperAdminCheck(parent) && subAdmin.parent_admin_id !== parent.id) {
      return {
        success: false,
        error: 'Non puoi eliminare un sotto-admin che non hai creato.',
      };
    }

    // 5. Soft delete: imposta account_type a 'deleted' o elimina
    // Per sicurezza facciamo soft delete impostando un flag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        account_type: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subAdminId);

    if (updateError) {
      console.error('Errore eliminazione sotto-admin:', updateError);
      return {
        success: false,
        error: "Errore durante l'eliminazione.",
      };
    }

    // 6. Log audit (workspace-scoped)
    const wsId = await getUserWorkspaceId(parent.id);
    const auditDb = wsId ? workspaceQuery(wsId) : supabaseAdmin;
    await auditDb.from('audit_logs').insert({
      action: 'SUBADMIN_DELETED',
      resource_type: 'user',
      resource_id: subAdminId,
      user_id: parent.id,
      workspace_id: wsId,
      metadata: {
        deleted_user_email: subAdmin.email,
        deleted_user_name: subAdmin.name,
        deleted_by: parentEmail,
      },
      severity: 'warning',
      message: `Sotto-admin ${subAdmin.name} eliminato da ${parentEmail}`,
    });

    return {
      success: true,
      message: `Sotto-admin ${subAdmin.name} eliminato con successo.`,
    };
  } catch (error: any) {
    console.error('Errore in deleteSubAdmin:', error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto durante l'eliminazione.",
    };
  }
}
