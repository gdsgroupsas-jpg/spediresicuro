/**
 * Script per verificare configurazione listini GLS vs Poste Italiane
 * 
 * Verifica:
 * - list_type (supplier vs custom)
 * - master_list_id
 * - default_margin_percent/default_margin_fixed
 * - metadata (contract_code, carrier_code)
 * - Calcolo supplierPrice
 */

import { supabaseAdmin } from "../lib/db/client";

interface PriceListConfig {
  id: string;
  name: string;
  list_type: string | null;
  master_list_id: string | null;
  default_margin_percent: number | null;
  default_margin_fixed: number | null;
  status: string;
  metadata: any;
  source_metadata: any;
  courier_id: string | null;
  created_by: string | null;
}

async function verifyPriceListsConfig() {
  console.log("🔍 [VERIFY] Verifica configurazione listini GLS vs Poste Italiane\n");
  console.log("=".repeat(80));

  // Cerca listini per GLS
  console.log("\n📦 LISTINI GLS:");
  console.log("-".repeat(80));
  
  const { data: glsLists, error: glsError } = await supabaseAdmin
    .from("price_lists")
    .select(`
      id,
      name,
      list_type,
      master_list_id,
      default_margin_percent,
      default_margin_fixed,
      status,
      metadata,
      source_metadata,
      courier_id,
      created_by
    `)
    .or(`metadata->>'carrier_code' ilike '%gls%', metadata->>'contract_code' ilike '%gls%', source_metadata->>'carrier_code' ilike '%gls%', source_metadata->>'contract_code' ilike '%gls%', name ilike '%gls%'`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (glsError) {
    console.error("❌ Errore query GLS:", glsError);
  } else {
    console.log(`✅ Trovati ${glsLists?.length || 0} listini GLS attivi\n`);
    
    glsLists?.forEach((list: PriceListConfig, index: number) => {
      const metadata = list.metadata || list.source_metadata || {};
      const contractCode = metadata.contract_code || metadata.contractCode || "N/A";
      const carrierCode = metadata.carrier_code || metadata.carrierCode || "N/A";
      
      console.log(`${index + 1}. ${list.name}`);
      console.log(`   ID: ${list.id}`);
      console.log(`   Tipo: ${list.list_type || "N/A"}`);
      console.log(`   Master List ID: ${list.master_list_id || "NULL (è listino master)"}`);
      console.log(`   Margine %: ${list.default_margin_percent || "NULL"}`);
      console.log(`   Margine Fisso: ${list.default_margin_fixed || "NULL"}`);
      console.log(`   Contract Code: ${contractCode}`);
      console.log(`   Carrier Code: ${carrierCode}`);
      console.log(`   Courier ID: ${list.courier_id || "NULL"}`);
      console.log(`   Creato da: ${list.created_by || "NULL"}`);
      
      // Analisi logica
      if (list.list_type === "custom" && list.master_list_id) {
        console.log(`   ✅ LOGICA: Listino CUSTOM con master → supplierPrice viene calcolato`);
      } else if (list.list_type === "supplier" && !list.master_list_id) {
        console.log(`   ⚠️  LOGICA: Listino SUPPLIER senza master → supplierPrice = undefined`);
        if (!list.default_margin_percent && !list.default_margin_fixed) {
          console.log(`   ❌ PROBLEMA: Nessun margine configurato → finalPrice = totalCost`);
        }
      } else if (list.list_type === "custom" && !list.master_list_id) {
        console.log(`   ⚠️  LOGICA: Listino CUSTOM senza master → supplierPrice = undefined`);
      }
      console.log("");
    });
  }

  // Cerca listini per Poste Italiane
  console.log("\n📦 LISTINI POSTE ITALIANE:");
  console.log("-".repeat(80));
  
  const { data: posteLists, error: posteError } = await supabaseAdmin
    .from("price_lists")
    .select(`
      id,
      name,
      list_type,
      master_list_id,
      default_margin_percent,
      default_margin_fixed,
      status,
      metadata,
      source_metadata,
      courier_id,
      created_by
    `)
    .or(`metadata->>'carrier_code' ilike '%poste%', metadata->>'contract_code' ilike '%poste%', metadata->>'carrier_code' ilike '%postedelivery%', metadata->>'contract_code' ilike '%postedelivery%', source_metadata->>'carrier_code' ilike '%poste%', source_metadata->>'contract_code' ilike '%poste%', source_metadata->>'carrier_code' ilike '%postedelivery%', source_metadata->>'contract_code' ilike '%postedelivery%', name ilike '%poste%', name ilike '%pdb%'`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (posteError) {
    console.error("❌ Errore query Poste:", posteError);
  } else {
    console.log(`✅ Trovati ${posteLists?.length || 0} listini Poste Italiane attivi\n`);
    
    posteLists?.forEach((list: PriceListConfig, index: number) => {
      const metadata = list.metadata || list.source_metadata || {};
      const contractCode = metadata.contract_code || metadata.contractCode || "N/A";
      const carrierCode = metadata.carrier_code || metadata.carrierCode || "N/A";
      
      console.log(`${index + 1}. ${list.name}`);
      console.log(`   ID: ${list.id}`);
      console.log(`   Tipo: ${list.list_type || "N/A"}`);
      console.log(`   Master List ID: ${list.master_list_id || "NULL (è listino master)"}`);
      console.log(`   Margine %: ${list.default_margin_percent || "NULL"}`);
      console.log(`   Margine Fisso: ${list.default_margin_fixed || "NULL"}`);
      console.log(`   Contract Code: ${contractCode}`);
      console.log(`   Carrier Code: ${carrierCode}`);
      console.log(`   Courier ID: ${list.courier_id || "NULL"}`);
      console.log(`   Creato da: ${list.created_by || "NULL"}`);
      
      // Analisi logica
      if (list.list_type === "custom" && list.master_list_id) {
        console.log(`   ✅ LOGICA: Listino CUSTOM con master → supplierPrice viene calcolato`);
      } else if (list.list_type === "supplier" && !list.master_list_id) {
        console.log(`   ⚠️  LOGICA: Listino SUPPLIER senza master → supplierPrice = undefined`);
        if (!list.default_margin_percent && !list.default_margin_fixed) {
          console.log(`   ❌ PROBLEMA: Nessun margine configurato → finalPrice = totalCost`);
          console.log(`   💡 SOLUZIONE: Creare listino CUSTOM che clona questo con margine`);
        }
      } else if (list.list_type === "custom" && !list.master_list_id) {
        console.log(`   ⚠️  LOGICA: Listino CUSTOM senza master → supplierPrice = undefined`);
      }
      console.log("");
    });
  }

  // Confronto finale
  console.log("\n📊 CONFRONTO FINALE:");
  console.log("=".repeat(80));
  
  const glsCustomWithMaster = glsLists?.filter(
    (l: PriceListConfig) => l.list_type === "custom" && l.master_list_id
  ).length || 0;
  
  const glsSupplierWithoutMargin = glsLists?.filter(
    (l: PriceListConfig) => 
      l.list_type === "supplier" && 
      !l.master_list_id && 
      !l.default_margin_percent && 
      !l.default_margin_fixed
  ).length || 0;
  
  const posteCustomWithMaster = posteLists?.filter(
    (l: PriceListConfig) => l.list_type === "custom" && l.master_list_id
  ).length || 0;
  
  const posteSupplierWithoutMargin = posteLists?.filter(
    (l: PriceListConfig) => 
      l.list_type === "supplier" && 
      !l.master_list_id && 
      !l.default_margin_percent && 
      !l.default_margin_fixed
  ).length || 0;

  console.log(`\nGLS:`);
  console.log(`  - Listini CUSTOM con master: ${glsCustomWithMaster}`);
  console.log(`  - Listini SUPPLIER senza margine: ${glsSupplierWithoutMargin}`);
  
  console.log(`\nPoste Italiane:`);
  console.log(`  - Listini CUSTOM con master: ${posteCustomWithMaster}`);
  console.log(`  - Listini SUPPLIER senza margine: ${posteSupplierWithoutMargin}`);

  if (glsCustomWithMaster > 0 && posteSupplierWithoutMargin > 0) {
    console.log(`\n✅ SPIEGAZIONE:`);
    console.log(`   GLS ha listini CUSTOM con master_list_id → supplierPrice calcolato correttamente`);
    console.log(`   Poste ha listini SUPPLIER senza margine → supplierPrice = undefined, finalPrice = totalCost`);
    console.log(`   → Nel route, fallback usa totalCost come supplierPrice → costo = prezzo vendita`);
  }

  console.log("\n" + "=".repeat(80));
}

// Esegui verifica
verifyPriceListsConfig()
  .then(() => {
    console.log("\n✅ Verifica completata");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Errore durante verifica:", error);
    process.exit(1);
  });
