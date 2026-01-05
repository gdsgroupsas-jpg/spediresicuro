/**
 * API: Aggiorna preferenze corrieri per configurazione
 *
 * POST /api/configurations/update-courier-settings
 *
 * Salva la lista dei corrieri abilitati in courier_configs.automation_settings.enabled_carriers
 *
 * @security Solo owner della configurazione o admin può modificare
 */

import { supabaseAdmin } from "@/lib/db/client";
import { requireSafeAuth } from "@/lib/safe-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Autenticazione - ActingContext ha actor (chi agisce) e target (per chi)
    const context = await requireSafeAuth();
    const userId = context.target.id;
    const actorAccountType = context.actor.account_type;

    const body = await request.json();
    const { configId, enabledCouriers } = body;

    // Validazione input
    if (!configId || typeof configId !== "string") {
      return NextResponse.json(
        { error: "configId richiesto" },
        { status: 400 }
      );
    }

    if (!Array.isArray(enabledCouriers) || enabledCouriers.length === 0) {
      return NextResponse.json(
        { error: "enabledCouriers deve essere un array non vuoto" },
        { status: 400 }
      );
    }

    // Sanitizza input
    const sanitizedCouriers = enabledCouriers
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
      .filter((c) => c.length > 0);

    if (sanitizedCouriers.length === 0) {
      return NextResponse.json(
        { error: "Nessun corriere valido fornito" },
        { status: 400 }
      );
    }

    // Verifica ownership della configurazione
    const { data: config, error: configError } = await supabaseAdmin
      .from("courier_configs")
      .select("id, owner_user_id, automation_settings")
      .eq("id", configId)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "Configurazione non trovata" },
        { status: 404 }
      );
    }

    // RBAC: Solo owner o admin può modificare
    const isOwner = config.owner_user_id === userId;
    const isAdmin =
      actorAccountType === "admin" || actorAccountType === "superadmin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Non autorizzato a modificare questa configurazione" },
        { status: 403 }
      );
    }

    // Merge con automation_settings esistenti
    const existingSettings =
      (config.automation_settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...existingSettings,
      enabled_carriers: sanitizedCouriers,
      courier_settings_updated_at: new Date().toISOString(),
    };

    // Aggiorna configurazione
    const { error: updateError } = await supabaseAdmin
      .from("courier_configs")
      .update({
        automation_settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (updateError) {
      console.error("Errore aggiornamento courier settings:", updateError);
      return NextResponse.json(
        { error: "Errore salvataggio preferenze" },
        { status: 500 }
      );
    }

    console.log(
      `✅ [COURIER-SETTINGS] Aggiornato config ${configId.substring(0, 8)}...`,
      {
        enabledCouriers: sanitizedCouriers,
        userId,
      }
    );

    return NextResponse.json({
      success: true,
      enabledCouriers: sanitizedCouriers,
    });
  } catch (error: any) {
    console.error("Errore API update-courier-settings:", error);
    return NextResponse.json(
      { error: error.message || "Errore interno" },
      { status: 500 }
    );
  }
}
