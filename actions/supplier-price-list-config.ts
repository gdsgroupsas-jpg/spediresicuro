/**
 * Server Actions: Supplier Price List Config
 * 
 * Gestione configurazioni manuali per sezioni listini fornitore:
 * - Assicurazione
 * - Contrassegni
 * - Servizi accessori
 * - Giacenze
 * - Ritiro
 * - Extra
 */

"use server";

import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import { getPriceListById } from "@/lib/db/price-lists";
import type {
  SupplierPriceListConfig,
  UpsertSupplierPriceListConfigInput,
} from "@/types/supplier-price-list-config";

/**
 * Recupera configurazione per un listino fornitore
 */
export async function getSupplierPriceListConfig(
  priceListId: string
): Promise<{
  success: boolean;
  config?: SupplierPriceListConfig;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    // Verifica che il listino esista e appartenga all'utente
    const priceList = await getPriceListById(priceListId);
    if (!priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isOwner = priceList.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Non hai i permessi per visualizzare questa configurazione",
      };
    }

    // Recupera configurazione
    const { data: config, error } = await supabaseAdmin
      .from("supplier_price_list_config")
      .select("*")
      .eq("price_list_id", priceListId)
      .maybeSingle();

    if (error) {
      console.error("Errore recupero configurazione:", error);
      return { success: false, error: error.message };
    }

    // Se non esiste, restituisci struttura vuota
    if (!config) {
      // Estrai carrier_code e contract_code dai metadata del listino
      const metadata = priceList.metadata || priceList.source_metadata || {};
      const carrierCode = metadata.carrier_code || "";
      const contractCode = metadata.contract_code || "";
      const courierConfigId = metadata.courier_config_id || null;

      return {
        success: true,
        config: {
          id: "",
          price_list_id: priceListId,
          carrier_code: carrierCode,
          contract_code: contractCode || undefined,
          courier_config_id: courierConfigId || undefined,
          insurance_config: {
            max_value: 0,
            fixed_price: 0,
            percent: 0,
            percent_on: "totale",
          },
          cod_config: [],
          accessory_services_config: [],
          storage_config: {
            services: [],
            dossier_opening_cost: 0,
          },
          pickup_config: [],
          extra_config: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    return { success: true, config: config as SupplierPriceListConfig };
  } catch (error: any) {
    console.error("Errore recupero configurazione:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Crea o aggiorna configurazione per un listino fornitore
 */
export async function upsertSupplierPriceListConfig(
  input: UpsertSupplierPriceListConfigInput
): Promise<{
  success: boolean;
  config?: SupplierPriceListConfig;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    // Verifica permessi
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo admin, reseller e BYOC possono configurare listini fornitore",
      };
    }

    // Verifica che il listino esista e appartenga all'utente
    const priceList = await getPriceListById(input.price_list_id);
    if (!priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    const isOwner = priceList.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Non hai i permessi per modificare questa configurazione",
      };
    }

    // Verifica che sia un listino fornitore
    if (priceList.list_type !== "supplier") {
      return {
        success: false,
        error: "Le configurazioni manuali sono disponibili solo per listini fornitore",
      };
    }

    // Estrai carrier_code e contract_code se non forniti
    const metadata = priceList.metadata || priceList.source_metadata || {};
    const carrierCode =
      input.carrier_code || metadata.carrier_code || "";
    const contractCode =
      input.contract_code || metadata.contract_code || undefined;
    const courierConfigId =
      input.courier_config_id || metadata.courier_config_id || undefined;

    if (!carrierCode) {
      return {
        success: false,
        error: "carrier_code è obbligatorio",
      };
    }

    // Prepara dati per upsert
    const configData: any = {
      price_list_id: input.price_list_id,
      carrier_code: carrierCode,
      contract_code: contractCode || null,
      courier_config_id: courierConfigId || null,
      notes: input.notes || null,
    };

    // Aggiungi configurazioni solo se fornite (per partial update)
    if (input.insurance_config) {
      configData.insurance_config = {
        max_value: input.insurance_config.max_value ?? 0,
        fixed_price: input.insurance_config.fixed_price ?? 0,
        percent: input.insurance_config.percent ?? 0,
        percent_on: input.insurance_config.percent_on || "totale",
      };
    }

    if (input.cod_config !== undefined) {
      configData.cod_config = input.cod_config;
    }

    if (input.accessory_services_config !== undefined) {
      configData.accessory_services_config = input.accessory_services_config;
    }

    if (input.storage_config) {
      configData.storage_config = {
        services: input.storage_config.services || [],
        dossier_opening_cost:
          input.storage_config.dossier_opening_cost ?? 0,
      };
    }

    if (input.pickup_config !== undefined) {
      configData.pickup_config = input.pickup_config;
    }

    if (input.extra_config !== undefined) {
      configData.extra_config = input.extra_config;
    }

    // Upsert diretto (RLS gestisce i permessi)
    const { data: existingConfig } = await supabaseAdmin
      .from("supplier_price_list_config")
      .select("id")
      .eq("price_list_id", input.price_list_id)
      .maybeSingle();

    if (existingConfig) {
      // Update
      const { data: updatedConfig, error } = await supabaseAdmin
        .from("supplier_price_list_config")
        .update({
          carrier_code: configData.carrier_code,
          contract_code: configData.contract_code || null,
          courier_config_id: configData.courier_config_id || null,
          insurance_config: configData.insurance_config || undefined,
          cod_config: configData.cod_config || undefined,
          accessory_services_config:
            configData.accessory_services_config || undefined,
          storage_config: configData.storage_config || undefined,
          pickup_config: configData.pickup_config || undefined,
          extra_config: configData.extra_config || undefined,
          notes: configData.notes || null,
          updated_by: user.id,
        })
        .eq("id", existingConfig.id)
        .select()
        .single();

      if (error) {
        console.error("Errore update configurazione:", error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        config: updatedConfig as SupplierPriceListConfig,
      };
    } else {
      // Insert
      const { data: newConfig, error } = await supabaseAdmin
        .from("supplier_price_list_config")
        .insert({
          price_list_id: configData.price_list_id,
          carrier_code: configData.carrier_code,
          contract_code: configData.contract_code || null,
          courier_config_id: configData.courier_config_id || null,
          insurance_config: configData.insurance_config || {},
          cod_config: configData.cod_config || [],
          accessory_services_config: configData.accessory_services_config || [],
          storage_config: configData.storage_config || {
            services: [],
            dossier_opening_cost: 0,
          },
          pickup_config: configData.pickup_config || [],
          extra_config: configData.extra_config || {},
          notes: configData.notes || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Errore insert configurazione:", error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        config: newConfig as SupplierPriceListConfig,
      };
    }

    if (error) {
      console.error("Errore upsert configurazione:", error);
      return { success: false, error: error.message };
    }

    // Recupera configurazione aggiornata
    const { data: updatedConfig, error: fetchError } = await supabaseAdmin
      .from("supplier_price_list_config")
      .select("*")
      .eq("price_list_id", input.price_list_id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    return {
      success: true,
      config: updatedConfig as SupplierPriceListConfig,
    };
  } catch (error: any) {
    console.error("Errore upsert configurazione:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Elimina configurazione per un listino fornitore
 */
export async function deleteSupplierPriceListConfig(
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
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    // Verifica che il listino esista e appartenga all'utente
    const priceList = await getPriceListById(priceListId);
    if (!priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isOwner = priceList.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Non hai i permessi per eliminare questa configurazione",
      };
    }

    const { error } = await supabaseAdmin
      .from("supplier_price_list_config")
      .delete()
      .eq("price_list_id", priceListId);

    if (error) {
      console.error("Errore eliminazione configurazione:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Errore eliminazione configurazione:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Lista tutte le configurazioni dell'utente corrente
 */
export async function listSupplierPriceListConfigs(): Promise<{
  success: boolean;
  configs?: SupplierPriceListConfig[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";

    // Se non è admin, recupera solo i price_list_id dell'utente
    let priceListIds: string[] = [];
    if (!isAdmin) {
      const { data: userPriceLists } = await supabaseAdmin
        .from("price_lists")
        .select("id")
        .eq("created_by", user.id);
      priceListIds = userPriceLists?.map((pl) => pl.id) || [];
    }

    let query = supabaseAdmin
      .from("supplier_price_list_config")
      .select("*")
      .order("updated_at", { ascending: false });

    // Se non è admin, filtra per listini dell'utente
    if (!isAdmin && priceListIds.length > 0) {
      query = query.in("price_list_id", priceListIds);
    } else if (!isAdmin) {
      // Se l'utente non ha listini, restituisci array vuoto
      return { success: true, configs: [] };
    }

    const { data: configs, error } = await query;

    if (error) {
      console.error("Errore lista configurazioni:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      configs: (configs || []) as SupplierPriceListConfig[],
    };
  } catch (error: any) {
    console.error("Errore lista configurazioni:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

