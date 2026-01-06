/**
 * Database Functions: Price Lists
 *
 * CRUD operations per listini prezzi corrieri
 */

import { calculatePriceFromList } from "@/lib/pricing/calculator";
import type {
  CreatePriceListInput,
  PriceList,
  PriceListEntry,
  UpdatePriceListInput,
} from "@/types/listini";
import { supabase, supabaseAdmin } from "./client";

// Re-export funzioni avanzate
export {
  calculatePriceWithRules,
  getApplicablePriceList,
} from "./price-lists-advanced";

/**
 * Crea nuovo listino
 */
export async function createPriceList(
  data: CreatePriceListInput,
  userId: string
): Promise<PriceList> {
  // Metadata ora esiste (migration 059 applicata), possiamo includerlo direttamente
  const { data: priceList, error } = await supabaseAdmin
    .from("price_lists")
    .insert({
      ...data,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating price list:", error);
    throw new Error(`Errore creazione listino: ${error.message}`);
  }

  return priceList as PriceList;
}

/**
 * Aggiorna listino esistente
 */
export async function updatePriceList(
  id: string,
  data: UpdatePriceListInput,
  userId: string
): Promise<PriceList> {
  const { data: priceList, error } = await supabaseAdmin
    .from("price_lists")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating price list:", error);
    throw new Error(`Errore aggiornamento listino: ${error.message}`);
  }

  return priceList as PriceList;
}

/**
 * Ottieni listino per ID
 */
export async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabaseAdmin
    .from("price_lists")
    .select("*, entries:price_list_entries(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching price list:", error);
    return null;
  }

  // Manual fetch for courier to avoid missing FK relationship error (PGRST200)
  if (data && data.courier_id) {
    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("*")
      .eq("id", data.courier_id)
      .single();

    if (courier) {
      (data as any).courier = courier;
    }
  }

  // Parse rules JSONB se presente
  if (data.rules && typeof data.rules === "string") {
    try {
      data.rules = JSON.parse(data.rules);
    } catch {
      data.rules = [];
    }
  }

  return data as PriceList;
}

/**
 * Lista listini per corriere
 */
export async function listPriceListsByCourier(courierId: string) {
  const { data, error } = await supabase
    .from("price_lists")
    .select("*, courier:couriers(*)")
    .eq("courier_id", courierId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing price lists:", error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Lista tutti i listini
 */
export async function listAllPriceLists() {
  const { data, error } = await supabase
    .from("price_lists")
    .select("*, courier:couriers(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing all price lists:", error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Ottieni listino attivo per corriere
 */
export async function getActivePriceList(
  courierId: string
): Promise<PriceList | null> {
  const now = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("price_lists")
    .select("*, entries:price_list_entries(*)")
    .eq("courier_id", courierId)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching active price list:", error);
    return null;
  }

  return data as PriceList;
}

/**
 * Aggiungi righe al listino
 * ⚠️ NOTA: Usa INSERT semplice, può creare duplicati se chiamato più volte
 */
export async function addPriceListEntries(
  priceListId: string,
  entries: Omit<PriceListEntry, "id" | "price_list_id" | "created_at">[]
): Promise<void> {
  const entriesWithListId = entries.map((entry) => ({
    ...entry,
    price_list_id: priceListId,
  }));

  const { error } = await supabaseAdmin
    .from("price_list_entries")
    .insert(entriesWithListId);

  if (error) {
    console.error("Error adding price list entries:", error);
    throw new Error(`Errore aggiunta righe listino: ${error.message}`);
  }
}

/**
 * ✨ NUOVO: Upsert righe al listino (INSERT o UPDATE se esiste già)
 * 
 * Previene duplicati verificando combinazione univoca:
 * price_list_id + zone_code + weight_from + weight_to + service_type
 * 
 * Se esiste già una entry con stessa combinazione:
 * - Aggiorna il prezzo e i supplementi con i nuovi valori
 * - Mantiene l'ID esistente (non crea duplicati)
 * 
 * @param priceListId - ID del listino
 * @param entries - Array di entries da aggiungere/aggiornare
 * @returns Statistiche: { inserted: number, updated: number, skipped: number }
 */
export async function upsertPriceListEntries(
  priceListId: string,
  entries: Omit<PriceListEntry, "id" | "price_list_id" | "created_at">[]
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
}> {
  const entriesWithListId = entries.map((entry) => ({
    ...entry,
    price_list_id: priceListId,
  }));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Processa entries in batch per evitare query eccessive
  const BATCH_SIZE = 100;
  for (let i = 0; i < entriesWithListId.length; i += BATCH_SIZE) {
    const batch = entriesWithListId.slice(i, i + BATCH_SIZE);

    // Per ogni entry, verifica se esiste già
    for (const entry of batch) {
      try {
        // Cerca entry esistente con stessa combinazione
        const { data: existing } = await supabaseAdmin
          .from("price_list_entries")
          .select("id, base_price")
          .eq("price_list_id", priceListId)
          .eq("zone_code", entry.zone_code || null)
          .eq("weight_from", entry.weight_from)
          .eq("weight_to", entry.weight_to)
          .eq("service_type", entry.service_type)
          .maybeSingle();

        if (existing) {
          // Entry esiste: verifica se il prezzo è cambiato
          const priceChanged = Math.abs(existing.base_price - entry.base_price) > 0.01;

          if (priceChanged) {
            // Prezzo diverso: aggiorna
            const { error: updateError } = await supabaseAdmin
              .from("price_list_entries")
              .update({
                base_price: entry.base_price,
                fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
                cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
                insurance_rate_percent: entry.insurance_rate_percent || 0,
                island_surcharge: entry.island_surcharge || 0,
                ztl_surcharge: entry.ztl_surcharge || 0,
                estimated_delivery_days_min: entry.estimated_delivery_days_min,
                estimated_delivery_days_max: entry.estimated_delivery_days_max,
              })
              .eq("id", existing.id);

            if (updateError) {
              console.warn(
                `⚠️ [UPSERT] Errore aggiornamento entry ${existing.id}:`,
                updateError.message
              );
              skipped++;
            } else {
              updated++;
            }
          } else {
            // Prezzo identico: skip (evita update inutile)
            skipped++;
          }
        } else {
          // Entry non esiste: inserisci nuova
          const { error: insertError } = await supabaseAdmin
            .from("price_list_entries")
            .insert(entry);

          if (insertError) {
            // Se errore per duplicato (race condition), prova update
            if (
              insertError.code === "23505" ||
              insertError.message?.includes("duplicate") ||
              insertError.message?.includes("unique")
            ) {
              // Race condition: entry creata da altro processo, prova update
              const { data: raceExisting } = await supabaseAdmin
                .from("price_list_entries")
                .select("id")
                .eq("price_list_id", priceListId)
                .eq("zone_code", entry.zone_code || null)
                .eq("weight_from", entry.weight_from)
                .eq("weight_to", entry.weight_to)
                .eq("service_type", entry.service_type)
                .maybeSingle();

              if (raceExisting) {
                await supabaseAdmin
                  .from("price_list_entries")
                  .update({
                    base_price: entry.base_price,
                    fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
                    cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
                    insurance_rate_percent: entry.insurance_rate_percent || 0,
                  })
                  .eq("id", raceExisting.id);
                updated++;
              } else {
                console.warn(
                  `⚠️ [UPSERT] Errore insert e update fallito per entry:`,
                  insertError.message
                );
                skipped++;
              }
            } else {
              console.warn(
                `⚠️ [UPSERT] Errore insert entry:`,
                insertError.message
              );
              skipped++;
            }
          } else {
            inserted++;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [UPSERT] Errore processamento entry:`, err.message);
        skipped++;
      }
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Calcola prezzo per spedizione
 */
export async function calculatePrice(
  courierId: string,
  weight: number,
  destinationZip: string,
  serviceType: string = "standard",
  options?: {
    declaredValue?: number;
    cashOnDelivery?: boolean;
    insurance?: boolean;
  }
): Promise<{
  basePrice: number;
  surcharges: number;
  totalCost: number;
  details: any;
} | null> {
  const priceList = await getActivePriceList(courierId);

  if (!priceList) {
    return null;
  }

  // Usa la funzione pura per calcolare il prezzo (Single Source of Truth)
  const result = calculatePriceFromList(
    priceList,
    weight,
    destinationZip,
    serviceType,
    options
  );

  if (!result) {
    return null;
  }

  // Mappa il risultato al formato atteso dalla funzione async
  return {
    basePrice: result.basePrice,
    surcharges: result.surcharges,
    totalCost: result.totalCost,
    details: result.details,
  };
}

/**
 * Aggiorna status listino
 */
export async function updatePriceListStatus(
  id: string,
  status: "draft" | "active" | "archived"
): Promise<void> {
  const { error } = await supabase
    .from("price_lists")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating price list status:", error);
    throw new Error(`Errore aggiornamento status listino: ${error.message}`);
  }
}

/**
 * Elimina listino
 */
export async function deletePriceList(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("price_lists")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting price list:", error);
    throw new Error(`Errore eliminazione listino: ${error.message}`);
  }
}

/**
 * Recupera corrieri disponibili per un utente
 *
 * Basato su:
 * 1. Configurazioni API (courier_configs) con owner_user_id = userId
 * 2. contract_mapping JSONB per estrarre corrieri (GLS, BRT, SDA, ecc.)
 *
 * @param userId - ID utente
 * @returns Array di oggetti { courierId: string, courierName: string, providerId: string, contractCode: string }
 */
export async function getAvailableCouriersForUser(userId: string): Promise<
  Array<{
    courierId: string;
    courierName: string;
    providerId: string;
    contractCode: string;
  }>
> {
  try {
    // 1. Recupera configurazioni API dell'utente
    const { data: configs, error } = await supabaseAdmin
      .from("courier_configs")
      .select("id, provider_id, contract_mapping")
      .eq("owner_user_id", userId)
      .eq("is_active", true);

    if (error) {
      console.error("Errore recupero configurazioni:", error);
      return [];
    }

    if (!configs || configs.length === 0) {
      return [];
    }

    // 2. Estrai corrieri da contract_mapping
    // NOTA: Le CHIAVI sono i codici contratto (es. "gls-*", "postedeliverybusiness-SDA---Express---H24+")
    //       I VALORI sono i nomi corriere (es. "Gls", "PosteDeliveryBusiness")
    const couriersMap = new Map<
      string,
      { courierName: string; providerId: string; contractCode: string }
    >();

    for (const config of configs) {
      const contractMapping =
        (config.contract_mapping as Record<string, string>) || {};
      const providerId = config.provider_id;

      // contractCode = chiave (codice contratto), courierName = valore (nome corriere)
      for (const [contractCode, courierName] of Object.entries(
        contractMapping
      )) {
        if (!couriersMap.has(courierName)) {
          couriersMap.set(courierName, {
            courierName,
            providerId,
            contractCode,
          });
        }
      }
    }

    // 3. Converti in array e prova a recuperare courier_id da tabella couriers
    const result = [];
    for (const [courierName, data] of Array.from(couriersMap.entries())) {
      // Prova a trovare courier_id nella tabella couriers
      const { data: courier } = await supabaseAdmin
        .from("couriers")
        .select("id, name")
        .ilike("name", `%${courierName}%`)
        .limit(1)
        .maybeSingle();

      result.push({
        courierId: courier?.id || courierName, // Fallback a nome se non trovato
        courierName,
        providerId: data.providerId,
        contractCode: data.contractCode,
      });
    }

    return result;
  } catch (error: any) {
    console.error("Errore getAvailableCouriersForUser:", error);
    return [];
  }
}
