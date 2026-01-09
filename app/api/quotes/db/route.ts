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
    const availableCouriers = await getAvailableCouriersForUser(user.id);

    if (!availableCouriers || availableCouriers.length === 0) {
      return NextResponse.json({
        success: true,
        rates: [],
        message: "Nessun corriere configurato per questo utente",
      });
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
            quoteResult._configId =
              bestPriceResult.apiSource === "reseller"
                ? "reseller_config"
                : "master_config";
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
          // weight_price = costo fornitore (base senza margine)
          // total_price = prezzo finale (con margine)
          const supplierPrice =
            quoteResult.totalCost ||
            quoteResult.basePrice ||
            quoteResult.finalPrice;
          rates.push({
            carrierCode: courier.courierName.toLowerCase(),
            contractCode:
              courier.contractCode ||
              `${courier.courierName.toLowerCase()}-default`,
            total_price: quoteResult.finalPrice.toString(),
            weight_price: supplierPrice.toString(), // ✨ Costo fornitore (senza margine)
            base_price:
              quoteResult.basePrice?.toString() ||
              quoteResult.finalPrice.toString(),
            surcharges: quoteResult.surcharges?.toString() || "0",
            margin: quoteResult.margin?.toString() || "0",
            _source: "db", // ✨ Flag: prezzo da DB
            _priceListId: quoteResult.priceListId,
            _apiSource: quoteResult._apiSource || "db",
            _configId: quoteResult._configId,
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

    return NextResponse.json({
      success: true,
      rates,
      apiRates: isSuperadmin && verifyCosts ? apiRates : undefined, // ✨ Solo per superadmin
      details: {
        source: "database",
        cached: false,
        totalRates: rates.length,
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
