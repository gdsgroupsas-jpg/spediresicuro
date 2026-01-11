/**
 * API Route: Admin User Features Management
 *
 * GET /api/admin/users/[id]/features - Ottieni features attive per un utente
 *
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di eseguire operazioni
 */

import { auth } from "@/lib/auth-config";
import { findUserByEmail } from "@/lib/database";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // 2. Verifica che l'utente sia admin
    const adminUser = await findUserByEmail(session.user.email);

    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json(
        { error: "Accesso negato. Solo gli admin possono accedere." },
        { status: 403 }
      );
    }

    // 3. Ottieni ID utente
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: "ID utente mancante" },
        { status: 400 }
      );
    }

    // 4. Ottieni email utente
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase non configurato" },
        { status: 503 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    // 5. Ottieni tutte le features disponibili
    const { data: allFeatures } = await supabaseAdmin
      .from("killer_features")
      .select("*")
      .order("display_order", { ascending: true });

    // 6. Ottieni features attive per l'utente
    const { data: userFeatures } = await supabaseAdmin
      .from("user_features")
      .select("*, killer_features(*)")
      .eq("user_email", user.email)
      .eq("is_active", true);

    // 7. Ottieni metadata da Auth Users (per feature flag AI e altro)
    let userMetadata = {};
    try {
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (!authError && authUser?.user) {
        userMetadata = authUser.user.user_metadata || {};
      }
    } catch (err) {
      console.warn("Errore lettura metadata Auth:", err);
    }

    // 8. Combina i dati
    const featuresWithStatus = (allFeatures || []).map((feature: any) => {
      const userFeature = (userFeatures || []).find(
        (uf: any) => uf.feature_id === feature.id
      );

      return {
        ...feature,
        is_active_for_user: !!userFeature,
        expires_at: userFeature?.expires_at || null,
        activation_type: userFeature?.activation_type || null,
      };
    });

    return NextResponse.json({
      success: true,
      features: featuresWithStatus,
      userEmail: user.email,
      metadata: userMetadata, // Aggiunto field metadata
    });
  } catch (error: any) {
    console.error("Errore API admin user features:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
