"use server";

/**
 * Server Actions per Gestione Configurazioni Corrieri
 *
 * CRUD completo per configurazioni API corrieri gestite dinamicamente.
 * Solo gli admin possono eseguire queste operazioni.
 */

import { auth } from "@/lib/auth-config";
import { findUserByEmail } from "@/lib/database";
import { supabaseAdmin } from "@/lib/db/client";
import { logAuditEvent } from "@/lib/security/audit-log";
import {
  decryptCredential,
  encryptCredential,
  isEncrypted,
} from "@/lib/security/encryption";

// Tipi per le configurazioni
export interface CourierConfigInput {
  id?: string; // Se presente, è un update
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>; // Es: { "poste": "CODE123", "gls": "CODE456" }
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
  notes?: string;
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
  status?: "active" | "error" | "testing" | "inactive";
  account_type?: "admin" | "byoc" | "reseller";
  owner_user_id?: string;
}

export interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  api_key: string; // ⚠️ In produzione, considerare mascherare o non esporre
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
  status?: "active" | "error" | "testing" | "inactive";
  last_tested_at?: string;
  test_result?: {
    success: boolean;
    error?: string;
    tested_at: string;
    response_time_ms?: number;
  };
  account_type?: "admin" | "byoc" | "reseller";
  owner_user_id?: string;
  // Automation (già esistenti da migration 015)
  automation_enabled?: boolean;
  automation_settings?: any;
  session_data?: any;
  last_automation_sync?: string;
  automation_encrypted?: boolean;
}

/**
 * Verifica se l'utente corrente è admin
 */
async function verifyAdminAccess(): Promise<{
  isAdmin: boolean;
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { isAdmin: false, error: "Non autenticato" };
    }

    const user = await findUserByEmail(session.user.email);

    if (!user || user.role !== "admin") {
      return {
        isAdmin: false,
        error:
          "Accesso negato. Solo gli admin possono gestire le configurazioni.",
      };
    }

    return { isAdmin: true };
  } catch (error: any) {
    console.error("Errore verifica admin:", error);
    return {
      isAdmin: false,
      error: error.message || "Errore verifica permessi",
    };
  }
}

/**
 * Verifica se l'utente può gestire una configurazione
 *
 * ⚠️ RBAC:
 * - super_admin: sempre OK (può gestire tutte le config)
 * - reseller_admin: solo se owner_user_id === session.user.id (solo la propria config)
 * - admin: sempre OK (può gestire tutte le config)
 *
 * @param configOwnerUserId - owner_user_id della configurazione (opzionale, se null = config globale)
 * @returns Risultato verifica permessi
 */
async function verifyConfigAccess(configOwnerUserId: string | null): Promise<{
  canAccess: boolean;
  error?: string;
  userId?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { canAccess: false, error: "Non autenticato" };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { canAccess: false, error: "Utente non trovato" };
    }

    const userId = (user as any).id;
    const accountType = (user as any).account_type;
    const isReseller = (user as any).is_reseller === true;
    const resellerRole = (user as any).reseller_role;

    // 🔍 DEBUG LOG: Verifica permessi configurazione
    console.log("🔍 [verifyConfigAccess] Verifica permessi:", {
      userId,
      email: session.user.email,
      accountType,
      role: user.role,
      isReseller,
      resellerRole,
      configOwnerUserId,
    });

    // 1. Super Admin: sempre OK
    if (accountType === "superadmin" || user.role === "admin") {
      console.log("✅ [verifyConfigAccess] Accesso OK: Super Admin");
      return { canAccess: true, userId };
    }

    // 2. Reseller Admin: solo se owner_user_id === session.user.id
    if (isReseller && resellerRole === "admin") {
      if (!configOwnerUserId) {
        console.log(
          "❌ [verifyConfigAccess] Reseller Admin: config globale, accesso negato"
        );
        return {
          canAccess: false,
          error:
            "Accesso negato. I reseller admin possono gestire solo le proprie configurazioni.",
        };
      }
      if (configOwnerUserId !== userId) {
        console.log(
          "❌ [verifyConfigAccess] Reseller Admin: owner_user_id mismatch",
          { configOwnerUserId, userId }
        );
        return {
          canAccess: false,
          error: "Accesso negato. Puoi gestire solo le tue configurazioni.",
        };
      }
      console.log(
        "✅ [verifyConfigAccess] Accesso OK: Reseller Admin, owner match"
      );
      return { canAccess: true, userId };
    }

    // 3. Reseller User o altri: accesso negato
    console.log(
      "❌ [verifyConfigAccess] Accesso negato: né super_admin né reseller_admin",
      {
        isReseller,
        resellerRole,
      }
    );
    return {
      canAccess: false,
      error:
        "Accesso negato. Solo gli admin o reseller admin possono gestire le configurazioni.",
    };
  } catch (error: any) {
    console.error("Errore verifica accesso configurazione:", error);
    return {
      canAccess: false,
      error: error.message || "Errore verifica permessi",
    };
  }
}

/**
 * Server Action: Salva configurazione (Create o Update)
 *
 * @param data - Dati configurazione
 * @returns Risultato operazione
 */
export async function saveConfiguration(data: CourierConfigInput): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    const session = await auth();
    const adminEmail = session?.user?.email || "system";

    // 2. Validazione input
    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error:
          "Campi obbligatori mancanti: name, provider_id, api_key, base_url",
      };
    }

    // 3. Se è un update, verifica che la configurazione esista
    if (data.id) {
      const { data: existingConfig, error: fetchError } = await supabaseAdmin
        .from("courier_configs")
        .select("id")
        .eq("id", data.id)
        .single();

      if (fetchError || !existingConfig) {
        return {
          success: false,
          error: "Configurazione non trovata",
        };
      }
    }

    // 4. Se is_default = true, rimuovi default da altre config dello stesso provider
    if (data.is_default) {
      await supabaseAdmin
        .from("courier_configs")
        .update({ is_default: false })
        .eq("provider_id", data.provider_id)
        .neq("id", data.id || "00000000-0000-0000-0000-000000000000"); // Evita conflitto se è nuovo
    }

    // 5. Prepara dati per insert/update
    // ⚠️ SICUREZZA: Cripta credenziali sensibili prima di salvare
    const configData: any = {
      name: data.name,
      provider_id: data.provider_id,
      api_key: isEncrypted(data.api_key)
        ? data.api_key
        : encryptCredential(data.api_key),
      base_url: data.base_url,
      contract_mapping: data.contract_mapping || {},
      is_active: data.is_active ?? true,
      is_default: data.is_default ?? false,
      description: data.description || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
      // Integration Hub: nuovi campi (opzionali)
      ...(data.status && { status: data.status }),
      ...(data.account_type && { account_type: data.account_type }),
      ...(data.owner_user_id && { owner_user_id: data.owner_user_id }),
    };

    // Aggiungi api_secret se fornito (criptato)
    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret)
        ? data.api_secret
        : encryptCredential(data.api_secret);
    }

    // 6. Esegui insert o update
    let result;
    if (data.id) {
      // Update
      const { data: updatedConfig, error: updateError } = await supabaseAdmin
        .from("courier_configs")
        .update(configData)
        .eq("id", data.id)
        .select()
        .single();

      if (updateError) {
        console.error("Errore update configurazione:", updateError);
        return {
          success: false,
          error: updateError.message || "Errore durante l'aggiornamento",
        };
      }

      result = updatedConfig;

      // Audit log: credenziale aggiornata
      await logAuditEvent("credential_updated", "courier_config", data.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    } else {
      // Insert
      configData.created_by = adminEmail;
      const { data: newConfig, error: insertError } = await supabaseAdmin
        .from("courier_configs")
        .insert(configData)
        .select()
        .single();

      if (insertError) {
        console.error("Errore inserimento configurazione:", insertError);
        return {
          success: false,
          error: insertError.message || "Errore durante la creazione",
        };
      }

      result = newConfig;

      // Audit log: credenziale creata
      await logAuditEvent("credential_created", "courier_config", result.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    }

    console.log(
      `✅ Configurazione ${data.id ? "aggiornata" : "creata"}:`,
      result.id
    );

    return {
      success: true,
      config: result as CourierConfig,
    };
  } catch (error: any) {
    console.error("Errore saveConfiguration:", error);
    return {
      success: false,
      error: error.message || "Errore durante il salvataggio",
    };
  }
}

/**
 * Server Action: Salva configurazione personale (per utenti non-admin)
 *
 * Permette agli utenti di salvare la propria configurazione personale per Spedisci.Online.
 * La configurazione viene automaticamente assegnata all'utente corrente.
 *
 * @param data - Dati configurazione
 * @returns Risultato operazione
 */
export async function savePersonalConfiguration(
  data: Omit<CourierConfigInput, "is_default"> & { is_default?: never }
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // 2. Validazione input
    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error:
          "Campi obbligatori mancanti: name, provider_id, api_key, base_url",
      };
    }

    // 3. Trova o crea configurazione personale per questo utente
    // Recupera user_id, assigned_config_id e is_reseller direttamente da Supabase
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, assigned_config_id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (userError || !userData) {
      return { success: false, error: "Utente non trovato" };
    }

    // ⚠️ FIX CRITICO: Forza account_type corretto per reseller
    const isReseller = userData.is_reseller === true;
    const accountType = isReseller ? "reseller" : "byoc";

    console.log(
      `📋 [savePersonalConfiguration] User: ${session.user.email}, is_reseller: ${isReseller}, account_type: ${accountType}`
    );

    // 4. Prepara dati per insert/update
    // ⚠️ SICUREZZA: Cripta credenziali sensibili prima di salvare
    const configData: any = {
      name: data.name,
      provider_id: data.provider_id,
      api_key: isEncrypted(data.api_key)
        ? data.api_key
        : encryptCredential(data.api_key),
      base_url: data.base_url,
      contract_mapping: data.contract_mapping || {},
      is_active: data.is_active ?? true,
      is_default: false, // Mai default per configurazioni personali
      description: data.description || null,
      notes: data.notes || null,
      account_type: accountType, // ⚠️ FIX: Forza account_type corretto (reseller o byoc)
      owner_user_id: userData.id, // ⚠️ FIX: Associa config all'utente
      updated_at: new Date().toISOString(),
    };

    // Aggiungi api_secret se fornito (criptato)
    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret)
        ? data.api_secret
        : encryptCredential(data.api_secret);
    }

    // 5. Esegui Insert o Update
    // ⚠️ FIX: Rimuoviamo upsert per supportare MULTI-ACCOUNT
    // Se c'è un ID (update), aggiorniamo quello specifico.
    // Se non c'è ID, creiamo una NUOVA configurazione (anche se ne esiste già una per questo provider)

    configData.created_by = session.user.email;
    let result;

    if (data.id) {
      // Update esistente
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("courier_configs")
        .update(configData)
        .eq("id", data.id)
        .eq("owner_user_id", userData.id) // Sicurezza extra
        .select()
        .single();

      if (updateError) throw updateError;
      result = updated;
    } else {
      // Insert Nuovo
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("courier_configs")
        .insert(configData)
        .select()
        .single();

      if (insertError) throw insertError;
      result = inserted;
    }

    // Assegna automaticamente la configurazione all'utente (se non già assegnata o se è la prima)
    if (!userData.assigned_config_id) {
      await supabaseAdmin
        .from("users")
        .update({ assigned_config_id: result.id })
        .eq("id", userData.id);
    }

    console.log(`✅ Configurazione personale salvata (Multi-Account):`, {
      id: result.id,
      name: result.name,
      account_type: result.account_type,
      owner_user_id: result.owner_user_id,
      provider_id: result.provider_id,
      // 🔍 AUDIT: Log contract_mapping per debug cambio contratti
      contract_mapping_keys: Object.keys(result.contract_mapping || {}),
      contract_mapping_count: Object.keys(result.contract_mapping || {}).length,
    });

    // 🔍 AUDIT: Log dettagliato contract_mapping (solo in development)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `💾 [SAVE] Contract mapping dettaglio:`,
        result.contract_mapping
      );
    }

    return {
      success: true,
      config: result as CourierConfig,
    };
  } catch (error: any) {
    console.error("Errore savePersonalConfiguration:", error);
    return {
      success: false,
      error: error.message || "Errore durante il salvataggio",
    };
  }
}

/**
 * Server Action: Elimina configurazione personale (per utenti non-admin)
 *
 * Permette agli utenti di eliminare la propria configurazione personale.
 *
 * @param id - ID configurazione da eliminare
 * @returns Risultato operazione
 */
export async function deletePersonalConfiguration(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Verifica che la configurazione esista e appartenga all'utente
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("id, name, provider_id, created_by, is_default")
      .eq("id", id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // Verifica che la configurazione appartenga all'utente corrente
    if (config.created_by !== session.user.email) {
      return {
        success: false,
        error: "Non hai i permessi per eliminare questa configurazione",
      };
    }

    // Verifica ruolo reseller per eliminazione config default
    // Solo reseller_role = 'admin' può eliminare configurazioni default
    if (config.is_default) {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id, reseller_role, is_reseller")
        .eq("email", session.user.email)
        .single();

      // Se è un membro team (non admin), blocca eliminazione config default
      if (userData?.is_reseller && userData?.reseller_role !== "admin") {
        return {
          success: false,
          error:
            "Solo l'amministratore reseller può eliminare configurazioni default.",
        };
      }
    }

    // Rimuovi assegnazione dall'utente se presente
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, assigned_config_id")
      .eq("email", session.user.email)
      .single();

    if (userData?.assigned_config_id === id) {
      await supabaseAdmin
        .from("users")
        .update({ assigned_config_id: null })
        .eq("id", userData.id);
    }

    // Elimina configurazione
    const { error: deleteError } = await supabaseAdmin
      .from("courier_configs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Errore eliminazione configurazione personale:",
        deleteError
      );
      return {
        success: false,
        error: deleteError.message || "Errore durante l'eliminazione",
      };
    }

    console.log(`✅ Configurazione personale eliminata:`, id);

    return {
      success: true,
      message: "Configurazione eliminata con successo",
    };
  } catch (error: any) {
    console.error("Errore deletePersonalConfiguration:", error);
    return {
      success: false,
      error: error.message || "Errore durante l'eliminazione",
    };
  }
}

/**
 * Server Action: Elimina configurazione
 *
 * ⚠️ Verifica se la configurazione è in uso prima di eliminare
 *
 * @param id - ID configurazione da eliminare
 * @returns Risultato operazione
 */
export async function deleteConfiguration(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica se la configurazione esiste e recupera owner_user_id
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("id, name, provider_id, owner_user_id")
      .eq("id", id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // 2. Verifica permessi RBAC (super_admin o reseller_admin con owner_user_id match)
    const {
      canAccess,
      error: accessError,
      userId,
    } = await verifyConfigAccess(config.owner_user_id || null);
    if (!canAccess) {
      return { success: false, error: accessError };
    }

    // 3. Verifica se è in uso (assegnata ad utenti)
    const { data: usersUsingConfig, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("assigned_config_id", id)
      .limit(1);

    if (usersError) {
      console.error("Errore verifica utenti:", usersError);
    }

    if (usersUsingConfig && usersUsingConfig.length > 0) {
      return {
        success: false,
        error: `Impossibile eliminare: la configurazione è assegnata a ${usersUsingConfig.length} utente/i. 
                Rimuovi prima l'assegnazione agli utenti.`,
      };
    }

    // 4. Se è default, verifica permessi e se è l'unica configurazione
    if (config.provider_id) {
      const { data: defaultCheck } = await supabaseAdmin
        .from("courier_configs")
        .select("is_default")
        .eq("id", id)
        .single();

      if (defaultCheck?.is_default) {
        // Verifica ruolo reseller: solo admin può eliminare config default
        const session = await auth();
        if (session?.user?.email) {
          const { data: currentUser } = await supabaseAdmin
            .from("users")
            .select("id, reseller_role, is_reseller, account_type")
            .eq("email", session.user.email)
            .single();

          // Se è membro team reseller (non admin), blocca
          if (
            currentUser?.is_reseller &&
            currentUser?.reseller_role !== "admin" &&
            currentUser?.account_type !== "superadmin"
          ) {
            return {
              success: false,
              error:
                "Solo l'amministratore reseller può eliminare configurazioni default.",
            };
          }
        }

        // Se ha owner_user_id, è una configurazione personale - permetti eliminazione per admin
        if (config.owner_user_id) {
          console.log(
            "✅ Configurazione default personale eliminabile (owner_user_id presente, utente è admin)"
          );
        } else {
          // Configurazione globale (senza owner) - blocca eliminazione se è l'unica
          const { count: globalConfigCount } = await supabaseAdmin
            .from("courier_configs")
            .select("id", { count: "exact", head: true })
            .eq("provider_id", config.provider_id)
            .is("owner_user_id", null);

          if (globalConfigCount && globalConfigCount <= 1) {
            return {
              success: false,
              error:
                "Impossibile eliminare l'unica configurazione globale default.",
            };
          }
          console.log(
            "✅ Configurazione default globale eliminabile: esistono altre config"
          );
        }
      }
    }

    // 5. Elimina configurazione
    const { error: deleteError } = await supabaseAdmin
      .from("courier_configs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Errore eliminazione configurazione:", deleteError);
      return {
        success: false,
        error: deleteError.message || "Errore durante l'eliminazione",
      };
    }

    console.log(`✅ Configurazione eliminata:`, id);

    // Audit log: credenziale eliminata
    await logAuditEvent("credential_deleted", "courier_config", id, {
      provider_id: config.provider_id,
      name: config.name,
    });

    return {
      success: true,
      message: "Configurazione eliminata con successo",
    };
  } catch (error: any) {
    console.error("Errore deleteConfiguration:", error);
    return {
      success: false,
      error: error.message || "Errore durante l'eliminazione",
    };
  }
}

/**
 * Server Action: Aggiorna status attivo/inattivo di una configurazione
 *
 * @param id - ID configurazione
 * @param isActive - Nuovo stato (true = attiva, false = inattiva)
 * @returns Risultato operazione
 */
/**
 * Server Action: Rimuove contratto Spedisci.Online
 *
 * Rimuove un contratto dal contract_mapping
 * Utile quando un contratto non è più disponibile su Spedisci.Online
 */
export async function removeSpedisciOnlineContract(
  configId: string,
  contractCode: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // 1. Recupera configurazione
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // 2. Verifica permessi
    const { canAccess, error: accessError } = await verifyConfigAccess(
      config.owner_user_id || null
    );
    if (!canAccess) {
      return {
        success: false,
        error: accessError || "Accesso negato",
      };
    }

    // 3. Verifica che sia Spedisci.Online
    if (config.provider_id !== "spedisci_online") {
      return {
        success: false,
        error: "Questa funzione è solo per configurazioni Spedisci.Online",
      };
    }

    // 4. Recupera contract_mapping attuale
    let contractMapping: Record<string, string> = {};
    if (config.contract_mapping) {
      if (typeof config.contract_mapping === "string") {
        try {
          contractMapping = JSON.parse(config.contract_mapping);
        } catch {
          return {
            success: false,
            error: "Errore parsing contract_mapping",
          };
        }
      } else {
        contractMapping = config.contract_mapping as Record<string, string>;
      }
    }

    // 5. Rimuovi contratto
    if (contractMapping[contractCode]) {
      delete contractMapping[contractCode];
      console.log(`✅ Rimosso contratto: ${contractCode}`);
    } else {
      return {
        success: false,
        error: `Contratto "${contractCode}" non trovato nel mapping`,
      };
    }

    // 6. Aggiorna database
    const { error: updateError } = await supabaseAdmin
      .from("courier_configs")
      .update({
        contract_mapping: contractMapping,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (updateError) {
      console.error("❌ Errore rimozione contratto:", updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante rimozione",
      };
    }

    return {
      success: true,
      message: `Contratto "${contractCode}" rimosso con successo`,
    };
  } catch (error: any) {
    console.error("❌ Errore removeSpedisciOnlineContract:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}

/**
 * Server Action: Aggiorna contratto Spedisci.Online
 *
 * Rimuove un contratto vecchio e aggiunge un nuovo contratto per lo stesso corriere
 * Utile quando un contratto non è più disponibile su Spedisci.Online
 */
export async function updateSpedisciOnlineContract(
  configId: string,
  oldContractCode: string,
  newContractCode: string,
  courierName: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // 1. Recupera configurazione (per verificare owner_user_id)
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("*")
      .eq("id", configId)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // 2. Verifica permessi (reseller può modificare solo le proprie config)
    const { canAccess, error: accessError } = await verifyConfigAccess(
      config.owner_user_id || null
    );
    if (!canAccess) {
      return {
        success: false,
        error: accessError || "Accesso negato",
      };
    }

    // 3. Verifica che sia Spedisci.Online
    if (config.provider_id !== "spedisci_online") {
      return {
        success: false,
        error: "Questa funzione è solo per configurazioni Spedisci.Online",
      };
    }

    // 4. Recupera contract_mapping attuale
    let contractMapping: Record<string, string> = {};
    if (config.contract_mapping) {
      if (typeof config.contract_mapping === "string") {
        try {
          contractMapping = JSON.parse(config.contract_mapping);
        } catch {
          return {
            success: false,
            error: "Errore parsing contract_mapping",
          };
        }
      } else {
        contractMapping = config.contract_mapping as Record<string, string>;
      }
    }

    // 5. Rimuovi contratto vecchio
    if (contractMapping[oldContractCode]) {
      delete contractMapping[oldContractCode];
      console.log(`✅ Rimosso contratto vecchio: ${oldContractCode}`);
    } else {
      console.warn(
        `⚠️ Contratto vecchio non trovato nel mapping: ${oldContractCode}`
      );
    }

    // 6. Aggiungi nuovo contratto
    contractMapping[newContractCode] = courierName;
    console.log(
      `✅ Aggiunto nuovo contratto: ${newContractCode} -> ${courierName}`
    );

    // 7. Aggiorna database
    const { error: updateError } = await supabaseAdmin
      .from("courier_configs")
      .update({
        contract_mapping: contractMapping,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (updateError) {
      console.error("❌ Errore aggiornamento contratto:", updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante aggiornamento",
      };
    }

    return {
      success: true,
      message: `Contratto aggiornato: rimosso "${oldContractCode}", aggiunto "${newContractCode}"`,
    };
  } catch (error: any) {
    console.error("❌ Errore updateSpedisciOnlineContract:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}

export async function updateConfigurationStatus(
  id: string,
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica se la configurazione esiste e recupera owner_user_id
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("id, name, provider_id, owner_user_id")
      .eq("id", id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // 2. Verifica permessi RBAC (super_admin o reseller_admin con owner_user_id match)
    const { canAccess, error: accessError } = await verifyConfigAccess(
      config.owner_user_id || null
    );
    if (!canAccess) {
      return { success: false, error: accessError };
    }

    // 3. Aggiorna status
    const { error: updateError } = await supabaseAdmin
      .from("courier_configs")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Errore aggiornamento status configurazione:", updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante l'aggiornamento",
      };
    }

    // 4. AUTO-DISABLE LISTINI: Quando la config diventa inattiva,
    // disabilita automaticamente i listini associati per prevenire
    // l'uso di prezzi obsoleti o non più validi.
    if (!isActive) {
      try {
        // Trova listini con metadata.courier_config_id === id
        const { data: priceLists } = await supabaseAdmin
          .from("price_lists")
          .select("id, name, metadata, source_metadata")
          .eq("list_type", "supplier")
          .in("status", ["active", "draft"]);

        if (priceLists && priceLists.length > 0) {
          // Filtra listini di questa configurazione
          const listsToDisable = priceLists.filter((pl: any) => {
            const metadata = pl.metadata || pl.source_metadata || {};
            return metadata.courier_config_id === id;
          });

          if (listsToDisable.length > 0) {
            const listIds = listsToDisable.map((pl: any) => pl.id);
            
            const { error: disableError } = await supabaseAdmin
              .from("price_lists")
              .update({
                status: "archived",
                notes: `Listino archiviato automaticamente: configurazione "${config.name}" disattivata il ${new Date().toISOString()}`,
                updated_at: new Date().toISOString(),
              })
              .in("id", listIds);

            if (disableError) {
              console.warn("Errore disabilitazione listini:", disableError);
              // Non blocchiamo l'operazione principale
            } else {
              console.log(`✅ [AUTO-DISABLE] Archiviati ${listsToDisable.length} listini per config ${id.substring(0, 8)}...`);
            }
          }
        }
      } catch (listError: any) {
        console.warn("Errore durante auto-disable listini:", listError.message);
        // Non blocchiamo l'operazione principale
      }
    }

    // Audit log
    await logAuditEvent(
      isActive ? "credential_activated" : "credential_deactivated",
      "courier_config",
      id,
      {
        provider_id: config.provider_id,
        name: config.name,
        is_active: isActive,
      }
    );

    return {
      success: true,
      message: `Configurazione ${
        isActive ? "attivata" : "disattivata"
      } con successo`,
    };
  } catch (error: any) {
    console.error("Errore updateConfigurationStatus:", error);
    return {
      success: false,
      error: error.message || "Errore durante l'aggiornamento",
    };
  }
}

/**
 * Server Action: Imposta configurazione personale come default
 *
 * Permette agli utenti di impostare la propria configurazione come default.
 *
 * @param id - ID configurazione
 * @returns Risultato operazione
 */
export async function setPersonalConfigurationAsDefault(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Verifica che la configurazione esista e appartenga all'utente
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("id, name, provider_id, created_by")
      .eq("id", id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // Verifica che la configurazione appartenga all'utente corrente
    if (config.created_by !== session.user.email) {
      return {
        success: false,
        error: "Non hai i permessi per modificare questa configurazione",
      };
    }

    // Rimuovi default da altre configurazioni dello stesso provider
    await supabaseAdmin
      .from("courier_configs")
      .update({ is_default: false })
      .eq("provider_id", config.provider_id)
      .neq("id", id);

    // Imposta questa configurazione come default
    const { error: updateError } = await supabaseAdmin
      .from("courier_configs")
      .update({
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Errore impostazione default:", updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante l'aggiornamento",
      };
    }

    console.log(`✅ Configurazione impostata come default:`, id);

    return {
      success: true,
      message: "Configurazione impostata come default con successo",
    };
  } catch (error: any) {
    console.error("Errore setPersonalConfigurationAsDefault:", error);
    return {
      success: false,
      error: error.message || "Errore durante l'aggiornamento",
    };
  }
}

/**
 * Server Action: Assegna configurazione a utente
 *
 * @param userId - ID utente
 * @param configId - ID configurazione (null per rimuovere assegnazione)
 * @returns Risultato operazione
 */
export async function assignConfigurationToUser(
  userId: string,
  configId: string | null
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Verifica che l'utente esista
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return {
        success: false,
        error: "Utente non trovato",
      };
    }

    // 3. Se configId è fornito, verifica che la configurazione esista e sia attiva
    if (configId) {
      const { data: config, error: configError } = await supabaseAdmin
        .from("courier_configs")
        .select("id, is_active")
        .eq("id", configId)
        .single();

      if (configError || !config) {
        return {
          success: false,
          error: "Configurazione non trovata",
        };
      }

      if (!config.is_active) {
        return {
          success: false,
          error: "Impossibile assegnare una configurazione inattiva",
        };
      }
    }

    // 4. Aggiorna utente
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ assigned_config_id: configId })
      .eq("id", userId);

    if (updateError) {
      console.error("Errore assegnazione configurazione:", updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante l'assegnazione",
      };
    }

    console.log(
      `✅ Configurazione ${configId ? "assegnata" : "rimossa"} per utente:`,
      userId
    );

    return {
      success: true,
      message: configId
        ? "Configurazione assegnata con successo"
        : "Assegnazione rimossa con successo",
    };
  } catch (error: any) {
    console.error("Errore assignConfigurationToUser:", error);
    return {
      success: false,
      error: error.message || "Errore durante l'assegnazione",
    };
  }
}

/**
 * Server Action: Lista tutte le configurazioni (solo admin)
 *
 * @returns Lista configurazioni
 */
export async function listConfigurations(): Promise<{
  success: boolean;
  configs?: CourierConfig[];
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isAdmin = user.role === "admin";
    const isReseller = (user as any).is_reseller === true;

    // 2. Costruisci query con filtro RBAC
    // ⚠️ RBAC:
    // - Admin: vede tutte le configurazioni (globali + personali)
    // - Reseller: vede SOLO la propria configurazione personale (created_by = email)
    let query = supabaseAdmin
      .from("courier_configs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      // ⚠️ RBAC: Reseller e utenti normali vedono SOLO la propria configurazione
      query = query.eq("created_by", session.user.email);
    }
    // Admin vedono TUTTO (nessun filtro)

    // 3. Esegui query
    const { data: configs, error: fetchError } = await query;

    if (fetchError) {
      console.error("Errore recupero configurazioni:", fetchError);
      return {
        success: false,
        error: fetchError.message || "Errore durante il recupero",
      };
    }

    // ⚠️ SICUREZZA: NON esporre credenziali in chiaro al frontend
    // Maschera sempre api_key e api_secret
    const maskedConfigs = (configs || []).map((config: any) => {
      const masked: any = { ...config };

      // Mascheramento aggressivo: mostra solo ultimi 4 caratteri se possibile
      if (config.api_key) {
        masked.api_key =
          config.api_key.length > 4
            ? `...${config.api_key.slice(-4)}`
            : "********";
      }

      // Secret sempre completamente oscurato
      if (config.api_secret) {
        masked.api_secret = "********";
      }

      return masked;
    }) as CourierConfig[];

    return {
      success: true,
      configs: maskedConfigs,
    };
  } catch (error: any) {
    console.error("Errore listConfigurations:", error);
    return {
      success: false,
      error: error.message || "Errore durante il recupero",
    };
  }
}

/**
 * Server Action: Ottieni configurazione specifica (solo admin)
 *
 * @param id - ID configurazione
 * @returns Configurazione
 */
export async function getConfiguration(id: string): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Recupera configurazione
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("courier_configs")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: "Configurazione non trovata",
      };
    }

    // ⚠️ SICUREZZA: Decripta credenziali
    const decrypted: any = { ...config };
    try {
      if (config.api_key && isEncrypted(config.api_key)) {
        decrypted.api_key = decryptCredential(config.api_key);
      }
      if (config.api_secret && isEncrypted(config.api_secret)) {
        decrypted.api_secret = decryptCredential(config.api_secret);
      }
    } catch (error) {
      console.error("Errore decriptazione credenziali:", error);
    }

    // Audit log: credenziale visualizzata
    await logAuditEvent("credential_viewed", "courier_config", id);

    return {
      success: true,
      config: decrypted as CourierConfig,
    };
  } catch (error: any) {
    console.error("Errore getConfiguration:", error);
    return {
      success: false,
      error: error.message || "Errore durante il recupero",
    };
  }
}
