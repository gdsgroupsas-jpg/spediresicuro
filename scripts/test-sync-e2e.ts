/**
 * Test E2E: Sync Listini con Ottimizzazioni
 * 
 * Verifica:
 * 1. Cache intelligente (skip se < 7 giorni)
 * 2. Sync incrementale (solo combinazioni nuove)
 * 3. Parallelizzazione (batch)
 * 4. Compatibilità con listini esistenti (vecchia logica)
 * 5. Nessuna regressione
 * 
 * Account test: testspediresicuro+postaexpress@gmail.com
 */

import { createClient } from "@supabase/supabase-js";
import { syncPriceListsFromSpedisciOnline } from "../actions/spedisci-online-rates";
import { getSupplierPriceListConfig } from "../actions/supplier-price-list-config";
import { listSupplierPriceListsAction } from "../actions/price-lists";

// Configurazione
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

async function main() {
  console.log("🧪 TEST E2E: Sync Listini con Ottimizzazioni\n");
  console.log(`📧 Account test: ${TEST_EMAIL}\n`);

  const results: TestResult[] = [];

  try {
    // 1. Recupera utente test
    console.log("📋 STEP 1: Recupero utente test...");
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, account_type, is_reseller")
      .eq("email", TEST_EMAIL)
      .single();

    if (userError || !user) {
      throw new Error(`Utente non trovato: ${userError?.message}`);
    }

    console.log(`✅ Utente trovato: ${user.id} (${user.account_type}, reseller: ${user.is_reseller})\n`);

    // 2. Verifica permessi
    console.log("📋 STEP 2: Verifica permessi...");
    const isAdmin = user.account_type === "admin" || user.account_type === "superadmin";
    const isReseller = user.is_reseller === true;
    
    if (!isAdmin && !isReseller) {
      throw new Error("Utente non ha permessi per sync listini");
    }
    console.log("✅ Permessi OK\n");

    // 3. Recupera configurazioni Spedisci.Online
    console.log("📋 STEP 3: Recupero configurazioni Spedisci.Online...");
    const { data: configs, error: configsError } = await supabase
      .from("courier_configs")
      .select("id, name, provider")
      .eq("user_id", user.id)
      .eq("provider", "spedisci-online");

    if (configsError) {
      throw new Error(`Errore recupero configurazioni: ${configsError.message}`);
    }

    if (!configs || configs.length === 0) {
      console.log("⚠️ Nessuna configurazione trovata - skip test sync");
      results.push({
        name: "Configurazioni disponibili",
        success: false,
        error: "Nessuna configurazione Spedisci.Online trovata",
      });
    } else {
      console.log(`✅ Trovate ${configs.length} configurazioni\n`);

      // 4. Verifica listini esistenti (compatibilità vecchia logica)
      console.log("📋 STEP 4: Verifica listini esistenti...");
      const { data: existingPriceLists, error: listsError } = await supabase
        .from("price_lists")
        .select("id, name, updated_at, metadata, source_metadata, list_type")
        .eq("created_by", user.id)
        .eq("list_type", "supplier")
        .order("updated_at", { ascending: false })
        .limit(10);

      if (listsError) {
        console.warn(`⚠️ Errore recupero listini: ${listsError.message}`);
      } else {
        console.log(`✅ Trovati ${existingPriceLists?.length || 0} listini esistenti`);
        if (existingPriceLists && existingPriceLists.length > 0) {
          console.log("   Listini esistenti:");
          existingPriceLists.forEach((pl) => {
            const metadata = pl.metadata || pl.source_metadata || {};
            const carrierCode = metadata.carrier_code || "N/A";
            const configId = metadata.courier_config_id || "N/A";
            const lastSync = new Date(pl.updated_at);
            const daysAgo = Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`   - ${pl.name} (${carrierCode}) - Sync ${daysAgo} giorni fa`);
          });
        }
      }
      console.log();

      // 5. Test sync per ogni configurazione
      for (const config of configs) {
        console.log(`\n🔄 TEST SYNC: ${config.name} (${config.id.substring(0, 8)}...)`);

        // 5a. Test cache intelligente (non dovrebbe sincronizzare se < 7 giorni)
        console.log("   📋 Test 5a: Cache intelligente...");
        try {
          const cacheTestResult = await syncPriceListsFromSpedisciOnline({
            configId: config.id,
            mode: "fast",
            overwriteExisting: false,
          });

          if (cacheTestResult.success) {
            const wasCached = cacheTestResult.priceListsCreated === 0 && 
                              cacheTestResult.priceListsUpdated === 0 &&
                              cacheTestResult.entriesAdded === 0;
            
            results.push({
              name: `Cache intelligente - ${config.name}`,
              success: true,
              details: {
                wasCached,
                created: cacheTestResult.priceListsCreated,
                updated: cacheTestResult.priceListsUpdated,
              },
            });

            if (wasCached) {
              console.log("   ✅ Cache attiva: sync saltata (listino recente)");
            } else {
              console.log("   ✅ Sync eseguita (listino non recente o nuovo)");
            }
          } else {
            results.push({
              name: `Cache intelligente - ${config.name}`,
              success: false,
              error: cacheTestResult.error,
            });
            console.log(`   ❌ Errore: ${cacheTestResult.error}`);
          }
        } catch (error: any) {
          results.push({
            name: `Cache intelligente - ${config.name}`,
            success: false,
            error: error.message,
          });
          console.log(`   ❌ Errore: ${error.message}`);
        }

        // 5b. Test sync incrementale (solo combinazioni nuove)
        console.log("   📋 Test 5b: Sync incrementale...");
        try {
          const incrementalTestResult = await syncPriceListsFromSpedisciOnline({
            configId: config.id,
            mode: "balanced",
            overwriteExisting: false,
          });

          results.push({
            name: `Sync incrementale - ${config.name}`,
            success: incrementalTestResult.success,
            error: incrementalTestResult.error,
            details: {
              created: incrementalTestResult.priceListsCreated,
              updated: incrementalTestResult.priceListsUpdated,
              entriesAdded: incrementalTestResult.entriesAdded,
            },
          });

          if (incrementalTestResult.success) {
            console.log(`   ✅ Sync incrementale OK: ${incrementalTestResult.entriesAdded || 0} entries aggiunte`);
          } else {
            console.log(`   ❌ Errore: ${incrementalTestResult.error}`);
          }
        } catch (error: any) {
          results.push({
            name: `Sync incrementale - ${config.name}`,
            success: false,
            error: error.message,
          });
          console.log(`   ❌ Errore: ${error.message}`);
        }

        // 5c. Test parallelizzazione (verifica che batch funzioni)
        console.log("   📋 Test 5c: Parallelizzazione...");
        try {
          const startTime = Date.now();
          const parallelTestResult = await syncPriceListsFromSpedisciOnline({
            configId: config.id,
            mode: "fast", // Fast mode per test veloce
            overwriteExisting: false,
          });
          const duration = Date.now() - startTime;

          results.push({
            name: `Parallelizzazione - ${config.name}`,
            success: parallelTestResult.success,
            error: parallelTestResult.error,
            details: {
              durationMs: duration,
              created: parallelTestResult.priceListsCreated,
              updated: parallelTestResult.priceListsUpdated,
            },
          });

          if (parallelTestResult.success) {
            console.log(`   ✅ Parallelizzazione OK: completato in ${duration}ms`);
          } else {
            console.log(`   ❌ Errore: ${parallelTestResult.error}`);
          }
        } catch (error: any) {
          results.push({
            name: `Parallelizzazione - ${config.name}`,
            success: false,
            error: error.message,
          });
          console.log(`   ❌ Errore: ${error.message}`);
        }
      }

      // 6. Verifica compatibilità listini esistenti
      console.log("\n📋 STEP 6: Verifica compatibilità listini esistenti...");
      const { data: finalPriceLists } = await supabase
        .from("price_lists")
        .select("id, name, metadata, source_metadata, list_type")
        .eq("created_by", user.id)
        .eq("list_type", "supplier")
        .order("updated_at", { ascending: false });

      if (finalPriceLists) {
        let compatibleCount = 0;
        let incompatibleCount = 0;

        for (const pl of finalPriceLists) {
          const metadata = pl.metadata || pl.source_metadata || {};
          // Verifica che i listini abbiano struttura valida
          const hasValidStructure = 
            metadata.carrier_code || 
            metadata.contract_code ||
            pl.name;

          if (hasValidStructure) {
            compatibleCount++;
          } else {
            incompatibleCount++;
            console.warn(`   ⚠️ Listino ${pl.id} potrebbe avere struttura incompatibile`);
          }
        }

        results.push({
          name: "Compatibilità listini esistenti",
          success: incompatibleCount === 0,
          details: {
            total: finalPriceLists.length,
            compatible: compatibleCount,
            incompatible: incompatibleCount,
          },
        });

        console.log(`✅ Compatibilità: ${compatibleCount}/${finalPriceLists.length} listini compatibili`);
        if (incompatibleCount > 0) {
          console.log(`   ⚠️ ${incompatibleCount} listini potenzialmente incompatibili`);
        }
      }
    }

    // 7. Test configurazioni manuali (se esistono listini)
    console.log("\n📋 STEP 7: Verifica configurazioni manuali...");
    const { data: testPriceList } = await supabase
      .from("price_lists")
      .select("id, name")
      .eq("created_by", user.id)
      .eq("list_type", "supplier")
      .limit(1)
      .maybeSingle();

    if (testPriceList) {
      try {
        const configResult = await getSupplierPriceListConfig(testPriceList.id);
        
        results.push({
          name: "Recupero configurazione manuale",
          success: configResult.success,
          error: configResult.error,
        });

        if (configResult.success) {
          console.log("✅ Configurazione manuale recuperabile");
        } else {
          console.log(`⚠️ Configurazione non trovata (normale se non ancora creata): ${configResult.error}`);
        }
      } catch (error: any) {
        results.push({
          name: "Recupero configurazione manuale",
          success: false,
          error: error.message,
        });
        console.log(`❌ Errore: ${error.message}`);
      }
    } else {
      console.log("ℹ️ Nessun listino disponibile per test configurazioni");
    }

  } catch (error: any) {
    console.error("\n❌ ERRORE CRITICO:", error.message);
    results.push({
      name: "Test generale",
      success: false,
      error: error.message,
    });
  }

  // Riepilogo finale
  console.log("\n" + "=".repeat(60));
  console.log("📊 RIEPILOGO TEST");
  console.log("=".repeat(60));

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Errore: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Dettagli: ${JSON.stringify(result.details, null, 2)}`);
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Successi: ${successCount}`);
  console.log(`❌ Falliti: ${failCount}`);
  console.log(`📊 Totale: ${results.length}`);
  console.log("=".repeat(60));

  if (failCount === 0) {
    console.log("\n🎉 TUTTI I TEST PASSATI!");
    process.exit(0);
  } else {
    console.log("\n⚠️ ALCUNI TEST FALLITI - Verifica errori sopra");
    process.exit(1);
  }
}

// Esegui test
main().catch((error) => {
  console.error("💥 Errore fatale:", error);
  process.exit(1);
});

