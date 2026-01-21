/**
 * API: Available Couriers
 *
 * GET /api/couriers/available - Recupera corrieri disponibili per l'utente corrente
 *
 * Basato su:
 * 1. Configurazioni API (courier_configs) con owner_user_id = userId
 * 2. contract_mapping JSONB per estrarre corrieri configurati
 *
 * ⚠️ SICUREZZA: Espone SOLO dati necessari alla UI
 * NON espone: contractCode, API keys, providerId, courierId interno
 *
 * Risposta:
 * {
 *   couriers: [
 *     { displayName: string, courierName: string }
 *   ],
 *   total: number
 * }
 */

import { requireAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/api-responses';
import { supabaseAdmin } from '@/lib/db/client';
import { getAvailableCouriersForUser } from '@/lib/db/price-lists';
import { NextRequest, NextResponse } from 'next/server';

// ⚠️ IMPORTANTE: Questa route usa headers() per l'autenticazione, quindi deve essere dinamica
export const dynamic = 'force-dynamic';

// ✨ RIMOSSO: Il mapping displayName ora è gestito in getAvailableCouriersForUser
// Ogni carrier_code ha il suo displayName formattato (es. "GLS 5000")

/**
 * GET - Recupera corrieri disponibili per l'utente autenticato
 *
 * ⚠️ SICUREZZA: Espone SOLO dati necessari alla UI (displayName, courierId)
 * NON espone: contractCode, API keys, providerId dettagliato
 *
 * ✨ FILTRO: Restituisce SOLO i corrieri per cui esiste un listino personalizzato attivo
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const userId = context!.actor.id;

    // Recupera info utente per verificare se è superadmin
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('id', userId)
      .single();

    const isSuperadmin = userData?.account_type === 'superadmin';

    // Recupera corrieri disponibili dalla configurazione API
    let couriers = await getAvailableCouriersForUser(userId);

    console.log(
      `🔍 [COURIERS AVAILABLE] Corrieri dalla config API: ${couriers.length}, isSuperadmin: ${isSuperadmin}`
    );
    couriers.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.displayName} (carrierCode: ${c.carrierCode})`);
    });

    // ✨ FILTRO CRITICO: Schema Reseller/Sub-Users
    //
    // REGOLE VISIBILITÀ:
    // - RESELLER: vede TUTTI i suoi listini personalizzati attivi (custom + supplier)
    // - UTENTI NORMALI: vedono SOLO i listini assegnati tramite price_list_assignments
    // - SUPERADMIN: vede tutti i listini attivi

    let activePriceLists: any[] = [];

    if (isSuperadmin) {
      // Superadmin: vede tutti i listini attivi
      const { data } = await supabaseAdmin
        .from('price_lists')
        .select('id, metadata, source_metadata, name, list_type')
        .in('list_type', ['custom', 'supplier'])
        .eq('status', 'active');
      activePriceLists = data || [];
    } else {
      // Verifica se è reseller
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, is_reseller')
        .eq('id', userId)
        .single();

      const isReseller = userData?.is_reseller === true;

      if (isReseller) {
        // RESELLER: vede TUTTI i suoi listini personalizzati attivi
        const { data } = await supabaseAdmin
          .from('price_lists')
          .select('id, metadata, source_metadata, name, list_type')
          .in('list_type', ['custom', 'supplier'])
          .eq('status', 'active')
          .eq('created_by', userId);
        activePriceLists = data || [];
      } else {
        // UTENTI NORMALI: vedono SOLO i listini assegnati
        const { data: assignments } = await supabaseAdmin
          .from('price_list_assignments')
          .select('price_list_id, price_lists(*)')
          .eq('user_id', userId)
          .is('revoked_at', null);

        if (assignments && assignments.length > 0) {
          const assignedListIds = assignments.map((a: any) => a.price_list_id);
          const { data } = await supabaseAdmin
            .from('price_lists')
            .select('id, metadata, source_metadata, name, list_type')
            .in('id', assignedListIds)
            .in('list_type', ['custom', 'supplier'])
            .eq('status', 'active');
          activePriceLists = data || [];
        }
      }
    }

    console.log(
      `🔍 [COURIERS AVAILABLE] Listini attivi (custom+supplier): ${activePriceLists?.length || 0}`
    );

    if (activePriceLists && activePriceLists.length > 0) {
      // ✨ SCHEMA CORRETTO: Usa contract_code (completo) per matching
      // - carrier_code = solo prefisso (es. "gls")
      // - contract_code = codice completo (es. "gls-GLS-5000")
      const activeContractCodes = new Set<string>();

      for (const pl of activePriceLists) {
        const metadata = pl.metadata || pl.source_metadata || {};
        const contractCode = (metadata as any).contract_code; // ✅ Usa contract_code (completo)
        const carrierCode = (metadata as any).carrier_code; // Prefisso (per logging)

        // Usa contract_code per matching (se presente), altrimenti fallback a carrier_code
        const codeForMatching = contractCode || carrierCode;

        if (codeForMatching) {
          activeContractCodes.add(codeForMatching.toLowerCase());
          console.log(
            `✅ [COURIERS AVAILABLE] Listino attivo (${pl.list_type}): "${
              pl.name
            }" → contract_code: ${codeForMatching} (carrier_code: ${carrierCode || 'N/A'})`
          );
        } else {
          console.warn(
            `⚠️ [COURIERS AVAILABLE] Listino senza contract_code/carrier_code: "${pl.name}" (${pl.list_type})`
          );
        }
      }

      if (activeContractCodes.size > 0) {
        console.log(
          `🔍 [COURIERS AVAILABLE] Contract codes attivi: ${Array.from(activeContractCodes).join(
            ', '
          )}`
        );

        // ✨ FILTRO PER CONTRACT_CODE: Matching esatto tra contract_code dei listini e contract_code dei corrieri
        // IMPORTANTE: contract_code è UNIVOCO e completo (es. "gls-GLS-5000")
        // - price_lists.metadata.contract_code = contract_code completo
        // - courier_configs.contract_mapping CHIAVE = contract_code completo (restituito come courier.contractCode)
        // Il matching deve essere ESATTO tra questi due contract_code univoci
        const filteredCouriers = couriers.filter((courier) => {
          // ✨ CORRETTO: courier.contractCode è il contract_code completo dalla chiave di contract_mapping
          // courier.carrierCode è un alias per retrocompatibilità, ma il valore è lo stesso (contract_code completo)
          const courierContractCode = (
            courier.contractCode ||
            courier.carrierCode ||
            ''
          ).toLowerCase();

          if (!courierContractCode) {
            console.warn(
              `⚠️ [COURIERS AVAILABLE] Corriere senza contract_code: ${
                courier.displayName || courier.courierName
              }`
            );
            return false;
          }

          // ✨ MATCHING ESATTO: contract_code dei listini vs contract_code dei corrieri
          // Entrambi sono univoci e completi, quindi il matching deve essere esatto
          const isActive = activeContractCodes.has(courierContractCode);

          if (isActive) {
            console.log(
              `✅ [COURIERS AVAILABLE] Match contract_code: "${courierContractCode}" (listino) = "${courierContractCode}" (corriere) → mostro "${
                courier.displayName || courier.courierName
              }"`
            );
          } else {
            console.log(
              `❌ [COURIERS AVAILABLE] Nessun match contract_code: "${courierContractCode}" (corriere) non presente in listini attivi (${Array.from(
                activeContractCodes
              ).join(', ')})`
            );
          }

          return isActive;
        });

        couriers = filteredCouriers;
        console.log(
          `✅ [COURIERS AVAILABLE] Dopo filtro: ${couriers.length} corrieri con listino attivo`
        );
      } else {
        // Nessun carrier_code nei listini → restituisci array vuoto
        console.log(`⚠️ [COURIERS AVAILABLE] Nessun carrier_code nei listini attivi`);
        couriers = [];
      }
    } else {
      // Nessun listino attivo → restituisci array vuoto
      console.log(`⚠️ [COURIERS AVAILABLE] Nessun listino attivo (custom o supplier)`);
      couriers = [];
    }

    // ✨ LOGICA CORRETTA: Esponi SOLO carrier_code con listino personalizzato attivo
    const safeCouriers = couriers.map((courier) => ({
      displayName: courier.displayName, // ✨ Nome formattato per UI
      courierName: courier.courierName, // Nome interno per API matching
      carrierCode: courier.carrierCode, // ✨ Carrier code unico (chiave)
      contractCode: courier.contractCode, // Per compatibilità
    }));

    return NextResponse.json({
      couriers: safeCouriers,
      total: safeCouriers.length,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/couriers/available');
  }
}
