/**
 * API Route: Quote da Database (Price Lists)
 *
 * ✨ ENTERPRISE: Preventivi veloci da DB senza chiamate API esterne
 *
 * Per utenti normali (User, Reseller, BYOC):
 * - Calcola preventivi da price_lists nel database
 * - Applica margini configurati
 * - Isolamento: ogni utente vede solo i suoi listini assegnati
 *
 * Per SuperAdmin:
 * - Se verifyCosts=true, mostra anche prezzi API reali per confronto
 *
 * ⚠️ SICUREZZA: RLS garantisce che ogni utente veda solo i suoi listini
 */

import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import {
  calculateBestPriceForReseller,
  calculatePriceWithRules,
} from "@/lib/db/price-lists-advanced";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
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
      verifyCosts = false, // ✨ Flag per superadmin: mostra anche prezzi API reali
    } = body;

    // Validazione parametri minimi
    if (!weight || weight <= 0) {
      return NextResponse.json(
        { error: "Peso obbligatorio e deve essere > 0" },
        { status: 400 }
      );
    }

    if (!zip) {
      return NextResponse.json(
        { error: "CAP destinazione obbligatorio" },
        { status: 400 }
      );
    }

    // Recupera info utente
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    const isSuperadmin = user.account_type === "superadmin";
    const isReseller = user.is_reseller === true;

    // ✨ ENTERPRISE: Calcola preventivi da DB per ogni corriere disponibile
    // Recupera corrieri disponibili per l'utente
    const { getAvailableCouriersForUser } = await import(
      "@/lib/db/price-lists"
    );
    let availableCouriers = await getAvailableCouriersForUser(user.id);

    if (!availableCouriers || availableCouriers.length === 0) {
      return NextResponse.json({
        success: true,
        rates: [],
        message: "Nessun corriere configurato per questo utente",
      });
    }

    // ✨ FIX: Per reseller, filtra solo corrieri con listino personalizzato ATTIVO
    if (isReseller) {
      // Recupera listini personalizzati attivi del reseller
      const { data: activeCustomPriceLists } = await supabaseAdmin
        .from('price_lists')
        .select('courier_id')
        .eq('created_by', user.id)
        .eq('list_type', 'custom')
        .eq('status', 'active')

      if (activeCustomPriceLists && activeCustomPriceLists.length > 0) {
        // Verifica se ci sono listini globali (courier_id = null)
        const hasGlobalList = activeCustomPriceLists.some(pl => !pl.courier_id)
        
        // Estrai courier_id unici dai listini attivi (escludi null)
        const activeCourierIds = new Set(
          activeCustomPriceLists
            .map(pl => pl.courier_id)
            .filter(id => id !== null)
        )

        // Filtra corrieri: mostra solo quelli con listino personalizzato attivo
        if (hasGlobalList) {
          // Se c'è un listino globale, mostra TUTTI i corrieri (il listino globale si applica a tutti)
          console.log(`✅ [QUOTES DB] Reseller: listino globale attivo, mostro tutti i ${availableCouriers.length} corrieri`)
        } else {
          // Se non ci sono listini globali, mostra solo corrieri con listino specifico
          availableCouriers = availableCouriers.filter(courier => {
            // Se il corriere ha un courierId e c'è un listino attivo per quel corriere
            return courier.courierId && activeCourierIds.has(courier.courierId)
          })

          console.log(`✅ [QUOTES DB] Reseller: filtrati ${availableCouriers.length} corrieri con listino personalizzato attivo specifico`)
        }

        // ✨ FIX: Deduplica per displayName - se un corriere ha più contract codes, mostra solo il primo
        // Questo risolve il problema dei duplicati (es. PosteDeliveryBusiness con 2 contract codes)
        // Usa displayName perché "PosteDeliveryBusiness" viene mappato a "Poste Italiane" nell'UI
        const COURIER_DISPLAY_NAMES: Record<string, string> = {
          'Gls': 'GLS',
          'GLS': 'GLS',
          'gls': 'GLS',
          'PosteDeliveryBusiness': 'Poste Italiane',
          'postedeliverybusiness': 'Poste Italiane',
          'Poste': 'Poste Italiane',
          'BRT': 'Bartolini',
          'Bartolini': 'Bartolini',
          'brt': 'Bartolini',
          'SDA': 'SDA',
          'sda': 'SDA',
          'DHL': 'DHL',
          'dhl': 'DHL',
          'TNT': 'TNT',
          'tnt': 'TNT',
          'UPS': 'UPS',
          'ups': 'UPS',
          'FedEx': 'FedEx',
          'fedex': 'FedEx',
        }
        const getDisplayName = (courierName: string): string => {
          // ✨ ENTERPRISE: Normalizza il nome prima di applicare il mapping
          // Questo risolve il problema di duplicati con case diversi (es. "PosteDeliveryBusiness" vs "Postedeliverybusiness")
          const normalized = courierName.toLowerCase()
          const normalizedKey = Object.keys(COURIER_DISPLAY_NAMES).find(
            key => key.toLowerCase() === normalized
          )
          if (normalizedKey) {
            return COURIER_DISPLAY_NAMES[normalizedKey]
          }
          return COURIER_DISPLAY_NAMES[courierName] || courierName
        }
        
        const displayNameMap = new Map<string, typeof availableCouriers[0]>()
        for (const courier of availableCouriers) {
          // Usa getDisplayName per ottenere il nome display (es. "PosteDeliveryBusiness" -> "Poste Italiane")
          const displayName = getDisplayName(courier.courierName)
          
          // ✨ ENTERPRISE: Se esiste già un corriere con stesso displayName, confronta i contractCode
          // Se hanno stesso displayName E stesso contractCode, sono duplicati → usa il primo
          // Se hanno stesso displayName ma contractCode diversi, sono opzioni diverse → mantieni entrambi
          const existingCourier = displayNameMap.get(displayName)
          if (existingCourier) {
            // Esiste già un corriere con stesso displayName
            const existingContractCode = existingCourier.contractCode || 'default'
            const currentContractCode = courier.contractCode || 'default'
            
            if (existingContractCode.toLowerCase() === currentContractCode.toLowerCase()) {
              // Stesso displayName E stesso contractCode → DUPLICATO, ignora
              console.log(`⚠️ [QUOTES DB] Duplicato ignorato: ${displayName} (${currentContractCode}) - già presente`)
              continue
            } else {
              // Stesso displayName ma contractCode diversi → sono opzioni diverse, mantieni entrambi
              // Ma per ora manteniamo solo il primo per evitare confusione
              // TODO: In futuro potremmo mostrare entrambi con contractCode visibile
              console.log(`ℹ️ [QUOTES DB] Stesso displayName ma contractCode diversi: ${displayName} - ${existingContractCode} vs ${currentContractCode}`)
              continue
            }
          }
          
          displayNameMap.set(displayName, courier)
        }
        availableCouriers = Array.from(displayNameMap.values())
        
        console.log(`✅ [QUOTES DB] Reseller: dopo deduplicazione per displayName, ${availableCouriers.length} corrieri unici`)
      } else {
        // Nessun listino personalizzato attivo: non mostrare nessun corriere
        console.log(`⚠️ [QUOTES DB] Reseller: nessun listino personalizzato attivo, nessun corriere disponibile`)
        return NextResponse.json({
          success: true,
          rates: [],
          message: "Nessun listino personalizzato attivo. Attiva un listino personalizzato per vedere i preventivi.",
        });
      }
    }

    // Calcola preventivi per ogni corriere
    const rates: any[] = [];
    const errors: string[] = [];

    for (const courier of availableCouriers) {
      try {
        // Per reseller: usa confronto automatico (API Reseller vs API Master)
        let quoteResult: any;

        if (isReseller) {
          const bestPriceResult = await calculateBestPriceForReseller(user.id, {
            weight: parseFloat(weight),
            destination: {
              zip,
              province,
              country: "IT",
            },
            courierId: courier.courierId || undefined, // courierId opzionale
            serviceType: services.includes("express") ? "express" : "standard",
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
              quoteResult._configId = quoteResult._courierConfigId
              console.log(`✅ [QUOTES DB] Usato courier_config_id dal listino personalizzato: ${quoteResult._courierConfigId}`)
            } else {
              // Fallback: usa identificatore generico
              quoteResult._configId =
                bestPriceResult.apiSource === "reseller"
                  ? "reseller_config"
                  : "master_config";
            }
          }
        } else {
          // Utente normale: calcola da listino assegnato
          quoteResult = await calculatePriceWithRules(user.id, {
            weight: parseFloat(weight),
            destination: {
              zip,
              province,
              country: "IT",
            },
            courierId: courier.courierId || undefined, // courierId opzionale
            serviceType: services.includes("express") ? "express" : "standard",
            options: {
              declaredValue: parseFloat(insuranceValue) || 0,
              cashOnDelivery: parseFloat(codValue) > 0,
              insurance: parseFloat(insuranceValue) > 0,
            },
          });
        }

        if (quoteResult && quoteResult.finalPrice) {
          // Formatta come rate per compatibilità con IntelligentQuoteComparator
          // weight_price = costo fornitore (totalCost = basePrice + surcharges, SENZA margine)
          // total_price = prezzo finale (finalPrice = totalCost + margin, CON margine)
          // ✨ ENTERPRISE: totalCost è il costo fornitore (senza margine), non basePrice
          const supplierPrice = quoteResult.totalCost ?? quoteResult.basePrice ?? 0;
          
          // Verifica che il margine sia stato calcolato correttamente
          if (supplierPrice === quoteResult.finalPrice && quoteResult.margin === 0) {
            console.warn(`⚠️ [QUOTES DB] Margine 0% per ${courier.courierName}: costo fornitore = prezzo finale (€${supplierPrice.toFixed(2)})`)
            console.warn(`   - Listino ID: ${quoteResult.priceListId}`)
            console.warn(`   - default_margin_percent: ${(quoteResult.appliedPriceList as any)?.default_margin_percent ?? 'N/A'}`)
            console.warn(`   - default_margin_fixed: ${(quoteResult.appliedPriceList as any)?.default_margin_fixed ?? 'N/A'}`)
          } else if (quoteResult.margin > 0) {
            console.log(`✅ [QUOTES DB] Margine calcolato per ${courier.courierName}: €${supplierPrice.toFixed(2)} + €${quoteResult.margin.toFixed(2)} = €${quoteResult.finalPrice.toFixed(2)}`)
          }
          
          // ✨ ENTERPRISE: Normalizza contractCode per evitare problemi di matching
          // Se contractCode è null/undefined o contiene solo "default", usa "default" standardizzato
          let normalizedContractCode = courier.contractCode || 'default'
          if (normalizedContractCode.toLowerCase().includes('default') && normalizedContractCode !== 'default') {
            // Se contiene "default" ma non è esattamente "default", normalizza
            normalizedContractCode = 'default'
          }
          
          rates.push({
            carrierCode: courier.courierName.toLowerCase(),
            contractCode: normalizedContractCode,
            total_price: quoteResult.finalPrice.toString(), // ✨ Prezzo finale CON margine
            weight_price: supplierPrice.toString(), // ✨ Costo fornitore SENZA margine (totalCost)
            base_price:
              quoteResult.basePrice?.toString() ||
              supplierPrice.toString(),
            surcharges: quoteResult.surcharges?.toString() || "0",
            margin: quoteResult.margin?.toString() || "0",
            _source: "db", // ✨ Flag: prezzo da DB
            _priceListId: quoteResult.priceListId,
            _apiSource: quoteResult._apiSource || "db",
            _configId: quoteResult._configId || quoteResult._courierConfigId, // ✨ Usa courier_config_id se presente
          });
        }
      } catch (error: any) {
        console.error(
          `❌ [QUOTES DB] Errore calcolo per ${courier.courierName}:`,
          error
        );
        errors.push(`${courier.courierName}: ${error.message}`);
      }
    }

    // ✨ SUPERADMIN: Se verifyCosts=true, aggiungi anche prezzi API reali per confronto
    let apiRates: any[] = [];
    if (isSuperadmin && verifyCosts) {
      try {
        const { testSpedisciOnlineRates } = await import(
          "@/actions/spedisci-online-rates"
        );
        const { getAllUserSpedisciOnlineConfigs } = await import(
          "@/lib/actions/spedisci-online"
        );

        const configsResult = await getAllUserSpedisciOnlineConfigs();
        if (
          configsResult.success &&
          configsResult.configs &&
          configsResult.configs.length > 0
        ) {
          // Chiama API per ogni configurazione
          const apiPromises = configsResult.configs.map(async (config) => {
            try {
              const result = await testSpedisciOnlineRates({
                packages: [
                  {
                    length: dimensions?.length
                      ? parseFloat(dimensions.length)
                      : 30,
                    width: dimensions?.width
                      ? parseFloat(dimensions.width)
                      : 20,
                    height: dimensions?.height
                      ? parseFloat(dimensions.height)
                      : 15,
                    weight: parseFloat(weight),
                  },
                ],
                shipTo: {
                  name: "Destinatario",
                  street1: "Via Test",
                  city: city || "Milano",
                  state: province || "MI",
                  postalCode: zip,
                  country: "IT",
                },
                configId: config.configId,
              });

              if (result.success && result.rates) {
                return result.rates.map((rate: any) => ({
                  ...rate,
                  _source: "api", // ✨ Flag: prezzo da API
                  _configId: config.configId,
                  _configName: config.configName,
                }));
              }
              return [];
            } catch (error: any) {
              console.error(
                `❌ [QUOTES DB] Errore API per config ${config.configId}:`,
                error
              );
              return [];
            }
          });

          const apiResults = await Promise.all(apiPromises);
          apiRates = apiResults.flat();
        }
      } catch (error: any) {
        console.error("❌ [QUOTES DB] Errore recupero prezzi API:", error);
        // Non bloccare, continua con solo prezzi DB
      }
    }

    // ✨ ENTERPRISE: Deduplicazione finale dei rates per evitare duplicati nel preventivatore
    // Questo risolve il problema di duplicati con case diversi (es. "PosteDeliveryBusiness" vs "Postedeliverybusiness")
    const COURIER_DISPLAY_NAMES_FINAL: Record<string, string> = {
      'gls': 'GLS',
      'gls5000': 'GLS',
      'gls5000ba': 'GLS',
      'glseuropa': 'GLS',
      'postedeliverybusiness': 'Poste Italiane',
      'poste': 'Poste Italiane',
      'poste italiane': 'Poste Italiane',
      'posteitaliane': 'Poste Italiane',
      'bartolini': 'Bartolini',
      'brt': 'Bartolini',
      'sda': 'SDA',
      'dhl': 'DHL',
      'tnt': 'TNT',
      'ups': 'UPS',
      'ups internazionale': 'UPS',
      'upsinternazionale': 'UPS',
      'fedex': 'FedEx',
      'interno': 'Interno',
    }
    const getDisplayNameForRate = (carrierCode: string): string => {
      // Normalizza: lowercase, rimuovi spazi, rimuovi caratteri speciali
      const normalized = carrierCode.toLowerCase().trim().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
      
      // Cerca match esatto
      if (COURIER_DISPLAY_NAMES_FINAL[normalized]) {
        return COURIER_DISPLAY_NAMES_FINAL[normalized]
      }
      
      // Cerca match parziale (es. "postedeliverybusiness" contiene "poste")
      for (const [key, displayName] of Object.entries(COURIER_DISPLAY_NAMES_FINAL)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          console.log(`🔄 [QUOTES DB] Match parziale: "${carrierCode}" → "${displayName}" (key: "${key}")`)
          return displayName
        }
      }
      
      // Fallback: usa il carrierCode originale
      console.warn(`⚠️ [QUOTES DB] Nessun mapping trovato per carrierCode: "${carrierCode}" (normalized: "${normalized}")`)
      return carrierCode
    }
    
    // ✨ ENTERPRISE: Deduplicazione per displayName SOLO (senza contract code)
    // Questo semplifica l'UI: mostra solo "Poste Italiane" invece di "Poste Italiane (Default)"
    // Se ci sono più listini attivi per lo stesso carrier code, sceglie automaticamente il più economico
    // Il reseller può gestire i listini attivandoli/disattivandoli se vuole vedere altre opzioni
    const deduplicatedRates = new Map<string, typeof rates[0]>()
    console.log(`🔍 [QUOTES DB] Deduplicazione: ${rates.length} rates da processare`)
    
    for (const rate of rates) {
      const displayName = getDisplayNameForRate(rate.carrierCode)
      // ✨ Chiave solo per displayName (senza contract code)
      const key = displayName
      
      console.log(`🔍 [QUOTES DB] Processing rate: carrierCode="${rate.carrierCode}" → displayName="${displayName}" (contract: ${rate.contractCode}, prezzo: €${rate.total_price})`)
      
      if (!deduplicatedRates.has(key)) {
        // Primo rate per questo carrier code: aggiungilo
        deduplicatedRates.set(key, rate)
        console.log(`✅ [QUOTES DB] Rate aggiunto: ${displayName} (contract: ${rate.contractCode}, prezzo: €${rate.total_price})`)
      } else {
        // Esiste già un rate per questo carrier code: confronta i prezzi e tieni il più economico
        const existingRate = deduplicatedRates.get(key)!
        const existingPrice = parseFloat(existingRate.total_price || '0')
        const currentPrice = parseFloat(rate.total_price || '0')
        
        console.log(`⚠️ [QUOTES DB] DUPLICATO TROVATO: ${displayName}`)
        console.log(`   - Esistente: carrierCode="${existingRate.carrierCode}", contract="${existingRate.contractCode}", prezzo=€${existingPrice.toFixed(2)}`)
        console.log(`   - Nuovo: carrierCode="${rate.carrierCode}", contract="${rate.contractCode}", prezzo=€${currentPrice.toFixed(2)}`)
        
        if (currentPrice < existingPrice) {
          // Il nuovo rate è più economico: sostituisci
          console.log(`🔄 [QUOTES DB] Rate sostituito (più economico): ${displayName} - €${existingPrice.toFixed(2)} → €${currentPrice.toFixed(2)}`)
          deduplicatedRates.set(key, rate)
        } else {
          // Il rate esistente è più economico o uguale: mantieni quello esistente
          console.log(`ℹ️ [QUOTES DB] Rate ignorato (meno economico o uguale): ${displayName} - mantiene €${existingPrice.toFixed(2)}`)
        }
      }
    }
    
    const finalRates = Array.from(deduplicatedRates.values())
    
    if (finalRates.length < rates.length) {
      console.log(`✅ [QUOTES DB] Deduplicazione rates: ${rates.length} → ${finalRates.length} (rimossi ${rates.length - finalRates.length} duplicati)`)
    }

    return NextResponse.json({
      success: true,
      rates: finalRates,
      apiRates: isSuperadmin && verifyCosts ? apiRates : undefined, // ✨ Solo per superadmin
      details: {
        source: "database",
        cached: false,
        totalRates: finalRates.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error("❌ [QUOTES DB] Errore:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Errore durante il calcolo preventivi da DB",
      },
      { status: 500 }
    );
  }
}
