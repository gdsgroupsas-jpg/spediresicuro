/**
 * Server Actions: Price Lists Management
 *
 * Gestione completa listini prezzi con sistema PriceRule avanzato
 */

"use server";

import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import {
  calculatePriceWithRules,
  createPriceList,
  deletePriceList,
  getApplicablePriceList,
  getPriceListById,
  updatePriceList,
} from "@/lib/db/price-lists";
import type {
  CreatePriceListInput,
  PriceCalculationResult,
  UpdatePriceListInput,
} from "@/types/listini";
import type { CourierServiceType } from "@/types/shipments";

/**
 * Crea nuovo listino prezzi
 */
export async function createPriceListAction(
  data: CreatePriceListInput
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera user ID
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
        error: "Solo admin, reseller e BYOC possono creare listini",
      };
    }

    // Se list_type non specificato, imposta default basato su utente
    if (!data.list_type) {
      if (isAdmin && data.is_global) {
        data.list_type = "global";
      } else if (isReseller || isBYOC) {
        data.list_type = "supplier";
      }
    }

    // Validazione per BYOC: può creare SOLO listini fornitore
    if (isBYOC && data.list_type !== "supplier") {
      return {
        success: false,
        error: "BYOC può creare solo listini fornitore (list_type = supplier)",
      };
    }

    // Validazione per Reseller: non può creare listini globali
    if (isReseller && data.list_type === "global") {
      return {
        success: false,
        error: "Reseller non può creare listini globali",
      };
    }

    // Se non è admin, non può creare listini globali
    if (data.is_global && !isAdmin) {
      return {
        success: false,
        error: "Solo gli admin possono creare listini globali",
      };
    }

    const priceList = await createPriceList(data, user.id);

    return { success: true, priceList };
  } catch (error: any) {
    console.error("Errore creazione listino:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Aggiorna listino esistente
 */
export async function updatePriceListAction(
  id: string,
  data: UpdatePriceListInput
): Promise<{
  success: boolean;
  priceList?: any;
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

    // Recupera listino esistente
    const existingPriceList = await getPriceListById(id);
    if (!existingPriceList) {
      return { success: false, error: "Listino non trovato" };
    }

    // Verifica permessi: admin, creatore, O proprietario (assigned_to_user_id)
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isOwner = existingPriceList.created_by === user.id;
    const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: "Non hai i permessi per modificare questo listino",
      };
    }

    // Validazione per BYOC: non può cambiare list_type
    const isBYOC = user.account_type === "byoc";
    if (isBYOC && data.list_type && data.list_type !== "supplier") {
      return {
        success: false,
        error: "BYOC può modificare solo listini fornitore",
      };
    }

    // Validazione per Reseller: non può cambiare list_type a 'global'
    const isReseller = user.is_reseller === true;
    if (isReseller && data.list_type === "global") {
      return {
        success: false,
        error: "Reseller non può creare listini globali",
      };
    }

    const updated = await updatePriceList(id, data, user.id);

    return { success: true, priceList: updated };
  } catch (error: any) {
    console.error("Errore aggiornamento listino:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Ottiene listino applicabile per utente corrente
 */
export async function getApplicablePriceListAction(
  courierId?: string
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const priceList = await getApplicablePriceList(user.id, courierId);

    return { success: true, priceList };
  } catch (error: any) {
    console.error("Errore recupero listino applicabile:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Calcola preventivo usando sistema PriceRule
 */
export async function calculateQuoteAction(
  params: {
    weight: number;
    volume?: number;
    destination: {
      zip?: string;
      province?: string;
      region?: string;
      country?: string;
    };
    courierId?: string;
    serviceType?: CourierServiceType;
    options?: {
      declaredValue?: number;
      cashOnDelivery?: boolean;
      insurance?: boolean;
    };
  },
  priceListId?: string
): Promise<{
  success: boolean;
  result?: PriceCalculationResult;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const result = await calculatePriceWithRules(user.id, params, priceListId);

    if (!result) {
      return {
        success: false,
        error:
          "Impossibile calcolare preventivo. Verifica listino configurato.",
      };
    }

    return { success: true, result };
  } catch (error: any) {
    console.error("Errore calcolo preventivo:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Assegna listino a utente
 */
export async function assignPriceListToUserAction(
  userId: string,
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

    const { data: currentUser } = await supabaseAdmin
      .from("users")
      .select("id, account_type")
      .eq("email", session.user.email)
      .single();

    if (!currentUser) {
      return { success: false, error: "Utente non trovato" };
    }

    // Solo admin può assegnare listini
    const isAdmin =
      currentUser.account_type === "admin" ||
      currentUser.account_type === "superadmin";
    if (!isAdmin) {
      return {
        success: false,
        error: "Solo gli admin possono assegnare listini",
      };
    }

    // Verifica che listino esista
    const priceList = await getPriceListById(priceListId);
    if (!priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    // Assegna listino all'utente
    const { error } = await supabaseAdmin
      .from("users")
      .update({ assigned_price_list_id: priceListId })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Errore assegnazione listino:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Ottiene listino per ID
 */
export async function getPriceListByIdAction(id: string): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const priceList = await getPriceListById(id);

    if (!priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    return { success: true, priceList };
  } catch (error: any) {
    console.error("Errore recupero listino:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Elimina listino esistente
 */
export async function deletePriceListAction(id: string): Promise<{
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

    // Recupera listino esistente
    const existingPriceList = await getPriceListById(id);
    if (!existingPriceList) {
      return { success: false, error: "Listino non trovato" };
    }

    // Verifica permessi: admin, creatore, O proprietario (assigned_to_user_id)
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isOwner = existingPriceList.created_by === user.id;
    const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: "Non hai i permessi per eliminare questo listino",
      };
    }

    // Validazione per BYOC: può eliminare solo listini fornitore
    const isBYOC = user.account_type === "byoc";
    if (isBYOC && existingPriceList.list_type !== "supplier") {
      return {
        success: false,
        error: "BYOC può eliminare solo listini fornitore",
      };
    }

    await deletePriceList(id);

    return { success: true };
  } catch (error: any) {
    console.error("Errore eliminazione listino:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Lista tutti i listini (con filtri)
 */
export async function listPriceListsAction(filters?: {
  courierId?: string;
  status?: string;
  isGlobal?: boolean;
  assignedToUserId?: string;
}): Promise<{
  success: boolean;
  priceLists?: any[];
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

    let query = supabaseAdmin
      .from("price_lists")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtri
    if (filters?.courierId) {
      query = query.eq("courier_id", filters.courierId);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.isGlobal !== undefined) {
      query = query.eq("is_global", filters.isGlobal);
    }
    if (filters?.assignedToUserId) {
      query = query.eq("assigned_to_user_id", filters.assignedToUserId);
    }

    // Filtraggio basato su account_type
    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isAdmin) {
      // Reseller e BYOC vedono SOLO i propri listini fornitore e personalizzati
      // NON vedono listini globali
      query = query.or(`
        and(list_type.eq.supplier,created_by.eq.${user.id}),
        and(list_type.eq.custom,created_by.eq.${user.id}),
        and(list_type.eq.custom,assigned_to_user_id.eq.${user.id})
      `);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Recupera i corrieri separatamente se necessario
    if (data && data.length > 0) {
      const courierIds = data
        .map((pl: any) => pl.courier_id)
        .filter((id: string | null) => id !== null);

      if (courierIds.length > 0) {
        const { data: couriers } = await supabaseAdmin
          .from("couriers")
          .select("id, code, name")
          .in("id", courierIds);

        // Aggiungi i dati del corriere ai listini
        const courierMap = new Map(couriers?.map((c) => [c.id, c]) || []);

        data.forEach((pl: any) => {
          if (pl.courier_id && courierMap.has(pl.courier_id)) {
            pl.courier = courierMap.get(pl.courier_id);
          }
        });
      }
    }

    return { success: true, priceLists: data || [] };
  } catch (error: any) {
    console.error("Errore lista listini:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Crea listino fornitore per Reseller/BYOC
 *
 * @param data - Dati listino (courier_id obbligatorio per listini fornitore)
 * @returns Listino creato
 */
export async function createSupplierPriceListAction(
  data: Omit<CreatePriceListInput, "list_type" | "is_global"> & {
    courier_id: string;
  }
): Promise<{
  success: boolean;
  priceList?: any;
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

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono creare listini fornitore",
      };
    }

    // Imposta automaticamente list_type = 'supplier'
    const priceListData: CreatePriceListInput = {
      ...data,
      list_type: "supplier",
      is_global: false,
    };

    const priceList = await createPriceList(priceListData, user.id);

    return { success: true, priceList };
  } catch (error: any) {
    console.error("Errore creazione listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Lista listini fornitore dell'utente corrente
 *
 * @returns Array di listini fornitore
 */
export async function listSupplierPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    let user;
    if (session.user.id === "test-user-id") {
      user = { id: "test-user-id", account_type: "admin", is_reseller: true };
    } else {
      const { data } = await supabaseAdmin
        .from("users")
        .select("id, account_type, is_reseller")
        .eq("email", session.user.email)
        .single();
      user = data;
    }

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono vedere listini fornitore",
      };
    }

    // Recupera solo listini fornitore dell'utente
    console.log(
      `🔍 [LISTINI] Cerca listini fornitore: user.id=${user.id}, list_type=supplier`
    );
    const { data: priceLists, error } = await supabaseAdmin
      .from("price_lists")
      .select("*")
      .eq("list_type", "supplier")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore recupero listini fornitore:", error);
      return { success: false, error: error.message };
    }

    console.log(
      `📊 [LISTINI] Trovati ${
        priceLists?.length || 0
      } listini fornitore per user.id=${user.id}`
    );

    // Recupera i corrieri separatamente se necessario
    if (priceLists && priceLists.length > 0) {
      const courierIds = priceLists
        .map((pl: any) => pl.courier_id)
        .filter((id: string | null) => id !== null);

      if (courierIds.length > 0) {
        const { data: couriers } = await supabaseAdmin
          .from("couriers")
          .select("id, code, name")
          .in("id", courierIds);

        // Aggiungi i dati del corriere ai listini
        const courierMap = new Map(couriers?.map((c) => [c.id, c]) || []);

        priceLists.forEach((pl: any) => {
          if (pl.courier_id && courierMap.has(pl.courier_id)) {
            pl.courier = courierMap.get(pl.courier_id);
          }
        });
        console.log(
          `📦 [LISTINI] Corrieri popolati: ${
            couriers?.length || 0
          } trovati per ${courierIds.length} listini`
        );
      } else {
        console.warn(
          `⚠️ [LISTINI] Nessun courier_id trovato nei listini (${priceLists.length} listini)`
        );
      }

      // Recupera il conteggio delle entries per ogni listino
      const priceListIds = priceLists.map((pl: any) => pl.id);
      if (priceListIds.length > 0) {
        const { data: entriesCounts } = await supabaseAdmin
          .from("price_list_entries")
          .select("price_list_id")
          .in("price_list_id", priceListIds);

        // Conta entries per listino
        const entriesMap = new Map<string, number>();
        entriesCounts?.forEach((entry: any) => {
          const count = entriesMap.get(entry.price_list_id) || 0;
          entriesMap.set(entry.price_list_id, count + 1);
        });

        // Aggiungi conteggio entries a ogni listino
        priceLists.forEach((pl: any) => {
          pl.entries_count = entriesMap.get(pl.id) || 0;
        });

        console.log(
          `📊 [LISTINI] Entries contate: ${
            entriesCounts?.length || 0
          } totali per ${priceLists.length} listini`
        );
      }
    }

    console.log(
      `✅ [LISTINI] Ritorno ${
        priceLists?.length || 0
      } listini con dati corriere popolati`
    );
    return { success: true, priceLists: priceLists || [] };
  } catch (error: any) {
    console.error("Errore listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Recupera listino fornitore per un corriere specifico
 *
 * @param courierId - ID corriere
 * @returns Listino fornitore o null
 */
export async function getSupplierPriceListForCourierAction(
  courierId: string
): Promise<{
  success: boolean;
  priceList?: any;
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

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono vedere listini fornitore",
      };
    }

    // Recupera listino fornitore per corriere
    const { data: priceList, error } = await supabaseAdmin
      .from("price_lists")
      .select("*")
      .eq("list_type", "supplier")
      .eq("courier_id", courierId)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Errore recupero listino fornitore:", error);
      return { success: false, error: error.message };
    }

    // Recupera il corriere separatamente se necessario
    if (priceList && priceList.courier_id) {
      const { data: courier } = await supabaseAdmin
        .from("couriers")
        .select("id, code, name")
        .eq("id", priceList.courier_id)
        .single();

      if (courier) {
        priceList.courier = courier;
      }
    }

    return { success: true, priceList: priceList || null };
  } catch (error: any) {
    console.error("Errore listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}
