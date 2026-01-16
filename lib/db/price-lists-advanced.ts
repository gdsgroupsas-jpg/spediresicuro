/**
 * Database Functions: Price Lists Advanced
 *
 * Sistema avanzato di gestione listini con regole complesse,
 * matching intelligente e calcolo prezzi dinamico.
 */

import { pricingConfig } from "@/lib/config";
import { calculatePriceFromList } from "@/lib/pricing/calculator";
import {
  calculatePriceWithVAT,
  calculateVATAmount,
  getVATModeWithFallback,
  normalizePrice,
  type VATMode,
} from "@/lib/pricing/vat-utils";
import type {
  PriceCalculationResult,
  PriceList,
  PriceRule,
} from "@/types/listini";
import type { CourierServiceType } from "@/types/shipments";
import { supabaseAdmin } from "./client";

/**
 * Ottiene il listino applicabile per un utente
 *
 * Algoritmo di matching:
 * 1. Listino assegnato direttamente all'utente (priorità massima)
 * 2. Listino globale (admin) con priorità alta
 * 3. Listino di default (priorità bassa)
 *
 * Considera anche: corriere, validità temporale, priorità
 */
export async function getApplicablePriceList(
  userId: string,
  courierId?: string,
  date?: Date
): Promise<PriceList | null> {
  try {
    const checkDate = date || new Date();
    const dateStr = checkDate.toISOString().split("T")[0];

    // Usa funzione SQL se disponibile, altrimenti query manuale
    const { data, error } = await supabaseAdmin.rpc(
      "get_applicable_price_list",
      {
        p_user_id: userId,
        p_courier_id: courierId || null,
        p_date: dateStr,
      }
    );

    if (error) {
      console.warn("Errore funzione SQL, uso query manuale:", error);
      // Fallback: query manuale
      return await getApplicablePriceListManual(userId, courierId, checkDate);
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Recupera listino completo
    return await getPriceListById(data[0].id);
  } catch (error: any) {
    console.error("Errore getApplicablePriceList:", error);
    return null;
  }
}

/**
 * Fallback: query manuale per listino applicabile
 *
 * ⚠️ AGGIORNATO: Include anche listini assegnati tramite price_list_assignments
 */
async function getApplicablePriceListManual(
  userId: string,
  courierId?: string,
  date: Date = new Date()
): Promise<PriceList | null> {
  const dateStr = date.toISOString().split("T")[0];

  // 1. Prova listino assegnato direttamente (assigned_to_user_id)
  const { data: assignedList } = await supabaseAdmin
    .from("price_lists")
    .select("*")
    .eq("assigned_to_user_id", userId)
    .eq("status", "active")
    .lte("valid_from", dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignedList) {
    return assignedList as PriceList;
  }

  // 2. ✨ NUOVO: Prova listino assegnato tramite price_list_assignments
  const { data: assignments } = await supabaseAdmin
    .from("price_list_assignments")
    .select("price_list_id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (assignments && assignments.length > 0) {
    const assignedPriceListIds = assignments.map((a) => a.price_list_id);

    // Recupera i listini assegnati
    const { data: assignedLists } = await supabaseAdmin
      .from("price_lists")
      .select("*")
      .in("id", assignedPriceListIds)
      .eq("status", "active")
      .lte("valid_from", dateStr)
      .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
      .order("created_at", { ascending: false });

    if (assignedLists && assignedLists.length > 0) {
      // Filtra per corriere se specificato
      const filtered = courierId
        ? assignedLists.filter(
            (pl) => !pl.courier_id || pl.courier_id === courierId
          )
        : assignedLists;

      if (filtered.length > 0) {
        return filtered[0] as PriceList;
      }
    }
  }

  // 3. Prova listino globale
  const { data: globalList } = await supabaseAdmin
    .from("price_lists")
    .select("*")
    .eq("is_global", true)
    .eq("status", "active")
    .lte("valid_from", dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (globalList) {
    return globalList as PriceList;
  }

  // 4. Prova listino di default
  const { data: defaultList } = await supabaseAdmin
    .from("price_lists")
    .select("*")
    .eq("priority", "default")
    .eq("status", "active")
    .lte("valid_from", dateStr)
    .or(`valid_until.is.null,valid_until.gte.${dateStr}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return defaultList as PriceList | null;
}

/**
 * Calcola prezzo usando sistema PriceRule avanzato
 *
 * Algoritmo:
 * 1. Recupera listino applicabile
 * 2. Trova tutte le regole che matchano le condizioni
 * 3. Seleziona regola con priorità più alta
 * 4. Calcola prezzo base + sovrapprezzi + margine
 */
export async function calculatePriceWithRules(
  userId: string,
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
): Promise<PriceCalculationResult | null> {
  try {
    // 1. Recupera listino
    let priceList: PriceList | null = null;

    if (priceListId) {
      priceList = await getPriceListById(priceListId);
    } else {
      priceList = await getApplicablePriceList(userId, params.courierId);
    }

    if (!priceList) {
      return null;
    }

    // 2. Estrai regole (se presenti)
    const rules = (priceList.rules as PriceRule[]) || [];

    // 3. Trova regole che matchano
    const matchingRules = findMatchingRules(rules, params);

    if (matchingRules.length === 0) {
      // Nessuna regola matcha, usa margine di default
      return await calculateWithDefaultMargin(priceList, params);
    }

    // 4. Seleziona regola con priorità più alta
    const selectedRule = selectBestRule(matchingRules);

    // 5. Calcola prezzo con regola selezionata
    return await calculatePriceWithRule(priceList, selectedRule, params);
  } catch (error: any) {
    console.error("Errore calculatePriceWithRules:", error);
    return null;
  }
}

/**
 * Helper: Mappa provincia/regione a zona geografica
 * Retrocompatibile: se non può determinare, ritorna null (regola viene comunque valutata)
 */
function getZoneFromDestination(
  province?: string,
  region?: string
): string | null {
  if (!province && !region) return null;

  // Mappatura province/regioni a zone (basata su PRICING_MATRIX)
  const provinceToZone: Record<string, string> = {
    // Sardegna
    CA: "IT-SARDEGNA",
    NU: "IT-SARDEGNA",
    OR: "IT-SARDEGNA",
    SS: "IT-SARDEGNA",
    // Calabria
    RC: "IT-CALABRIA",
    CZ: "IT-CALABRIA",
    CS: "IT-CALABRIA",
    KR: "IT-CALABRIA",
    VV: "IT-CALABRIA",
    // Sicilia
    PA: "IT-SICILIA",
    CT: "IT-SICILIA",
    ME: "IT-SICILIA",
    AG: "IT-SICILIA",
    CL: "IT-SICILIA",
    EN: "IT-SICILIA",
    RG: "IT-SICILIA",
    SR: "IT-SICILIA",
    TP: "IT-SICILIA",
    // Livigno/Campione
    SO: "IT-LIVIGNO", // Solo per Livigno specifico
  };

  const regionToZone: Record<string, string> = {
    Sardegna: "IT-SARDEGNA",
    Calabria: "IT-CALABRIA",
    Sicilia: "IT-SICILIA",
  };

  // Prova prima con provincia
  if (province && provinceToZone[province]) {
    return provinceToZone[province];
  }

  // Poi con regione
  if (region && regionToZone[region]) {
    return regionToZone[region];
  }

  // Default: Italia standard (non escludere la regola)
  return "IT-ITALIA";
}

/**
 * Trova tutte le regole che matchano le condizioni
 */
function findMatchingRules(
  rules: PriceRule[],
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
  }
): PriceRule[] {
  const now = new Date().toISOString();

  return rules.filter((rule) => {
    // Filtra regole attive
    if (!rule.is_active) return false;

    // Verifica validità temporale
    if (rule.valid_from && rule.valid_from > now) return false;
    if (rule.valid_until && rule.valid_until < now) return false;

    // Verifica peso
    if (rule.weight_from !== undefined && params.weight < rule.weight_from)
      return false;
    if (rule.weight_to !== undefined && params.weight > rule.weight_to)
      return false;

    // Verifica volume
    if (params.volume !== undefined) {
      if (rule.volume_from !== undefined && params.volume < rule.volume_from)
        return false;
      if (rule.volume_to !== undefined && params.volume > rule.volume_to)
        return false;
    }

    // Verifica corriere
    if (rule.courier_ids && rule.courier_ids.length > 0) {
      if (!params.courierId || !rule.courier_ids.includes(params.courierId))
        return false;
    }

    // Verifica servizio
    if (rule.service_types && rule.service_types.length > 0) {
      if (
        !params.serviceType ||
        !rule.service_types.includes(params.serviceType)
      )
        return false;
    }

    // Verifica zona geografica
    if (rule.zone_codes && rule.zone_codes.length > 0) {
      const destinationZone = getZoneFromDestination(
        params.destination.province,
        params.destination.region
      );

      // Se non può determinare la zona, la regola viene comunque valutata (retrocompatibilità)
      // Solo se la zona è determinabile E non matcha, escludi la regola
      if (destinationZone && !rule.zone_codes.includes(destinationZone)) {
        return false;
      }
      // Se destinationZone è null, la regola viene valutata (non esclusa)
    }

    // Verifica CAP
    if (rule.zip_code_from && params.destination.zip) {
      if (params.destination.zip < rule.zip_code_from) return false;
    }
    if (rule.zip_code_to && params.destination.zip) {
      if (params.destination.zip > rule.zip_code_to) return false;
    }

    // Verifica provincia
    if (rule.province_codes && rule.province_codes.length > 0) {
      if (
        !params.destination.province ||
        !rule.province_codes.includes(params.destination.province)
      )
        return false;
    }

    // Verifica regione
    if (rule.regions && rule.regions.length > 0) {
      if (
        !params.destination.region ||
        !rule.regions.includes(params.destination.region)
      )
        return false;
    }

    // Verifica paese
    if (rule.countries && rule.countries.length > 0) {
      if (
        !params.destination.country ||
        !rule.countries.includes(params.destination.country)
      )
        return false;
    }

    return true;
  });
}

/**
 * Seleziona la regola migliore tra quelle che matchano
 * (priorità più alta)
 */
function selectBestRule(rules: PriceRule[]): PriceRule {
  return rules.reduce((best, current) => {
    const currentPriority = current.priority || 0;
    const bestPriority = best.priority || 0;
    return currentPriority > bestPriority ? current : best;
  });
}

/**
 * Calcola prezzo usando una regola specifica
 */
async function calculatePriceWithRule(
  priceList: PriceList,
  rule: PriceRule,
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
  }
): Promise<PriceCalculationResult> {
  // Prezzo base
  let basePrice = rule.base_price_override || 0;
  let supplierBasePrice = 0; // ✨ Costo fornitore originale
  let supplierSurcharges = 0;

  // ✨ ENTERPRISE: Se è un listino personalizzato con master_list_id, recupera prezzo originale fornitore
  let masterVATModeForRule: "included" | "excluded" = "excluded"; // Default per retrocompatibilità
  let masterVATRateForRule = 22.0;
  if (priceList.master_list_id && priceList.list_type === "custom") {
    try {
      const { data: masterList } = await supabaseAdmin
        .from("price_lists")
        .select("*, entries:price_list_entries(*)")
        .eq("id", priceList.master_list_id)
        .single();

      if (masterList) {
        // ✨ NUOVO: Recupera vat_mode del master list (ADR-001 fix)
        masterVATModeForRule = getVATModeWithFallback(masterList.vat_mode);
        masterVATRateForRule = masterList.vat_rate || 22.0;

        if (masterList.entries) {
          const masterMatrixResult = calculatePriceFromList(
            masterList as PriceList,
            params.weight,
            params.destination.zip || "",
            params.serviceType || "standard",
            params.options,
            params.destination.province,
            params.destination.region
          );

          if (masterMatrixResult) {
            supplierBasePrice = masterMatrixResult.basePrice;
            supplierSurcharges = masterMatrixResult.surcharges || 0;
            console.log(
              `✅ [PRICE CALC] Listino personalizzato: recuperato costo fornitore originale €${(
                supplierBasePrice + supplierSurcharges
              ).toFixed(2)} (vat_mode: ${masterVATModeForRule})`
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ [PRICE CALC] Errore recupero costo fornitore originale:`,
        error
      );
    }
  }

  // Se non c'è override, calcola da price_list_entries (matrice) se disponibile
  if (
    !rule.base_price_override &&
    priceList.entries &&
    priceList.entries.length > 0
  ) {
    console.log(
      `🔍 [PRICE CALC] Calcolo prezzo da matrice listino "${priceList.name}" (${priceList.list_type}):`
    );
    console.log(`   - Peso: ${params.weight}kg`);
    console.log(`   - CAP: ${params.destination.zip}`);
    console.log(`   - Provincia: ${params.destination.province || "N/A"}`);
    console.log(`   - Service Type: ${params.serviceType || "standard"}`);
    console.log(`   - Entries disponibili: ${priceList.entries.length}`);

    const matrixResult = calculatePriceFromList(
      priceList,
      params.weight,
      params.destination.zip || "",
      params.serviceType || "standard",
      params.options,
      params.destination.province,
      params.destination.region
    );

    if (matrixResult) {
      basePrice = matrixResult.basePrice;
      console.log(
        `✅ [PRICE CALC] Entry trovata nella matrice: basePrice = €${basePrice.toFixed(
          2
        )}`
      );
    } else {
      // Se non trova entry nella matrice, usa default (retrocompatibilità)
      console.warn(
        `⚠️ [PRICE CALC] Nessuna entry matcha nella matrice, uso default €10.00`
      );
      basePrice = 10.0;
    }
  } else if (!rule.base_price_override) {
    // Nessuna matrice disponibile, usa default
    console.warn(
      `⚠️ [PRICE CALC] Nessuna matrice disponibile, uso default €10.00`
    );
    basePrice = 10.0;
  }

  // Calcola sovrapprezzi
  let surcharges = 0;

  // Supplemento carburante
  if (rule.fuel_surcharge_percent) {
    surcharges += basePrice * (rule.fuel_surcharge_percent / 100);
  }

  // Supplemento isole
  if (rule.island_surcharge) {
    surcharges += rule.island_surcharge;
  }

  // Supplemento ZTL
  if (rule.ztl_surcharge) {
    surcharges += rule.ztl_surcharge;
  }

  // Supplemento express
  if (params.serviceType === "express" && rule.express_surcharge) {
    surcharges += rule.express_surcharge;
  }

  // Contrassegno
  if (params.options?.cashOnDelivery && rule.cash_on_delivery_fee) {
    surcharges += rule.cash_on_delivery_fee;
  }

  // Assicurazione
  if (
    params.options?.insurance &&
    params.options?.declaredValue &&
    rule.insurance_rate_percent
  ) {
    surcharges +=
      params.options.declaredValue * (rule.insurance_rate_percent / 100);
  }

  // ✨ NUOVO: Gestione VAT (ADR-001)
  const vatMode: "included" | "excluded" = getVATModeWithFallback(
    (priceList.vat_mode ?? null) as VATMode
  ); // null → 'excluded'
  const vatRate = priceList.vat_rate || 22.0;

  // Normalizza basePrice a IVA esclusa per calcoli (Invariant #1: margine sempre su base IVA esclusa)
  let basePriceExclVAT = basePrice;
  if (vatMode === "included") {
    basePriceExclVAT = normalizePrice(
      basePrice,
      "included",
      "excluded",
      vatRate
    );
  }

  // Surcharges sono sempre IVA esclusa (assunzione)
  const totalCostExclVAT = basePriceExclVAT + surcharges;

  // ✨ FIX: Normalizza supplierTotalCost a IVA esclusa usando vat_mode del master list
  const supplierTotalCostRaw = supplierBasePrice + supplierSurcharges;
  const supplierTotalCostExclVAT =
    supplierTotalCostRaw > 0
      ? masterVATModeForRule === "included"
        ? normalizePrice(
            supplierTotalCostRaw,
            "included",
            "excluded",
            masterVATRateForRule
          )
        : supplierTotalCostRaw // Già IVA esclusa se masterVATModeForRule === 'excluded'
      : 0;

  // Calcola margine su base IVA esclusa (Invariant #1)
  let margin = 0;
  if (rule.margin_type === "percent" && rule.margin_value) {
    margin = totalCostExclVAT * (rule.margin_value / 100);
  } else if (rule.margin_type === "fixed" && rule.margin_value) {
    margin = rule.margin_value;
  }

  const finalPriceExclVAT = totalCostExclVAT + margin;

  // Se listino ha IVA inclusa, converti prezzo finale
  const finalPrice =
    vatMode === "included"
      ? calculatePriceWithVAT(finalPriceExclVAT, vatRate)
      : finalPriceExclVAT;

  // Calcola importo IVA se necessario
  const vatAmount =
    vatMode === "excluded"
      ? calculateVATAmount(finalPriceExclVAT, vatRate)
      : finalPrice - finalPriceExclVAT;

  return {
    basePrice: basePriceExclVAT, // Sempre IVA esclusa per consistenza
    surcharges,
    margin,
    totalCost:
      supplierTotalCostExclVAT > 0
        ? supplierTotalCostExclVAT
        : totalCostExclVAT, // ✨ Se c'è costo fornitore, usa quello (sempre IVA esclusa)
    finalPrice, // Nella modalità IVA del listino
    appliedRule: rule,
    appliedPriceList: priceList,
    priceListId: priceList.id,
    // ✨ NUOVO: Aggiungi costo fornitore originale (sempre IVA esclusa per consistenza)
    supplierPrice:
      supplierTotalCostExclVAT > 0 ? supplierTotalCostExclVAT : undefined,
    // ✨ NUOVO: VAT Semantics (ADR-001)
    vatMode: priceList.vat_mode || "excluded", // Propaga vat_mode
    vatRate,
    vatAmount,
    totalPriceWithVAT:
      vatMode === "excluded" ? finalPrice + vatAmount : finalPrice,
    calculationDetails: {
      weight: params.weight,
      volume: params.volume,
      destination: params.destination,
      courierId: params.courierId,
      serviceType: params.serviceType,
      options: params.options,
    },
  };
}

/**
 * Calcola prezzo usando margine di default (nessuna regola matcha)
 */
async function calculateWithDefaultMargin(
  priceList: PriceList,
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
  }
): Promise<PriceCalculationResult> {
  // ✨ FIX: Calcola prezzo base dalla matrice se disponibile
  let basePrice = 10.0; // Default fallback
  let surcharges = 0;
  let supplierBasePrice = 0; // ✨ NUOVO: Prezzo originale fornitore (se listino personalizzato modificato manualmente)
  let supplierSurcharges = 0;

  // ✨ ENTERPRISE: Se è un listino personalizzato con master_list_id, recupera prezzo originale fornitore
  let masterVATMode: "included" | "excluded" = "excluded"; // Default per retrocompatibilità
  let masterVATRate = 22.0;
  if (priceList.master_list_id && priceList.list_type === "custom") {
    try {
      const { data: masterList } = await supabaseAdmin
        .from("price_lists")
        .select("*, entries:price_list_entries(*)")
        .eq("id", priceList.master_list_id)
        .single();

      if (masterList && masterList.entries) {
        // ✨ NUOVO: Recupera vat_mode del master list (ADR-001 fix)
        masterVATMode = getVATModeWithFallback(masterList.vat_mode);
        masterVATRate = masterList.vat_rate || 22.0;

        const masterMatrixResult = calculatePriceFromList(
          masterList as PriceList,
          params.weight,
          params.destination.zip || "",
          params.serviceType || "standard",
          params.options,
          params.destination.province,
          params.destination.region
        );

        if (masterMatrixResult) {
          supplierBasePrice = masterMatrixResult.basePrice;
          supplierSurcharges = masterMatrixResult.surcharges || 0;
          console.log(
            `✅ [PRICE CALC] Listino personalizzato: recuperato prezzo fornitore originale €${(
              supplierBasePrice + supplierSurcharges
            ).toFixed(2)} (vat_mode: ${masterVATMode})`
          );
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ [PRICE CALC] Errore recupero prezzo fornitore originale:`,
        error
      );
    }
  }

  if (priceList.entries && priceList.entries.length > 0) {
    // 🔍 VERIFICA: Usa la matrice del listino personalizzato (priceList), non del master
    console.log(
      `🔍 [PRICE CALC] Calcolo prezzo da matrice listino personalizzato:`
    );
    console.log(`   - Listino ID: ${priceList.id}`);
    console.log(`   - Listino nome: ${priceList.name}`);
    console.log(`   - Listino tipo: ${priceList.list_type}`);
    console.log(`   - Numero entries: ${priceList.entries.length}`);
    console.log(
      `   - ✅ Usando matrice del listino PERSONALIZZATO (non master)`
    );

    const matrixResult = calculatePriceFromList(
      priceList, // ✅ CORRETTO: Usa priceList (listino personalizzato), non masterList
      params.weight,
      params.destination.zip || "",
      params.serviceType || "standard",
      params.options,
      params.destination.province,
      params.destination.region
    );

    if (matrixResult) {
      basePrice = matrixResult.basePrice;
      surcharges = matrixResult.surcharges || 0;
      // totalCost dalla matrice include già basePrice + surcharges
      const totalCost = basePrice + surcharges;

      console.log(
        `✅ [PRICE CALC] Risultato da matrice listino personalizzato:`
      );
      console.log(`   - basePrice: €${basePrice.toFixed(2)}`);
      console.log(`   - surcharges: €${surcharges.toFixed(2)}`);
      console.log(`   - totalCost: €${totalCost.toFixed(2)}`);

      // ✨ ENTERPRISE: Se abbiamo il prezzo fornitore originale, significa che i prezzi sono stati modificati manualmente
      // In questo caso, il prezzo nel listino personalizzato è già il prezzo finale (con margine incluso)
      // Quindi NON applichiamo margini aggiuntivi
      // ✨ FIX: Calcola supplierTotalCost e normalizza a IVA esclusa per confronto corretto
      const supplierTotalCostRaw =
        supplierBasePrice > 0 ? supplierBasePrice + supplierSurcharges : 0;
      const customVATMode: "included" | "excluded" = getVATModeWithFallback(
        priceList.vat_mode ?? null
      );
      const customVATRate = priceList.vat_rate || 22.0;

      // Normalizza totalCost a IVA esclusa per confronto
      const totalCostExclVATForComparison =
        customVATMode === "included"
          ? normalizePrice(totalCost, "included", "excluded", customVATRate)
          : totalCost;

      // Normalizza supplierTotalCost a IVA esclusa usando vat_mode del master
      const supplierTotalCostExclVATForComparison =
        supplierTotalCostRaw > 0
          ? masterVATMode === "included"
            ? normalizePrice(
                supplierTotalCostRaw,
                "included",
                "excluded",
                masterVATRate
              )
            : supplierTotalCostRaw
          : 0;

      // Confronta su base IVA esclusa per determinare se modificato manualmente
      const isManuallyModified =
        supplierTotalCostExclVATForComparison > 0 &&
        Math.abs(
          totalCostExclVATForComparison - supplierTotalCostExclVATForComparison
        ) > 0.01;

      // 🔍 LOGGING DETTAGLIATO: Traccia valori per debug
      console.log(
        `🔍 [PRICE CALC] Calcolo prezzo per listino "${priceList.name}" (${priceList.list_type}):`
      );
      console.log(`   - Listino ID: ${priceList.id}`);
      console.log(`   - Master List ID: ${priceList.master_list_id || "N/A"}`);
      console.log(
        `   - Base Price (da matrice listino personalizzato): €${basePrice.toFixed(
          2
        )}`
      );
      console.log(
        `   - Surcharges (da matrice listino personalizzato): €${surcharges.toFixed(
          2
        )}`
      );
      console.log(
        `   - Total Cost (listino personalizzato, raw): €${totalCost.toFixed(
          2
        )} (vat_mode: ${customVATMode})`
      );
      console.log(
        `   - Total Cost Excl VAT (per confronto): €${totalCostExclVATForComparison.toFixed(
          2
        )}`
      );
      console.log(
        `   - Supplier Base Price (da master): €${supplierBasePrice.toFixed(2)}`
      );
      console.log(
        `   - Supplier Surcharges (da master): €${supplierSurcharges.toFixed(
          2
        )}`
      );
      console.log(
        `   - Supplier Total Cost (master, raw): €${supplierTotalCostRaw.toFixed(
          2
        )} (vat_mode: ${masterVATMode})`
      );
      console.log(
        `   - Supplier Total Cost Excl VAT (per confronto): €${supplierTotalCostExclVATForComparison.toFixed(
          2
        )}`
      );
      console.log(
        `   - Differenza (su base IVA esclusa): €${Math.abs(
          totalCostExclVATForComparison - supplierTotalCostExclVATForComparison
        ).toFixed(2)}`
      );
      console.log(`   - Is Manually Modified: ${isManuallyModified}`);

      // ✨ FIX: Quando i prezzi sono identici (isManuallyModified = false) e c'è un master,
      // usa supplierTotalCostExclVAT come base per il calcolo del margine
      const costBaseForMargin =
        supplierTotalCostExclVATForComparison > 0 && !isManuallyModified
          ? supplierTotalCostExclVATForComparison
          : totalCostExclVATForComparison;
      console.log(
        `   - Cost Base For Margin: €${costBaseForMargin.toFixed(2)}`
      );

      let margin = 0;
      let finalPrice = totalCost;

      if (isManuallyModified) {
        // Prezzi modificati manualmente: il prezzo nel listino personalizzato è già il prezzo finale
        // Il margine è la differenza tra prezzo personalizzato e prezzo fornitore originale (su base IVA esclusa)
        // Nota: margin sarà ricalcolato nella sezione VAT, qui è solo per logging
        margin =
          totalCostExclVATForComparison - supplierTotalCostExclVATForComparison;
        finalPrice = totalCost; // Non aggiungiamo margine, è già incluso (nella modalità VAT del custom list)
        console.log(`✅ [PRICE CALC] Prezzi modificati manualmente:`);
        console.log(
          `   - Margine calcolato (differenza su base IVA esclusa): €${margin.toFixed(
            2
          )}`
        );
        console.log(
          `   - Final Price (usando totalCost listino personalizzato): €${finalPrice.toFixed(
            2
          )}`
        );
        console.log(
          `   - ✅ RISULTATO: Fornitore €${supplierTotalCostExclVATForComparison.toFixed(
            2
          )} (excl VAT) → Vendita €${totalCostExclVATForComparison.toFixed(
            2
          )} (excl VAT) (margine €${margin.toFixed(2)})`
        );
      } else {
        // Prezzi non modificati: applica margine di default
        // ✨ FIX: Usa costBaseForMargin (supplierTotalCost se disponibile) invece di totalCost
        console.log(
          `🔍 [PRICE CALC] Prezzi identici al master, applicazione margine:`
        );
        console.log(
          `   - default_margin_percent: ${
            priceList.default_margin_percent || "NULL"
          }`
        );
        console.log(
          `   - default_margin_fixed: ${
            priceList.default_margin_fixed || "NULL"
          }`
        );
        console.log(`   - list_type: ${priceList.list_type}`);
        console.log(
          `   - master_list_id: ${priceList.master_list_id || "NULL"}`
        );

        if (priceList.default_margin_percent) {
          margin = costBaseForMargin * (priceList.default_margin_percent / 100);
          console.log(
            `   - Margine percentuale: ${
              priceList.default_margin_percent
            }% su €${costBaseForMargin.toFixed(2)} = €${margin.toFixed(2)}`
          );
        } else if (priceList.default_margin_fixed) {
          margin = priceList.default_margin_fixed;
          console.log(`   - Margine fisso: €${margin.toFixed(2)}`);
        } else {
          // ✨ FIX: Se listino CUSTOM con master ma senza margine configurato,
          // applica margine di default globale per garantire consistenza nel comparatore
          // Questo garantisce che OGNI corriere nel comparatore abbia sempre un margine
          if (priceList.list_type === "custom" && priceList.master_list_id) {
            margin =
              costBaseForMargin * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100);
            console.log(
              `   - ⚠️ Margine default globale: ${
                pricingConfig.DEFAULT_MARGIN_PERCENT
              }% su €${costBaseForMargin.toFixed(2)} = €${margin.toFixed(2)}`
            );
          } else {
            console.log(`   - ⚠️ Nessun margine configurato, margin = 0`);
          }
          // Se non è CUSTOM con master, margin rimane 0 (comportamento originale)
        }
        // ✨ FIX: Quando i prezzi sono identici, finalPrice = supplierTotalCostExclVAT + margin
        // Altrimenti finalPrice = totalCostExclVAT + margin
        // Nota: margin sarà ricalcolato nella sezione VAT, qui è solo per logging
        const baseForFinalPrice =
          supplierTotalCostExclVATForComparison > 0 && !isManuallyModified
            ? supplierTotalCostExclVATForComparison
            : totalCostExclVATForComparison;
        finalPrice = baseForFinalPrice + margin; // Questo sarà sovrascritto nella sezione VAT
        console.log(
          `   - Base per finalPrice (excl VAT): €${baseForFinalPrice.toFixed(
            2
          )} (${
            supplierTotalCostExclVATForComparison > 0 && !isManuallyModified
              ? "supplierTotalCostExclVAT"
              : "totalCostExclVAT"
          })`
        );
        console.log(
          `   - Final Price (excl VAT, prima conversione): €${baseForFinalPrice.toFixed(
            2
          )} + €${margin.toFixed(2)} = €${finalPrice.toFixed(2)}`
        );
        console.log(
          `   - ✅ RISULTATO: Fornitore €${supplierTotalCostExclVATForComparison.toFixed(
            2
          )} (excl VAT) → Vendita €${finalPrice.toFixed(
            2
          )} (excl VAT, prima conversione) (margine €${margin.toFixed(2)})`
        );
      }

      // ✨ FIX: Calcolo corretto di totalCost nel risultato (sempre IVA esclusa)
      // - Se isManuallyModified = true: totalCost = totalCostExclVAT (prezzo listino personalizzato, IVA esclusa)
      // - Se isManuallyModified = false e c'è master: totalCost = supplierTotalCostExclVAT (per consistenza)
      // - Altrimenti: totalCost = totalCostExclVAT (prezzo listino, IVA esclusa)
      const resultTotalCost = isManuallyModified
        ? totalCostExclVATForComparison // ✅ Prezzi modificati: usa prezzo listino personalizzato (IVA esclusa)
        : supplierTotalCostExclVATForComparison > 0
        ? supplierTotalCostExclVATForComparison
        : totalCostExclVATForComparison; // Prezzi identici: usa supplierTotalCostExclVAT se disponibile

      const resultSupplierPrice =
        supplierTotalCostExclVATForComparison > 0
          ? supplierTotalCostExclVATForComparison
          : undefined;

      console.log(`📤 [PRICE CALC] Valori restituiti:`);
      console.log(`   - basePrice: €${basePrice.toFixed(2)}`);
      console.log(`   - surcharges: €${surcharges.toFixed(2)}`);
      console.log(`   - margin: €${margin.toFixed(2)}`);
      console.log(
        `   - totalCost (excl VAT): €${resultTotalCost.toFixed(2)} (${
          isManuallyModified
            ? "totalCostExclVAT listino personalizzato"
            : supplierTotalCostExclVATForComparison > 0
            ? "supplierTotalCostExclVAT"
            : "totalCostExclVAT"
        })`
      );
      console.log(`   - finalPrice: €${finalPrice.toFixed(2)}`);
      console.log(
        `   - supplierPrice: €${resultSupplierPrice?.toFixed(2) || "undefined"}`
      );
      console.log(
        `   - ✅ VERIFICA: finalPrice ${
          finalPrice === resultTotalCost ? "=" : "≠"
        } totalCost (${
          finalPrice === resultTotalCost
            ? "OK se isManuallyModified"
            : "OK se margine applicato"
        })`
      );

      // ✨ NUOVO: Gestione VAT (ADR-001) - Fix per vat_mode diversi tra master e custom
      // Nota: customVATMode e customVATRate sono già dichiarati sopra (linea 681-682)

      // Normalizza basePrice a IVA esclusa per calcoli
      let basePriceExclVAT = basePrice;
      if (customVATMode === "included") {
        basePriceExclVAT = normalizePrice(
          basePrice,
          "included",
          "excluded",
          customVATRate
        );
      }

      // Surcharges sono sempre IVA esclusa
      const totalCostExclVAT = basePriceExclVAT + surcharges;

      // ✨ FIX: Usa i valori già normalizzati calcolati sopra
      // supplierTotalCostExclVAT e totalCostExclVAT sono già stati calcolati nella sezione precedente
      const supplierTotalCostExclVAT = supplierTotalCostExclVATForComparison;
      const resultTotalCostExclVAT = resultTotalCost; // Già calcolato sopra come IVA esclusa

      // Margine sempre su base IVA esclusa (Invariant #1)
      // ✨ FIX: Calcola margine normalizzando entrambi i valori a IVA esclusa
      let marginExclVAT = 0;
      let finalPriceExclVAT = 0;
      if (isManuallyModified) {
        // Prezzi modificati manualmente: margine = differenza su base IVA esclusa
        marginExclVAT = totalCostExclVAT - supplierTotalCostExclVAT;
        // ✨ FIX: Quando isManuallyModified = true, il prezzo nel listino personalizzato
        // è già il prezzo finale (con margine incluso), quindi finalPrice = totalCost originale
        // (nella modalità VAT del listino personalizzato)
        finalPriceExclVAT = totalCostExclVAT; // Usa il prezzo listino personalizzato (IVA esclusa)
        console.log(
          `✅ [PRICE CALC] Margine calcolato (manually modified): €${totalCostExclVAT.toFixed(
            2
          )} - €${supplierTotalCostExclVAT.toFixed(
            2
          )} = €${marginExclVAT.toFixed(2)}`
        );
        console.log(
          `✅ [PRICE CALC] Final Price (manually modified): usa prezzo listino personalizzato €${totalCostExclVAT.toFixed(
            2
          )} (excl VAT)`
        );
      } else {
        // Prezzi identici: applica margine di default su base IVA esclusa
        const costBaseForMarginExclVAT =
          supplierTotalCostExclVAT > 0
            ? supplierTotalCostExclVAT
            : totalCostExclVAT;
        if (priceList.default_margin_percent) {
          marginExclVAT =
            costBaseForMarginExclVAT * (priceList.default_margin_percent / 100);
        } else if (priceList.default_margin_fixed) {
          marginExclVAT = priceList.default_margin_fixed;
        } else if (
          priceList.list_type === "custom" &&
          priceList.master_list_id
        ) {
          // Margine default globale se listino CUSTOM con master ma senza margine configurato
          marginExclVAT =
            costBaseForMarginExclVAT *
            (pricingConfig.DEFAULT_MARGIN_PERCENT / 100);
        }
        // Quando i prezzi sono identici, finalPrice = supplierTotalCost + margin
        finalPriceExclVAT = costBaseForMarginExclVAT + marginExclVAT;
        console.log(
          `✅ [PRICE CALC] Margine calcolato (default): €${marginExclVAT.toFixed(
            2
          )} su base €${costBaseForMarginExclVAT.toFixed(2)}`
        );
      }

      // Se listino ha IVA inclusa, converti prezzo finale
      const finalPriceWithVAT =
        customVATMode === "included"
          ? isManuallyModified
            ? totalCost // Usa prezzo originale listino personalizzato (già con IVA inclusa)
            : calculatePriceWithVAT(finalPriceExclVAT, customVATRate) // Calcola IVA su prezzo + margine
          : finalPriceExclVAT;

      // Calcola importo IVA
      const vatAmount =
        customVATMode === "excluded"
          ? calculateVATAmount(finalPriceExclVAT, customVATRate)
          : finalPriceWithVAT - finalPriceExclVAT;

      return {
        basePrice: basePriceExclVAT, // Sempre IVA esclusa per consistenza
        surcharges,
        margin: marginExclVAT,
        // ✨ FIX: Quando i prezzi sono modificati manualmente, totalCost = prezzo listino personalizzato
        // Quando i prezzi sono identici al master, totalCost = supplierTotalCost (per consistenza)
        totalCost: resultTotalCostExclVAT,
        finalPrice: finalPriceWithVAT, // Nella modalità IVA del listino
        appliedPriceList: priceList,
        priceListId: priceList.id,
        // ✨ FIX: Aggiungi supplierPrice anche quando isManuallyModified = false
        // (per listini CUSTOM con master ma prezzi identici)
        supplierPrice: resultSupplierPrice,
        // ✨ NUOVO: VAT Semantics (ADR-001)
        vatMode: priceList.vat_mode || "excluded",
        vatRate: customVATRate,
        vatAmount,
        totalPriceWithVAT:
          customVATMode === "excluded"
            ? finalPriceWithVAT + vatAmount
            : finalPriceWithVAT,
        calculationDetails: {
          weight: params.weight,
          volume: params.volume,
          destination: params.destination,
          courierId: params.courierId,
          serviceType: params.serviceType,
          options: params.options,
        },
      };
    }
  }

  // Fallback: se non trova entry nella matrice, usa default
  const totalCost = basePrice + surcharges;

  // Margine di default
  let margin = 0;
  if (priceList.default_margin_percent) {
    margin = totalCost * (priceList.default_margin_percent / 100);
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed;
  } else {
    // ✨ FIX: Se listino CUSTOM con master ma senza margine configurato,
    // applica margine di default globale per garantire consistenza nel comparatore
    if (priceList.list_type === "custom" && priceList.master_list_id) {
      margin = totalCost * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100);
      console.log(
        `⚠️ [PRICE CALC] Listino CUSTOM senza margine configurato (fallback), applicato margine default globale ${
          pricingConfig.DEFAULT_MARGIN_PERCENT
        }%: €${margin.toFixed(2)}`
      );
    }
  }

  const finalPrice = totalCost + margin;

  // ✨ FIX: Se listino CUSTOM con master, aggiungi supplierPrice anche nel fallback
  const supplierTotalCost =
    supplierBasePrice > 0 ? supplierBasePrice + supplierSurcharges : 0;

  return {
    basePrice,
    surcharges,
    margin,
    totalCost,
    finalPrice,
    appliedPriceList: priceList,
    priceListId: priceList.id,
    // ✨ FIX: Aggiungi supplierPrice se disponibile (listino CUSTOM con master)
    supplierPrice: supplierTotalCost > 0 ? supplierTotalCost : undefined,
    calculationDetails: {
      weight: params.weight,
      volume: params.volume,
      destination: params.destination,
      courierId: params.courierId,
      serviceType: params.serviceType,
      options: params.options,
    },
  };
}

/**
 * Importa getPriceListById dalla versione base
 * ✨ FIX: Carica anche entries (matrice) per calcolo prezzi
 */
async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabaseAdmin
    .from("price_lists")
    .select("*, entries:price_list_entries(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Errore recupero listino:", error);
    return null;
  }

  return data as PriceList;
}

/**
 * ✨ NUOVO: Calcola e confronta prezzi per reseller (API Reseller vs API Master)
 *
 * Per reseller che ha accesso sia alle proprie API che a quelle Master:
 * 1. Calcola prezzo con listino fornitore reseller (API Reseller)
 * 2. Calcola prezzo con listino personalizzato assegnato (API Master)
 * 3. Confronta e seleziona il migliore
 *
 * @param userId - ID utente reseller
 * @param params - Parametri calcolo prezzo
 * @returns Risultato con prezzo migliore e informazioni su quale API usare
 */
export async function calculateBestPriceForReseller(
  userId: string,
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
    contractCode?: string; // ✨ NUOVO: per matching contract_code nei metadata
    serviceType?: CourierServiceType;
    options?: {
      declaredValue?: number;
      cashOnDelivery?: boolean;
      insurance?: boolean;
    };
  }
): Promise<{
  bestPrice: PriceCalculationResult;
  apiSource: "reseller" | "master" | "default";
  resellerPrice?: PriceCalculationResult;
  masterPrice?: PriceCalculationResult;
  priceDifference?: number;
} | null> {
  try {
    // Verifica ruolo utente
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, is_reseller, account_type")
      .eq("id", userId)
      .single();

    const isReseller = user?.is_reseller === true;
    const isSuperadmin = user?.account_type === "superadmin";

    // Per utenti normali (non reseller e non superadmin), usa calcolo base
    if (!user || (!isReseller && !isSuperadmin)) {
      const normalPrice = await calculatePriceWithRules(userId, params);
      if (!normalPrice) return null;
      return {
        bestPrice: normalPrice,
        apiSource: "default",
      };
    }

    // ✨ PRIORITÀ 1: Schema Reseller/Sub-Users
    //
    // REGOLE VISIBILITÀ:
    // - RESELLER: vede TUTTI i suoi listini personalizzati attivi (custom + supplier)
    // - UTENTI NORMALI: vedono SOLO i listini assegnati tramite price_list_assignments
    // - SUPERADMIN: vede tutti i listini attivi

    let customPrice: PriceCalculationResult | null = null;

    let activePriceLists: any[] = [];

    if (isSuperadmin) {
      // Superadmin: vede tutti i listini attivi
      const { data } = await supabaseAdmin
        .from("price_lists")
        .select("*, entries:price_list_entries(*)") // ✨ Carica anche entries (matrice)
        .in("list_type", ["custom", "supplier"])
        .eq("status", "active")
        .order("created_at", { ascending: false });
      activePriceLists = data || [];
    } else if (isReseller) {
      // RESELLER: vede TUTTI i suoi listini personalizzati attivi
      const { data } = await supabaseAdmin
        .from("price_lists")
        .select("*, entries:price_list_entries(*)") // ✨ Carica anche entries (matrice)
        .in("list_type", ["custom", "supplier"])
        .eq("status", "active")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      activePriceLists = data || [];
    } else {
      // UTENTI NORMALI: vedono SOLO i listini assegnati
      const { data: assignments } = await supabaseAdmin
        .from("price_list_assignments")
        .select("price_list_id, price_lists(*)")
        .eq("user_id", userId)
        .is("revoked_at", null);

      if (assignments && assignments.length > 0) {
        const assignedListIds = assignments.map((a: any) => a.price_list_id);
        const { data } = await supabaseAdmin
          .from("price_lists")
          .select("*, entries:price_list_entries(*)") // ✨ Carica anche entries (matrice)
          .in("id", assignedListIds)
          .in("list_type", ["custom", "supplier"])
          .eq("status", "active")
          .order("created_at", { ascending: false });
        activePriceLists = data || [];
      }
    }

    if (activePriceLists && activePriceLists.length > 0) {
      // ✨ Filtra per corriere: usa contractCode (priorità) o courierId (fallback)
      const filtered = activePriceLists.filter((pl) => {
        // Se contractCode è specificato, matcha per contract_code nei metadata
        if (params.contractCode) {
          const metadata = pl.metadata || pl.source_metadata || {};
          const listContractCode = (metadata as any).contract_code;
          const listCarrierCode = (metadata as any).carrier_code;

          // Match esatto o parziale con contractCode
          const contractCodeLower = params.contractCode.toLowerCase();
          const listContractCodeLower = listContractCode?.toLowerCase() || "";
          const listCarrierCodeLower = listCarrierCode?.toLowerCase() || "";

          // Match esatto
          if (
            listContractCodeLower === contractCodeLower ||
            listCarrierCodeLower === contractCodeLower
          ) {
            return true;
          }

          // Match parziale: contractCode contiene il prefisso (es. "gls-GLS-5000" contiene "gls")
          if (
            contractCodeLower.startsWith(listCarrierCodeLower + "-") ||
            contractCodeLower === listCarrierCodeLower
          ) {
            return true;
          }
          if (
            listContractCodeLower.startsWith(contractCodeLower + "-") ||
            listContractCodeLower === contractCodeLower
          ) {
            return true;
          }
        }

        // Fallback: filtra per courierId se specificato
        if (params.courierId) {
          return !pl.courier_id || pl.courier_id === params.courierId;
        }

        // Se nessun filtro, include tutti
        return true;
      });

      // ✨ ENTERPRISE: Se ci sono PIÙ listini attivi, calcola il prezzo per tutti e scegli il PIÙ ECONOMICO
      const priceResults: Array<{
        price: PriceCalculationResult;
        list: (typeof activePriceLists)[0];
        metadata: any;
      }> = [];

      // Calcola prezzo per ogni listino attivo (custom o supplier)
      console.log(
        `🔍 [RESELLER] Listini filtrati per calcolo: ${filtered.length} (su ${activePriceLists.length} totali)`
      );
      for (const priceList of filtered) {
        const metadata = priceList.metadata || priceList.source_metadata || {};
        const contractCode = (metadata as any).contract_code;
        const carrierCode = (metadata as any).carrier_code;

        console.log(
          `🔍 [RESELLER] Calcolo prezzo per listino: "${priceList.name}" (${priceList.list_type})`
        );
        console.log(`   - contract_code: ${contractCode || "N/A"}`);
        console.log(`   - carrier_code: ${carrierCode || "N/A"}`);
        console.log(
          `   - master_list_id: ${priceList.master_list_id || "N/A"}`
        );
        console.log(`   - entries: ${priceList.entries?.length || 0}`);

        const calculatedPrice = await calculatePriceWithRules(
          userId,
          params,
          priceList.id
        );
        if (calculatedPrice) {
          console.log(
            `✅ [RESELLER] Prezzo calcolato: €${calculatedPrice.finalPrice.toFixed(
              2
            )} (fornitore: €${
              calculatedPrice.supplierPrice?.toFixed(2) ||
              calculatedPrice.totalCost.toFixed(2)
            })`
          );
          priceResults.push({
            price: calculatedPrice,
            list: priceList,
            metadata,
          });
        } else {
          console.warn(
            `⚠️ [RESELLER] Impossibile calcolare prezzo per listino "${priceList.name}"`
          );
        }
      }

      // Se ci sono risultati, scegli il listino CUSTOM se presente, altrimenti il più economico
      if (priceResults.length > 0) {
        // ✨ FIX: Priorità ai listini CUSTOM rispetto ai SUPPLIER
        // I listini CUSTOM sono quelli configurati per la rivendita e devono essere sempre preferiti
        const customLists = priceResults.filter(
          (r) => r.list.list_type === "custom"
        );
        const supplierLists = priceResults.filter(
          (r) => r.list.list_type === "supplier"
        );

        let bestResult: (typeof priceResults)[0];

        if (customLists.length > 0) {
          // Se ci sono listini CUSTOM, scegli il più economico tra quelli CUSTOM
          customLists.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
          bestResult = customLists[0];
          console.log(
            `✅ [RESELLER] Priorità a listini CUSTOM: scelto "${
              bestResult.list.name
            }" (€${bestResult.price.finalPrice.toFixed(2)}) tra ${
              customLists.length
            } listini CUSTOM`
          );
        } else {
          // Se non ci sono listini CUSTOM, usa il più economico tra i SUPPLIER
          supplierLists.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
          bestResult = supplierLists[0];
          console.log(
            `⚠️ [RESELLER] Nessun listino CUSTOM disponibile, usato SUPPLIER "${
              bestResult.list.name
            }" (€${bestResult.price.finalPrice.toFixed(2)})`
          );
        }

        customPrice = bestResult.price;

        // ✨ ENTERPRISE: Estrai courier_config_id dal metadata del listino personalizzato
        // Questo è fondamentale per usare la configurazione API corretta nella creazione spedizione
        const courierConfigId = bestResult.metadata.courier_config_id;

        // Aggiungi courier_config_id al risultato per tracciare quale config API usare
        if (courierConfigId) {
          customPrice._courierConfigId = courierConfigId;
          console.log(
            `✅ [RESELLER] Usato listino personalizzato PIÙ ECONOMICO: ${
              bestResult.list.name
            } (${
              bestResult.list.id
            }) con prezzo €${bestResult.price.finalPrice.toFixed(
              2
            )} e config API: ${courierConfigId}`
          );
        } else {
          console.log(
            `✅ [RESELLER] Usato listino personalizzato PIÙ ECONOMICO: ${
              bestResult.list.name
            } (${
              bestResult.list.id
            }) con prezzo €${bestResult.price.finalPrice.toFixed(
              2
            )} - ATTENZIONE: courier_config_id non presente nei metadata`
          );
        }

        // Log dei listini confrontati (solo se ce ne sono più di uno)
        if (priceResults.length > 1) {
          console.log(
            `📊 [RESELLER] Confrontati ${
              priceResults.length
            } listini attivi per corriere ${params.courierId || "tutti"}:`
          );
          priceResults.forEach((result) => {
            const isSelected = result.list.id === bestResult.list.id;
            const typeLabel =
              result.list.list_type === "custom" ? "CUSTOM" : "SUPPLIER";
            console.log(
              `  - ${
                result.list.name
              } (${typeLabel}): €${result.price.finalPrice.toFixed(2)} ${
                isSelected ? "✅ SCELTO" : ""
              }`
            );
          });
        }
      }
    }

    // Se abbiamo trovato un listino personalizzato attivo, usalo (priorità massima)
    if (customPrice) {
      return {
        bestPrice: customPrice,
        apiSource: "reseller", // Listino personalizzato = reseller
        resellerPrice: customPrice,
      };
    }

    // ✨ PRIORITÀ 2: Listino fornitore reseller (API Reseller)
    const resellerPriceList = await getApplicablePriceList(
      userId,
      params.courierId
    );

    let resellerPrice: PriceCalculationResult | null = null;
    if (resellerPriceList && resellerPriceList.list_type === "supplier") {
      resellerPrice = await calculatePriceWithRules(
        userId,
        params,
        resellerPriceList.id
      );
    }

    // ✨ PRIORITÀ 3: Listino personalizzato assegnato (API Master)
    // Cerca listini assegnati tramite price_list_assignments
    const { data: assignments } = await supabaseAdmin
      .from("price_list_assignments")
      .select("price_list_id, price_lists(*)")
      .eq("user_id", userId)
      .is("revoked_at", null);

    let masterPrice: PriceCalculationResult | null = null;
    if (assignments && assignments.length > 0) {
      // Prendi il primo listino assegnato valido
      for (const assignment of assignments) {
        const assignedList = assignment.price_lists as any;
        if (assignedList && assignedList.status === "active") {
          // Verifica che sia per lo stesso corriere (se specificato)
          if (
            !params.courierId ||
            !assignedList.courier_id ||
            assignedList.courier_id === params.courierId
          ) {
            masterPrice = await calculatePriceWithRules(
              userId,
              params,
              assignedList.id
            );
            if (masterPrice) break;
          }
        }
      }
    }

    // 3. Confronta prezzi e seleziona il migliore
    const prices: Array<{
      price: PriceCalculationResult;
      source: "reseller" | "master";
    }> = [];

    if (resellerPrice) {
      prices.push({ price: resellerPrice, source: "reseller" });
    }

    if (masterPrice) {
      prices.push({ price: masterPrice, source: "master" });
    }

    if (prices.length === 0) {
      // Nessun prezzo disponibile, usa calcolo normale
      const normalPrice = await calculatePriceWithRules(userId, params);
      if (!normalPrice) return null;
      return {
        bestPrice: normalPrice,
        apiSource: "default",
      };
    }

    // Seleziona prezzo migliore (minore finalPrice)
    const best = prices.reduce((best, current) =>
      current.price.finalPrice < best.price.finalPrice ? current : best
    );

    const priceDifference =
      prices.length > 1
        ? Math.abs(
            (prices.find((p) => p.source !== best.source)?.price.finalPrice ||
              0) - best.price.finalPrice
          )
        : undefined;

    return {
      bestPrice: best.price,
      apiSource: best.source,
      resellerPrice: resellerPrice || undefined,
      masterPrice: masterPrice || undefined,
      priceDifference,
    };
  } catch (error: any) {
    console.error("Errore calculateBestPriceForReseller:", error);
    return null;
  }
}
