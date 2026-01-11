/**
 * Server Actions: Reseller Price Lists Management
 * 
 * Gestione listini personalizzati per reseller con funzionalità enterprise:
 * - Clonazione listini supplier con margini personalizzati
 * - Assegnazione listini a sub-users
 * - Modifica completa di listini personalizzati
 * - Import CSV per completamento manuale
 */

"use server";

import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import { assertValidUserId } from "@/lib/validators";
import type { PriceList } from "@/types/listini";

/**
 * Clona un listino supplier applicando margini personalizzati
 * 
 * @param sourcePriceListId - ID listino supplier da clonare
 * @param newName - Nome del nuovo listino personalizzato
 * @param marginType - Tipo margine: 'percent' | 'fixed' | 'none'
 * @param marginValue - Valore margine (percentuale o fisso)
 * @param description - Descrizione opzionale
 * @returns Listino creato con statistiche
 */
export async function resellerCloneSupplierPriceListAction(
  sourcePriceListId: string,
  newName: string,
  marginType: "percent" | "fixed" | "none",
  marginValue: number = 0,
  description?: string
): Promise<{
  success: boolean;
  priceListId?: string;
  entryCount?: number;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera utente per verifica
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller, account_type")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: "Non autorizzato: solo reseller e admin possono clonare listini",
      };
    }

    // Valida margini
    if (marginType === "percent" && marginValue < -100) {
      return {
        success: false,
        error: "Il margine percentuale non può essere inferiore a -100%",
      };
    }

    if (marginType === "fixed" && marginValue < 0) {
      return {
        success: false,
        error: "Il margine fisso non può essere negativo",
      };
    }

    // Chiama la funzione DB per clonazione
    const { data, error } = await supabaseAdmin.rpc("reseller_clone_supplier_price_list", {
      p_source_id: sourcePriceListId,
      p_new_name: newName,
      p_margin_type: marginType,
      p_margin_value: marginValue,
      p_description: description || null,
      p_caller_id: user.id, // ✨ FIX: Passa caller_id per supportare service_role
    });

    if (error) {
      console.error("Errore clonazione listino:", error);
      return {
        success: false,
        error: error.message || "Errore durante la clonazione del listino",
      };
    }

    const result = data as any;
    const clonedPriceListId = result.price_list_id;

    // Logga evento audit per listino clonato
    if (clonedPriceListId) {
      try {
        await supabaseAdmin.rpc("log_price_list_event", {
          p_event_type: "price_list_cloned",
          p_price_list_id: clonedPriceListId,
          p_actor_id: user.id,
          p_message: `Listino clonato da ${sourcePriceListId}. Margine: ${marginType} ${marginValue}`,
          p_metadata: {
            source_price_list_id: sourcePriceListId,
            margin_type: marginType,
            margin_value: marginValue,
            entry_count: result.entry_count || 0,
          },
          p_severity: "info",
        });
      } catch (logError) {
        console.error("Errore logging clone:", logError);
      }
    }

    return {
      success: true,
      priceListId: clonedPriceListId,
      entryCount: result.entry_count,
    };
  } catch (error: any) {
    console.error("Errore resellerCloneSupplierPriceListAction:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}

/**
 * Assegna un listino personalizzato a un sub-user
 * 
 * @param priceListId - ID listino personalizzato
 * @param userId - ID sub-user a cui assegnare
 * @param notes - Note opzionali
 * @returns Assegnazione creata
 */
export async function resellerAssignPriceListAction(
  priceListId: string,
  userId: string,
  notes?: string
): Promise<{
  success: boolean;
  assignmentId?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera utente per verifica
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user || !user.is_reseller) {
      return {
        success: false,
        error: "Non autorizzato: solo reseller possono assegnare listini",
      };
    }

    // Valida userId
    assertValidUserId(userId);
    assertValidUserId(priceListId);

    // Chiama la funzione DB per assegnazione
    const { data, error } = await supabaseAdmin.rpc("reseller_assign_price_list", {
      p_price_list_id: priceListId,
      p_user_id: userId,
      p_notes: notes || null,
      p_caller_id: user.id, // ✨ FIX: Passa caller_id per supportare service_role
    });

    if (error) {
      console.error("Errore assegnazione listino:", error);
      return {
        success: false,
        error: error.message || "Errore durante l'assegnazione del listino",
      };
    }

    return {
      success: true,
      assignmentId: data as string,
    };
  } catch (error: any) {
    console.error("Errore resellerAssignPriceListAction:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}

/**
 * Ottieni la lista dei sub-users del reseller
 * 
 * @returns Array di sub-users
 */
export async function getResellerSubUsersAction(): Promise<{
  success: boolean;
  subUsers?: Array<{
    id: string;
    email: string;
    name?: string;
  }>;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user || !user.is_reseller) {
      return {
        success: false,
        error: "Non autorizzato: solo reseller possono vedere sub-users",
      };
    }

    // Recupera sub-users (utenti con parent_reseller_id = user.id)
    const { data: subUsers, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("parent_reseller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore recupero sub-users:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      subUsers: subUsers || [],
    };
  } catch (error: any) {
    console.error("Errore getResellerSubUsersAction:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Ottieni lista listini supplier del reseller
 * 
 * @returns Array di listini supplier clonabili
 */
export async function getResellerSupplierPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: PriceList[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller, account_type")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: "Non autorizzato",
      };
    }

    // Recupera listini supplier creati dal reseller
    const query = supabaseAdmin
      .from("price_lists")
      .select("*")
      .eq("list_type", "supplier");

    if (isReseller && !isAdmin) {
      // Reseller vede solo i propri listini supplier
      query.eq("created_by", user.id);
    }

    const { data: priceLists, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Errore recupero listini supplier:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      priceLists: (priceLists || []) as PriceList[],
    };
  } catch (error: any) {
    console.error("Errore getResellerSupplierPriceListsAction:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Aggiorna margine di un listino personalizzato
 * 
 * @param priceListId - ID listino
 * @param marginType - Tipo margine
 * @param marginValue - Valore margine
 * @returns Listino aggiornato
 */
export async function updateResellerPriceListMarginAction(
  priceListId: string,
  marginType: "percent" | "fixed" | "none",
  marginValue: number = 0
): Promise<{
  success: boolean;
  priceList?: PriceList;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user || !user.is_reseller) {
      return {
        success: false,
        error: "Non autorizzato: solo reseller possono modificare margini",
      };
    }

    // Valida margini
    if (marginType === "percent" && marginValue < -100) {
      return {
        success: false,
        error: "Il margine percentuale non può essere inferiore a -100%",
      };
    }

    if (marginType === "fixed" && marginValue < 0) {
      return {
        success: false,
        error: "Il margine fisso non può essere negativo",
      };
    }

    // Aggiorna margine sul listino
    const { data: priceList, error } = await supabaseAdmin
      .from("price_lists")
      .update({
        default_margin_percent:
          marginType === "percent" ? marginValue : null,
        default_margin_fixed: marginType === "fixed" ? marginValue : null,
        updated_at: new Date().toISOString(),
        metadata: supabaseAdmin.raw(
          `jsonb_set(metadata, '{margin_type}', '${marginType}')`
        ),
      })
      .eq("id", priceListId)
      .eq("created_by", user.id) // Solo propri listini
      .eq("list_type", "custom")
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento margine:", error);
      return { success: false, error: error.message };
    }

    return { success: true, priceList: priceList as PriceList };
  } catch (error: any) {
    console.error("Errore updateResellerPriceListMarginAction:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Attiva un listino personalizzato
 * 
 * @param priceListId - ID listino
 * @returns Listino attivato
 */
export async function activateResellerPriceListAction(
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user || !user.is_reseller) {
      return {
        success: false,
        error: "Non autorizzato",
      };
    }

    // Verifica che il listino esista e sia del reseller
    const { data: priceList } = await supabaseAdmin
      .from("price_lists")
      .select("id, list_type")
      .eq("id", priceListId)
      .eq("created_by", user.id)
      .eq("list_type", "custom")
      .single();

    if (!priceList) {
      return {
        success: false,
        error: "Listino non trovato o non autorizzato",
      };
    }

    // Attiva listino
    const { error } = await supabaseAdmin
      .from("price_lists")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", priceListId);

    if (error) {
      console.error("Errore attivazione listino:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Errore activateResellerPriceListAction:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Importa entries da CSV per un listino personalizzato
 * 
 * @param priceListId - ID listino
 * @param entries - Array di entries da importare
 * @returns Statistiche importazione
 */
export async function importPriceListEntriesAction(
  priceListId: string,
  entries: Array<{
    weight_from: number;
    weight_to: number;
    zone_code?: string;
    zip_code_from?: string;
    zip_code_to?: string;
    province_code?: string;
    region?: string;
    service_type?: string;
    base_price: number;
    fuel_surcharge_percent?: number;
    island_surcharge?: number;
    ztl_surcharge?: number;
    cash_on_delivery_surcharge?: number;
    insurance_rate_percent?: number;
    estimated_delivery_days_min?: number;
    estimated_delivery_days_max?: number;
  }>
): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user || !user.is_reseller) {
      return {
        success: false,
        error: "Non autorizzato: solo reseller possono importare entries",
      };
    }

    // Verifica che il listino esista e sia del reseller
    const { data: priceList } = await supabaseAdmin
      .from("price_lists")
      .select("id, list_type")
      .eq("id", priceListId)
      .eq("created_by", user.id)
      .eq("list_type", "custom")
      .single();

    if (!priceList) {
      return {
        success: false,
        error: "Listino non trovato o non autorizzato",
      };
    }

    // Importa entries usando la funzione esistente
    const { upsertPriceListEntries } = await import("@/lib/db/price-lists");
    const result = await upsertPriceListEntries(priceListId, entries);

    // Logga evento audit
    try {
      await supabaseAdmin.rpc("log_price_list_event", {
        p_event_type: "price_list_entry_imported",
        p_price_list_id: priceListId,
        p_actor_id: user.id,
        p_message: `Importate ${result.inserted || 0} entries, aggiornate ${result.updated || 0}`,
        p_metadata: {
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          skipped: result.skipped || 0,
          total_entries: entries.length,
        },
        p_severity: "info",
      });
    } catch (logError) {
      // Non bloccare l'operazione se il logging fallisce
      console.error("Errore logging import entries:", logError);
    }

    return {
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
    };
  } catch (error: any) {
    console.error("Errore importPriceListEntriesAction:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}
