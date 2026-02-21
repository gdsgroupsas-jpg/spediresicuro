/**
 * Script di diagnostica per la configurazione dei listini prezzi
 *
 * Verifica:
 * 1. Listini personalizzati (custom) senza master_list_id
 * 2. Listini fornitore (supplier) attivi
 * 3. Configurazione margini
 * 4. Coerenza tra listini
 *
 * Eseguire con: npx ts-node scripts/diagnose-price-lists.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ Mancano variabili ambiente NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PriceListDiagnostic {
  id: string;
  name: string;
  list_type: string;
  status: string;
  master_list_id: string | null;
  default_margin_percent: number | null;
  default_margin_fixed: number | null;
  created_by: string | null;
  entries_count: number;
  issues: string[];
}

async function diagnose() {
  console.log('🔍 ========================================');
  console.log('🔍 DIAGNOSTICA CONFIGURAZIONE LISTINI');
  console.log('🔍 ========================================\n');

  // 1. Recupera tutti i listini attivi
  const { data: priceLists, error } = await supabase
    .from('price_lists')
    .select(
      `
      id,
      name,
      list_type,
      status,
      master_list_id,
      default_margin_percent,
      default_margin_fixed,
      created_by,
      metadata,
      entries:price_list_entries(count)
    `
    )
    .eq('status', 'active')
    .order('list_type', { ascending: true });

  if (error) {
    console.error('❌ Errore recupero listini:', error.message);
    process.exit(1);
  }

  if (!priceLists || priceLists.length === 0) {
    console.log('⚠️ Nessun listino attivo trovato');
    return;
  }

  console.log(`📋 Trovati ${priceLists.length} listini attivi\n`);

  // 2. Categorizza e analizza
  const suppliers: PriceListDiagnostic[] = [];
  const customs: PriceListDiagnostic[] = [];
  const globals: PriceListDiagnostic[] = [];
  const others: PriceListDiagnostic[] = [];

  for (const pl of priceLists) {
    const diagnostic: PriceListDiagnostic = {
      id: pl.id,
      name: pl.name,
      list_type: pl.list_type || 'unknown',
      status: pl.status,
      master_list_id: pl.master_list_id,
      default_margin_percent: pl.default_margin_percent,
      default_margin_fixed: pl.default_margin_fixed,
      created_by: pl.created_by,
      entries_count: (pl.entries as any)?.[0]?.count || 0,
      issues: [],
    };

    // Analizza problemi
    if (pl.list_type === 'custom') {
      if (!pl.master_list_id) {
        diagnostic.issues.push(
          '⚠️ CRITICO: Listino custom senza master_list_id - impossibile tracciare costo fornitore!'
        );
      }
      if (!pl.default_margin_percent && !pl.default_margin_fixed) {
        diagnostic.issues.push('⚠️ Nessun margine configurato');
      }
      customs.push(diagnostic);
    } else if (pl.list_type === 'supplier') {
      if (diagnostic.entries_count === 0) {
        diagnostic.issues.push('⚠️ Listino fornitore senza entries (matrice vuota)');
      }
      suppliers.push(diagnostic);
    } else if (pl.list_type === 'global') {
      globals.push(diagnostic);
    } else {
      diagnostic.issues.push(`⚠️ list_type sconosciuto: ${pl.list_type}`);
      others.push(diagnostic);
    }
  }

  // 3. Report
  console.log('📦 LISTINI FORNITORE (supplier) - Rappresentano i costi reali');
  console.log('─'.repeat(60));
  if (suppliers.length === 0) {
    console.log('   ⚠️ NESSUN listino fornitore trovato!');
    console.log('   → I listini custom non possono determinare il costo fornitore reale.\n');
  } else {
    for (const s of suppliers) {
      console.log(`   ✅ ${s.name}`);
      console.log(`      ID: ${s.id}`);
      console.log(`      Entries: ${s.entries_count}`);
      if (s.issues.length > 0) {
        s.issues.forEach((issue) => console.log(`      ${issue}`));
      }
      console.log();
    }
  }

  console.log('\n🎨 LISTINI PERSONALIZZATI (custom) - Con margine applicato');
  console.log('─'.repeat(60));
  if (customs.length === 0) {
    console.log('   Nessun listino personalizzato trovato.\n');
  } else {
    let criticalIssues = 0;
    for (const c of customs) {
      const hasIssues = c.issues.length > 0;
      const icon = hasIssues ? '⚠️' : '✅';
      console.log(`   ${icon} ${c.name}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      master_list_id: ${c.master_list_id || '❌ MANCANTE'}`);
      console.log(
        `      Margine: ${c.default_margin_percent ? `${c.default_margin_percent}%` : c.default_margin_fixed ? `€${c.default_margin_fixed}` : 'Non configurato'}`
      );
      console.log(`      Entries: ${c.entries_count}`);
      if (c.issues.length > 0) {
        c.issues.forEach((issue) => {
          console.log(`      ${issue}`);
          if (issue.includes('CRITICO')) criticalIssues++;
        });
      }
      console.log();
    }

    if (criticalIssues > 0) {
      console.log('\n🚨 PROBLEMI CRITICI RILEVATI');
      console.log('─'.repeat(60));
      console.log(`   ${criticalIssues} listini custom senza master_list_id`);
      console.log('   → Il sistema non può determinare il costo fornitore reale');
      console.log('   → I margini mostrati saranno APPROSSIMATIVI o ERRATI');
      console.log('\n   SOLUZIONE:');
      console.log('   1. Identifica il listino fornitore corrispondente');
      console.log('   2. Aggiorna il listino custom con master_list_id');
      console.log('\n   QUERY SQL:');
      console.log('   UPDATE price_lists');
      console.log("   SET master_list_id = '<ID_LISTINO_FORNITORE>'");
      console.log("   WHERE id = '<ID_LISTINO_CUSTOM>';");
    }
  }

  if (globals.length > 0) {
    console.log('\n🌐 LISTINI GLOBALI (global)');
    console.log('─'.repeat(60));
    for (const g of globals) {
      console.log(`   ${g.name} (ID: ${g.id})`);
    }
  }

  if (others.length > 0) {
    console.log('\n❓ LISTINI CON TIPO SCONOSCIUTO');
    console.log('─'.repeat(60));
    for (const o of others) {
      console.log(`   ${o.name} (ID: ${o.id}, tipo: ${o.list_type})`);
      o.issues.forEach((issue) => console.log(`      ${issue}`));
    }
  }

  // 4. Verifica coerenza master_list_id
  console.log('\n🔗 VERIFICA COLLEGAMENTI MASTER');
  console.log('─'.repeat(60));
  const customsWithMaster = customs.filter((c) => c.master_list_id);
  const supplierIds = new Set(suppliers.map((s) => s.id));

  for (const c of customsWithMaster) {
    if (!supplierIds.has(c.master_list_id!)) {
      // Verifica se il master esiste
      const { data: master } = await supabase
        .from('price_lists')
        .select('id, name, list_type, status')
        .eq('id', c.master_list_id!)
        .single();

      if (!master) {
        console.log(`   ⚠️ ${c.name}: master_list_id punta a listino INESISTENTE`);
      } else if (master.status !== 'active') {
        console.log(
          `   ⚠️ ${c.name}: master_list_id punta a listino NON ATTIVO (${master.status})`
        );
      } else if (master.list_type !== 'supplier') {
        console.log(
          `   ⚠️ ${c.name}: master_list_id punta a listino di tipo "${master.list_type}" invece di "supplier"`
        );
      } else {
        console.log(`   ✅ ${c.name} → ${master.name}`);
      }
    } else {
      const masterName = suppliers.find((s) => s.id === c.master_list_id)?.name;
      console.log(`   ✅ ${c.name} → ${masterName}`);
    }
  }

  const customsWithoutMaster = customs.filter((c) => !c.master_list_id);
  if (customsWithoutMaster.length > 0) {
    console.log('\n   LISTINI CUSTOM SENZA COLLEGAMENTO:');
    for (const c of customsWithoutMaster) {
      console.log(`   ❌ ${c.name} (ID: ${c.id})`);
    }
  }

  console.log('\n🔍 ========================================');
  console.log('🔍 FINE DIAGNOSTICA');
  console.log('🔍 ========================================\n');
}

diagnose().catch(console.error);
