/**
 * API Route: Quote da Database (Price Lists)
 *
 * ✨ ENTERPRISE: Preventivi veloci da DB senza chiamate API esterne
 *
 * Il sistema funziona SOLO con matrici database (price_lists).
 * Nessuna chiamata API esterna viene effettuata.
 *
 * Per utenti normali (User, Reseller, BYOC):
 * - Calcola preventivi da price_lists nel database
 * - Applica margini configurati
 * - Isolamento: ogni utente vede solo i suoi listini assegnati
 *
 * ⚠️ SICUREZZA: RLS garantisce che ogni utente veda solo i suoi listini
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import {
  calculateBestPriceForReseller,
  calculatePriceWithRules,
} from '@/lib/db/price-lists-advanced';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = await request.json();
    const {
      weight,
      zip,
      province,
      city,
      services = [],
      insuranceValue = 0,
      codValue = 0,
      dimensions,
    } = body;

    // Validazione parametri minimi
    if (!weight || weight <= 0) {
      return NextResponse.json({ error: 'Peso obbligatorio e deve essere > 0' }, { status: 400 });
    }

    if (!zip) {
      return NextResponse.json({ error: 'CAP destinazione obbligatorio' }, { status: 400 });
    }

    // Recupera info utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    const isSuperadmin = user.account_type === 'superadmin';
    const isReseller = user.is_reseller === true;

    // ✨ ENTERPRISE: Calcola preventivi da DB per ogni corriere disponibile
    // Recupera corrieri disponibili per l'utente
    const { getAvailableCouriersForUser } = await import('@/lib/db/price-lists');
    let availableCouriers = await getAvailableCouriersForUser(user.id);

    console.log(
      `🔍 [QUOTES DB] Utente: ${context.actor.email}, isReseller: ${isReseller}, isSuperadmin: ${isSuperadmin}`
    );
    console.log(`🔍 [QUOTES DB] Corrieri disponibili dalla config: ${availableCouriers.length}`);
    availableCouriers.forEach((c, i) => {
      console.log(
        `   ${i + 1}. ${c.displayName || c.courierName} (carrierCode: ${
          c.carrierCode || c.contractCode
        })`
      );
    });

    if (!availableCouriers || availableCouriers.length === 0) {
      return NextResponse.json({
        success: true,
        rates: [],
        message: 'Nessun corriere configurato per questo utente',
      });
    }

    // ✨ LOGICA CORRETTA: Schema Reseller/Sub-Users
    //
    // REGOLE VISIBILITÀ:
    // - RESELLER: vede TUTTI i suoi listini personalizzati attivi (custom + supplier creati da lui)
    // - UTENTI NORMALI (sub-users): vedono SOLO i listini assegnati tramite price_list_assignments
    // - SUPERADMIN: vede tutti i listini attivi

    let activePriceLists: any[] = [];

    if (isSuperadmin) {
      // Superadmin: vede tutti i listini attivi
      const { data } = await supabaseAdmin
        .from('price_lists')
        .select('id, courier_id, metadata, source_metadata, name, list_type, created_by')
        .in('list_type', ['custom', 'supplier'])
        .eq('status', 'active');
      activePriceLists = data || [];
    } else if (isReseller) {
      // RESELLER: vede TUTTI i suoi listini personalizzati attivi (custom + supplier)
      const { data } = await supabaseAdmin
        .from('price_lists')
        .select('id, courier_id, metadata, source_metadata, name, list_type, created_by')
        .in('list_type', ['custom', 'supplier'])
        .eq('status', 'active')
        .eq('created_by', user.id);
      activePriceLists = data || [];
    } else {
      // UTENTI NORMALI: vedono SOLO i listini assegnati tramite price_list_assignments
      const { data: assignments } = await supabaseAdmin
        .from('price_list_assignments')
        .select('price_list_id, price_lists(*)')
        .eq('user_id', user.id)
        .is('revoked_at', null);

      if (assignments && assignments.length > 0) {
        const assignedListIds = assignments.map((a) => a.price_list_id);
        const { data } = await supabaseAdmin
          .from('price_lists')
          .select('id, courier_id, metadata, source_metadata, name, list_type, created_by')
          .in('id', assignedListIds)
          .in('list_type', ['custom', 'supplier'])
          .eq('status', 'active');
        activePriceLists = data || [];
      }
    }

    console.log(
      `🔍 [QUOTES DB] Listini attivi (custom+supplier) trovati: ${activePriceLists?.length || 0}`
    );

    // ✨ VALIDAZIONE: Reseller può creare spedizioni SOLO se ha listini personalizzati attivi
    if (isReseller) {
      const customPriceLists = activePriceLists.filter((pl) => pl.list_type === 'custom');
      if (customPriceLists.length === 0) {
        console.log(`⚠️ [QUOTES DB] Reseller senza listini personalizzati attivi`);
        return NextResponse.json({
          success: true,
          rates: [],
          message:
            'Nessun listino personalizzato attivo. Attiva un listino personalizzato per creare spedizioni.',
        });
      }
      console.log(
        `✅ [QUOTES DB] Reseller: ${customPriceLists.length} listini personalizzati attivi`
      );
    }

    if (activePriceLists && activePriceLists.length > 0) {
      // ✨ SCHEMA CORRETTO:
      // - carrier_code = solo prefisso (es. "gls") → nome base del corriere
      // - contract_code = codice completo (es. "gls-GLS-5000") → identificatore contratto univoco
      //
      // Per il matching, usiamo contract_code (completo) perché matcha con i corrieri disponibili
      const activeContractCodes = new Set<string>();
      const contractCodeToListId = new Map<string, string>(); // Per tracciare quale listino usare

      for (const pl of activePriceLists) {
        const metadata = pl.metadata || pl.source_metadata || {};
        const contractCode = (metadata as any).contract_code; // ✅ Usa contract_code (completo)
        const carrierCode = (metadata as any).carrier_code; // Prefisso (per logging)

        console.log(`🔍 [QUOTES DB] Listino (${pl.list_type}): "${pl.name}"`);
        console.log(`   - carrier_code (prefisso): "${carrierCode || 'N/A'}"`);
        console.log(`   - contract_code (completo): "${contractCode || 'N/A'}"`);

        // ✅ Usa contract_code per matching (se presente), altrimenti fallback a carrier_code
        const codeForMatching = contractCode || carrierCode;

        if (codeForMatching) {
          activeContractCodes.add(codeForMatching.toLowerCase());
          contractCodeToListId.set(codeForMatching.toLowerCase(), pl.id);
          console.log(
            `✅ [QUOTES DB] Listino attivo (${pl.list_type}): "${pl.name}" → contract_code: ${codeForMatching}`
          );
        } else {
          // Listino senza contract_code/carrier_code: potrebbe essere un listino globale o legacy
          console.warn(
            `⚠️ [QUOTES DB] Listino senza contract_code/carrier_code: "${pl.name}" (${pl.list_type}, ID: ${pl.id})`
          );
          console.warn(`   metadata completo:`, JSON.stringify(metadata));
        }
      }

      if (activeContractCodes.size === 0) {
        console.log(`⚠️ [QUOTES DB] Nessun listino con contract_code valido`);
        // ⚠️ FALLBACK: Se nessun listino ha contract_code, mostra messaggio
        return NextResponse.json({
          success: true,
          rates: [],
          message:
            'I listini attivi non hanno contract_code configurato. Sincronizza i listini o aggiorna i metadata.',
        });
      }

      console.log(
        `🔍 [QUOTES DB] Contract codes attivi dai listini: ${Array.from(activeContractCodes).join(
          ', '
        )}`
      );
      console.log(`🔍 [QUOTES DB] Corrieri disponibili dalla config: ${availableCouriers.length}`);
      availableCouriers.forEach((c, i) => {
        console.log(
          `   ${i + 1}. ${c.displayName || c.courierName} (carrierCode: ${
            c.carrierCode || c.contractCode
          })`
        );
      });

      // ✨ FILTRO PER CONTRACT_CODE: Matching esatto tra contract_code dei listini e contract_code dei corrieri
      // IMPORTANTE: contract_code è UNIVOCO e completo (es. "gls-GLS-5000")
      // - price_lists.metadata.contract_code = contract_code completo
      // - courier_configs.contract_mapping CHIAVE = contract_code completo (restituito come courier.contractCode)
      // Il matching deve essere ESATTO tra questi due contract_code univoci
      const filteredCouriers = availableCouriers.filter((courier) => {
        // ✨ CORRETTO: courier.contractCode è il contract_code completo dalla chiave di contract_mapping
        // courier.carrierCode è un alias per retrocompatibilità, ma il valore è lo stesso (contract_code completo)
        const courierContractCode = (
          courier.contractCode ||
          courier.carrierCode ||
          ''
        ).toLowerCase();

        if (!courierContractCode) {
          console.warn(
            `⚠️ [QUOTES DB] Corriere senza contract_code: ${
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
            `✅ [QUOTES DB] Match contract_code: "${courierContractCode}" (listino) = "${courierContractCode}" (corriere) → mostro "${
              courier.displayName || courier.courierName
            }"`
          );
        } else {
          console.log(
            `❌ [QUOTES DB] Nessun match contract_code: "${courierContractCode}" (corriere) non presente in listini attivi (${Array.from(
              activeContractCodes
            ).join(', ')})`
          );
        }

        return isActive;
      });

      availableCouriers = filteredCouriers;
      console.log(
        `✅ [QUOTES DB] Dopo filtro: ${availableCouriers.length} carrier_code con listino personalizzato attivo`
      );

      if (availableCouriers.length === 0) {
        return NextResponse.json({
          success: true,
          rates: [],
          message:
            'Nessun carrier_code corrisponde ai listini personalizzati attivi. Verifica la configurazione.',
        });
      }
    } else {
      // Nessun listino personalizzato attivo: non mostrare nessun corriere
      console.log(
        `⚠️ [QUOTES DB] Nessun listino personalizzato attivo, nessun corriere disponibile`
      );
      return NextResponse.json({
        success: true,
        rates: [],
        message:
          'Nessun listino personalizzato attivo. Attiva un listino personalizzato per vedere i preventivi.',
      });
    }

    // Calcola preventivi per ogni corriere
    const rates: any[] = [];
    const errors: string[] = [];

    console.log(
      `🔍 [QUOTES DB] Inizio calcolo preventivi per ${availableCouriers.length} corrieri filtrati`
    );

    if (availableCouriers.length === 0) {
      console.warn(`⚠️ [QUOTES DB] Nessun corriere disponibile dopo filtro!`);
      return NextResponse.json({
        success: true,
        rates: [],
        message: 'Nessun corriere disponibile con listino attivo.',
      });
    }

    for (const courier of availableCouriers) {
      console.log(
        `🔍 [QUOTES DB] Calcolo preventivo per: ${
          courier.displayName || courier.courierName
        } (carrierCode: ${courier.carrierCode || courier.contractCode})`
      );
      try {
        // Per reseller E superadmin: usa sistema listini avanzato
        let quoteResult: any;

        if (isReseller || isSuperadmin) {
          // ✨ Passa anche contractCode per filtrare listini per contract_code nei metadata
          const bestPriceResult = await calculateBestPriceForReseller(user.id, {
            weight: parseFloat(weight),
            destination: {
              zip,
              province,
              country: 'IT',
            },
            courierId: courier.courierId || undefined, // courierId opzionale
            contractCode: courier.carrierCode || courier.contractCode, // ✨ NUOVO: per matching contract_code
            serviceType: services.includes('express') ? 'express' : 'standard',
            options: {
              declaredValue: parseFloat(insuranceValue) || 0,
              cashOnDelivery: parseFloat(codValue) > 0,
              insurance: parseFloat(insuranceValue) > 0,
            },
          });

          if (bestPriceResult && bestPriceResult.bestPrice) {
            quoteResult = bestPriceResult.bestPrice;
            // Aggiungi metadata per tracciare quale API è stata usata
            quoteResult._apiSource = bestPriceResult.apiSource;

            // ✨ ENTERPRISE: Usa courier_config_id dal listino personalizzato se presente
            // Questo è fondamentale per usare la configurazione API corretta nella creazione spedizione
            if (quoteResult._courierConfigId) {
              quoteResult._configId = quoteResult._courierConfigId;
              console.log(
                `✅ [QUOTES DB] Usato courier_config_id dal listino personalizzato: ${quoteResult._courierConfigId}`
              );
            } else {
              // Fallback: usa identificatore generico
              quoteResult._configId =
                bestPriceResult.apiSource === 'reseller' ? 'reseller_config' : 'master_config';
            }
          } else {
            console.warn(
              `⚠️ [QUOTES DB] calculateBestPriceForReseller non ha restituito risultati per ${
                courier.displayName || courier.courierName
              }`
            );
            console.warn(`   - bestPriceResult:`, bestPriceResult);
          }
        } else {
          // Utente normale: calcola da listino assegnato
          quoteResult = await calculatePriceWithRules(user.id, {
            weight: parseFloat(weight),
            destination: {
              zip,
              province,
              country: 'IT',
            },
            courierId: courier.courierId || undefined, // courierId opzionale
            serviceType: services.includes('express') ? 'express' : 'standard',
            options: {
              declaredValue: parseFloat(insuranceValue) || 0,
              cashOnDelivery: parseFloat(codValue) > 0,
              insurance: parseFloat(insuranceValue) > 0,
            },
          });
        }

        if (quoteResult && quoteResult.finalPrice) {
          // Formatta come rate per compatibilità con IntelligentQuoteComparator
          //
          // ✨ SCHEMA RESELLER:
          // - weight_price = COSTO FORNITORE (prezzo dal listino fornitore originale, tramite master_list_id)
          // - total_price = PREZZO VENDITA (prezzo finale dal listino personalizzato attivo, con margine)
          //
          // Se è un listino personalizzato con master_list_id, usa supplierPrice (costo fornitore originale)
          // Altrimenti usa totalCost (per listini fornitore o senza master_list_id)

          // 🔍 LOGGING DETTAGLIATO: Traccia valori ricevuti da calculatePriceWithRules
          console.log(
            `🔍 [QUOTES DB] Valori ricevuti da calculatePriceWithRules per ${
              courier.displayName || courier.courierName
            }:`
          );
          console.log(
            `   - quoteResult.basePrice: €${quoteResult.basePrice?.toFixed(2) || 'undefined'}`
          );
          console.log(
            `   - quoteResult.surcharges: €${quoteResult.surcharges?.toFixed(2) || 'undefined'}`
          );
          console.log(`   - quoteResult.margin: €${quoteResult.margin?.toFixed(2) || 'undefined'}`);
          console.log(
            `   - quoteResult.totalCost: €${quoteResult.totalCost?.toFixed(2) || 'undefined'}`
          );
          console.log(
            `   - quoteResult.finalPrice: €${quoteResult.finalPrice?.toFixed(2) || 'undefined'}`
          );
          console.log(
            `   - quoteResult.supplierPrice: €${
              quoteResult.supplierPrice?.toFixed(2) || 'undefined'
            }`
          );
          console.log(`   - quoteResult.priceListId: ${quoteResult.priceListId}`);
          console.log(
            `   - quoteResult.appliedPriceList.name: ${
              (quoteResult.appliedPriceList as any)?.name || 'N/A'
            }`
          );
          console.log(
            `   - quoteResult.appliedPriceList.list_type: ${
              (quoteResult.appliedPriceList as any)?.list_type || 'N/A'
            }`
          );
          console.log(
            `   - quoteResult.appliedPriceList.master_list_id: ${
              (quoteResult.appliedPriceList as any)?.master_list_id || 'N/A'
            }`
          );
          console.log(
            `   - quoteResult.appliedPriceList.default_margin_percent: ${
              (quoteResult.appliedPriceList as any)?.default_margin_percent ?? 'N/A'
            }`
          );
          console.log(
            `   - quoteResult.appliedPriceList.default_margin_fixed: ${
              (quoteResult.appliedPriceList as any)?.default_margin_fixed ?? 'N/A'
            }`
          );

          // ✨ FIX: Usa supplierPriceOriginal se disponibile (prezzo originale nella modalità VAT del master)
          // Altrimenti usa supplierPrice (normalizzato IVA esclusa per calcoli)
          const supplierPrice =
            (quoteResult as any).supplierPriceOriginal ?? // Prezzo originale master (con IVA inclusa se master ha IVA inclusa)
            quoteResult.supplierPrice ?? // Prezzo normalizzato IVA esclusa (per calcoli)
            quoteResult.totalCost ??
            quoteResult.basePrice ??
            0;

          console.log(
            `💰 [QUOTES DB] Mapping valori per ${courier.displayName || courier.courierName}:`
          );
          console.log(
            `   - supplierPrice calcolato: €${supplierPrice.toFixed(2)} (${
              quoteResult.supplierPrice !== undefined
                ? 'supplierPrice'
                : quoteResult.totalCost !== undefined
                  ? 'totalCost'
                  : 'basePrice'
            })`
          );
          console.log(`   - total_price (finalPrice): €${quoteResult.finalPrice.toFixed(2)}`);
          console.log(`   - weight_price (supplierPrice): €${supplierPrice.toFixed(2)}`);
          console.log(
            `   - Differenza (margine): €${(quoteResult.finalPrice - supplierPrice).toFixed(2)}`
          );

          // Verifica che il margine sia stato calcolato correttamente
          if (supplierPrice === quoteResult.finalPrice && quoteResult.margin === 0) {
            console.warn(
              `⚠️ [QUOTES DB] ⚠️ PROBLEMA RILEVATO: Margine 0% per ${courier.courierName}`
            );
            console.warn(`   - Costo fornitore = prezzo finale (€${supplierPrice.toFixed(2)})`);
            console.warn(`   - Listino ID: ${quoteResult.priceListId}`);
            console.warn(
              `   - Listino tipo: ${(quoteResult.appliedPriceList as any)?.list_type || 'N/A'}`
            );
            console.warn(
              `   - Master List ID: ${
                (quoteResult.appliedPriceList as any)?.master_list_id || 'N/A'
              }`
            );
            console.warn(
              `   - default_margin_percent: ${
                (quoteResult.appliedPriceList as any)?.default_margin_percent ?? 'N/A'
              }`
            );
            console.warn(
              `   - default_margin_fixed: ${
                (quoteResult.appliedPriceList as any)?.default_margin_fixed ?? 'N/A'
              }`
            );
            console.warn(`   - ⚠️ Il prezzo di vendita non riflette il listino personalizzato!`);
          } else if (quoteResult.margin > 0) {
            console.log(
              `✅ [QUOTES DB] Margine calcolato correttamente per ${
                courier.courierName
              }: €${supplierPrice.toFixed(2)} + €${quoteResult.margin.toFixed(
                2
              )} = €${quoteResult.finalPrice.toFixed(2)}`
            );
          } else {
            console.warn(
              `⚠️ [QUOTES DB] Margine = 0 ma finalPrice ≠ supplierPrice: €${supplierPrice.toFixed(
                2
              )} vs €${quoteResult.finalPrice.toFixed(2)}`
            );
          }

          // ✨ ENTERPRISE: Normalizza contractCode per evitare problemi di matching
          // Se contractCode è null/undefined o contiene solo "default", usa "default" standardizzato
          let normalizedContractCode = courier.contractCode || 'default';
          if (
            normalizedContractCode.toLowerCase().includes('default') &&
            normalizedContractCode !== 'default'
          ) {
            // Se contiene "default" ma non è esattamente "default", normalizza
            normalizedContractCode = 'default';
          }

          const rate = {
            carrierCode: courier.courierName.toLowerCase(),
            contractCode: normalizedContractCode,
            total_price: quoteResult.finalPrice.toString(), // ✨ Prezzo finale CON margine
            weight_price: supplierPrice.toString(), // ✨ Costo fornitore SENZA margine (totalCost)
            base_price: quoteResult.basePrice?.toString() || supplierPrice.toString(),
            surcharges: quoteResult.surcharges?.toString() || '0',
            margin: quoteResult.margin?.toString() || '0',
            _source: 'db', // ✨ Flag: prezzo da DB
            _priceListId: quoteResult.priceListId,
            _apiSource: quoteResult._apiSource || 'db',
            _configId: quoteResult._configId || quoteResult._courierConfigId, // ✨ Usa courier_config_id se presente

            // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali per retrocompatibilità
            vat_mode: quoteResult.vatMode || 'excluded', // Default per retrocompatibilità
            vat_rate: (quoteResult.vatRate || 22.0).toString(),
            vat_amount: quoteResult.vatAmount?.toString() || '0',
            total_price_with_vat:
              quoteResult.totalPriceWithVAT?.toString() || quoteResult.finalPrice.toString(),
          };

          console.log(
            `📤 [QUOTES DB] Rate mappato per ${courier.displayName || courier.courierName}:`
          );
          console.log(
            `   - total_price: ${
              rate.total_price
            } (da finalPrice: €${quoteResult.finalPrice.toFixed(2)})`
          );
          console.log(
            `   - weight_price: ${
              rate.weight_price
            } (da supplierPrice: €${supplierPrice.toFixed(2)})`
          );
          console.log(
            `   - margin: ${rate.margin} (da margin: €${quoteResult.margin?.toFixed(2) || '0.00'})`
          );
          console.log(`   - vat_mode: ${rate.vat_mode} (ADR-001)`);
          console.log(`   - vat_rate: ${rate.vat_rate}% (ADR-001)`);
          console.log(`   - vat_amount: ${rate.vat_amount} (ADR-001)`);
          console.log(`   - total_price_with_vat: ${rate.total_price_with_vat} (ADR-001)`);

          rates.push(rate);
          console.log(
            `✅ [QUOTES DB] Rate aggiunto per ${
              courier.displayName || courier.courierName
            }: €${quoteResult.finalPrice.toFixed(2)}`
          );
        } else {
          console.warn(
            `⚠️ [QUOTES DB] quoteResult non valido per ${
              courier.displayName || courier.courierName
            }:`,
            {
              hasQuoteResult: !!quoteResult,
              hasFinalPrice: !!(quoteResult && quoteResult.finalPrice),
              finalPrice: quoteResult?.finalPrice,
            }
          );
        }
      } catch (error: any) {
        console.error(`❌ [QUOTES DB] Errore calcolo per ${courier.courierName}:`, error);
        errors.push(`${courier.courierName}: ${error.message}`);
      }
    }

    console.log(
      `📊 [QUOTES DB] Riepilogo calcolo: ${rates.length} rates calcolati, ${errors.length} errori`
    );

    // ✨ RIMOSSO: Verifica costi API non più supportata
    // Il sistema funziona SOLO con matrici database

    // ✨ LOGICA CORRETTA: NESSUNA deduplicazione per displayName
    // Ogni carrier_code è un'opzione separata (es. "GLS 5000" e "GLS 5000-BA" sono diversi)
    // Deduplicazione SOLO per carrier_code IDENTICI (rate esattamente uguali)
    const deduplicatedRates = new Map<string, (typeof rates)[0]>();

    for (const rate of rates) {
      // Chiave = carrier_code (chiave UNICA per ogni tariffa)
      const key = (rate.contractCode || rate.carrierCode || '').toLowerCase();

      if (!deduplicatedRates.has(key)) {
        deduplicatedRates.set(key, rate);
      }
      // Se esiste già lo stesso carrier_code, ignora (è un duplicato esatto)
    }

    const finalRates = Array.from(deduplicatedRates.values());

    // Ordina per prezzo crescente (più economico prima)
    finalRates.sort((a, b) => {
      const priceA = parseFloat(a.total_price || '0');
      const priceB = parseFloat(b.total_price || '0');
      return priceA - priceB;
    });

    console.log(
      `✅ [QUOTES DB] Rates finali: ${finalRates.length} (ordinati per prezzo crescente)`
    );
    console.log(
      `🔒 [QUOTES DB] ⚠️ IMPORTANTE: Nessuna chiamata API esterna effettuata. Tutti i prezzi calcolati da matrici database.`
    );

    if (finalRates.length === 0) {
      console.warn(`⚠️ [QUOTES DB] NESSUN rate calcolato! Possibili cause:`);
      console.warn(`   1. Nessun listino attivo trovato`);
      console.warn(`   2. Matching contract_code fallito`);
      console.warn(`   3. Calcolo prezzo fallito per tutti i corrieri`);
      console.warn(`   4. Listini senza entries (matrice vuota)`);
      console.warn(`   - Corrieri disponibili dopo filtro: ${availableCouriers.length}`);
      console.warn(`   - Rates calcolati: ${rates.length}`);
      console.warn(`   - Errori: ${errors.length}`);
    }

    return NextResponse.json({
      success: true,
      rates: finalRates,
      details: {
        source: 'database',
        cached: false,
        totalRates: finalRates.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('❌ [QUOTES DB] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il calcolo preventivi da DB',
      },
      { status: 500 }
    );
  }
}
