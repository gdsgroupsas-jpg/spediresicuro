/**
 * Server Action: Approvazione Listino Fornitore
 * 
 * ✨ FASE 5: Valida completezza listino e cambia status da draft → active
 * - Verifica che tutte le zone abbiano entries
 * - Verifica che tutte le entries abbiano prezzi > 0
 * - Cambia status da "draft" a "active"
 */

"use server";

import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import { updatePriceList } from "@/lib/db/price-lists";
import { PRICING_MATRIX, getZonesForMode } from "@/lib/constants/pricing-matrix";

interface ApprovePriceListResult {
  success: boolean;
  error?: string;
  validation?: {
    totalZones: number;
    zonesWithEntries: number;
    missingZones: string[];
    entriesWithZeroPrice: number;
  };
}

export async function approvePriceListAction(
  priceListId: string,
  mode: "fast" | "balanced" | "matrix" = "balanced"
): Promise<ApprovePriceListResult> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera utente
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
        error: "Solo admin, reseller e BYOC possono approvare listini",
      };
    }

    // Recupera listino
    const { data: priceList, error: listError } = await supabaseAdmin
      .from("price_lists")
      .select("id, name, status, created_by")
      .eq("id", priceListId)
      .single();

    if (listError || !priceList) {
      return { success: false, error: "Listino non trovato" };
    }

    // Verifica ownership (solo il creatore può approvare)
    if (priceList.created_by !== user.id && !isAdmin) {
      return {
        success: false,
        error: "Puoi approvare solo i tuoi listini",
      };
    }

    // Verifica che sia in stato draft
    if (priceList.status !== "draft") {
      return {
        success: false,
        error: `Listino già ${priceList.status === "active" ? "attivo" : "archiviato"}`,
      };
    }

    // ✨ VALIDAZIONE COMPLETEZZA: Verifica che tutte le zone abbiano entries
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("price_list_entries")
      .select("zone_code, base_price")
      .eq("price_list_id", priceListId);

    if (entriesError) {
      return {
        success: false,
        error: `Errore recupero entries: ${entriesError.message}`,
      };
    }

    // Ottieni zone attese per la modalità
    const expectedZones = getZonesForMode(mode);
    const zonesWithEntries = new Set(
      (entries || []).map((e) => e.zone_code).filter((z) => z)
    );

    // Trova zone mancanti
    const missingZones = expectedZones
      .filter((z) => !zonesWithEntries.has(z.code))
      .map((z) => z.name);

    // Verifica entries con prezzo zero
    const entriesWithZeroPrice = (entries || []).filter(
      (e) => !e.base_price || e.base_price <= 0
    ).length;

    // Validazione
    if (missingZones.length > 0) {
      return {
        success: false,
        error: `Zone mancanti: ${missingZones.join(", ")}. Completa tutte le zone prima di approvare.`,
        validation: {
          totalZones: expectedZones.length,
          zonesWithEntries: zonesWithEntries.size,
          missingZones,
          entriesWithZeroPrice,
        },
      };
    }

    if (entriesWithZeroPrice > 0) {
      return {
        success: false,
        error: `${entriesWithZeroPrice} entries hanno prezzo zero. Completa tutti i prezzi prima di approvare.`,
        validation: {
          totalZones: expectedZones.length,
          zonesWithEntries: zonesWithEntries.size,
          missingZones: [],
          entriesWithZeroPrice,
        },
      };
    }

    // ✨ APPROVAZIONE: Cambia status da draft → active
    await updatePriceList(
      priceListId,
      { status: "active" },
      user.id
    );

    return {
      success: true,
      validation: {
        totalZones: expectedZones.length,
        zonesWithEntries: zonesWithEntries.size,
        missingZones: [],
        entriesWithZeroPrice: 0,
      },
    };
  } catch (error: any) {
    console.error("Errore approvePriceListAction:", error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto",
    };
  }
}
