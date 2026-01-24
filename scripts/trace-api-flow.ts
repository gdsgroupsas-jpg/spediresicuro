/**
 * Script per tracciare il flusso esatto dell'API
 *
 * Simula esattamente cosa succede quando l'API /api/quotes/db
 * calcola un preventivo per verificare il supplierPrice.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Import the actual functions used by the API
import {
  calculateBestPriceForReseller,
  calculatePriceWithRules,
} from '../lib/db/price-lists-advanced';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function traceApiFlow() {
  console.log('🔍 TRACCIAMENTO FLUSSO API');
  console.log('═'.repeat(60));

  // Trova un utente reseller di test
  const { data: users } = await supabase
    .from('users')
    .select('id, email, is_reseller, account_type')
    .or('is_reseller.eq.true,account_type.eq.superadmin')
    .limit(1);

  if (!users || users.length === 0) {
    console.log('❌ Nessun utente reseller/superadmin trovato');
    return;
  }

  const user = users[0];
  console.log(`\n👤 UTENTE: ${user.email}`);
  console.log(`   - is_reseller: ${user.is_reseller}`);
  console.log(`   - account_type: ${user.account_type}`);

  // Parametri test
  const testParams = {
    weight: 1.5,
    destination: {
      zip: '20100',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    serviceType: 'standard' as const,
    options: {},
    contractCode: 'gls-gls-5000', // Contract code del listino GLS
  };

  console.log(`\n📦 PARAMETRI TEST:`);
  console.log(`   - Peso: ${testParams.weight}kg`);
  console.log(`   - CAP: ${testParams.destination.zip}`);
  console.log(`   - Provincia: ${testParams.destination.province}`);
  console.log(`   - Service Type: ${testParams.serviceType}`);
  console.log(`   - Contract Code: ${testParams.contractCode}`);

  console.log('\n' + '─'.repeat(60));
  console.log('🔄 CHIAMATA calculateBestPriceForReseller...\n');

  // Chiama calculateBestPriceForReseller come fa l'API
  const result = await calculateBestPriceForReseller(user.id, testParams);

  console.log('\n' + '─'.repeat(60));
  console.log('📊 RISULTATO:');

  if (!result) {
    console.log('❌ Nessun risultato da calculateBestPriceForReseller');
    return;
  }

  console.log(`\n   apiSource: ${result.apiSource}`);
  console.log(`   bestPrice:`);
  console.log(`     - basePrice: €${result.bestPrice.basePrice?.toFixed(2) || 'N/A'}`);
  console.log(`     - surcharges: €${result.bestPrice.surcharges?.toFixed(2) || 'N/A'}`);
  console.log(`     - margin: €${result.bestPrice.margin?.toFixed(2) || 'N/A'}`);
  console.log(`     - totalCost: €${result.bestPrice.totalCost?.toFixed(2) || 'N/A'}`);
  console.log(`     - finalPrice: €${result.bestPrice.finalPrice?.toFixed(2) || 'N/A'}`);
  console.log(
    `     - supplierPrice: €${result.bestPrice.supplierPrice?.toFixed(2) || 'undefined ⚠️'}`
  );
  console.log(
    `     - supplierPriceOriginal: €${(result.bestPrice as any).supplierPriceOriginal?.toFixed(2) || 'undefined'}`
  );
  console.log(`     - priceListId: ${result.bestPrice.priceListId}`);
  console.log(
    `     - appliedPriceList.name: ${(result.bestPrice.appliedPriceList as any)?.name || 'N/A'}`
  );
  console.log(
    `     - appliedPriceList.list_type: ${(result.bestPrice.appliedPriceList as any)?.list_type || 'N/A'}`
  );
  console.log(
    `     - appliedPriceList.master_list_id: ${(result.bestPrice.appliedPriceList as any)?.master_list_id || 'N/A'}`
  );

  // Verifica margine
  console.log('\n' + '═'.repeat(60));
  console.log('💰 VERIFICA MARGINE:');

  const supplierPrice =
    result.bestPrice.supplierPrice ?? result.bestPrice.totalCost ?? result.bestPrice.basePrice ?? 0;
  const finalPrice = result.bestPrice.finalPrice ?? 0;

  if (supplierPrice > 0 && finalPrice > 0) {
    const marginAbsolute = finalPrice - supplierPrice;
    const marginPercent = (marginAbsolute / finalPrice) * 100;

    console.log(`   Costo fornitore: €${supplierPrice.toFixed(2)}`);
    console.log(`   Prezzo vendita: €${finalPrice.toFixed(2)}`);
    console.log(`   Margine assoluto: €${marginAbsolute.toFixed(2)}`);
    console.log(`   Margine %: ${marginPercent.toFixed(2)}%`);

    if (result.bestPrice.supplierPrice === undefined) {
      console.log('\n   ⚠️ PROBLEMA: supplierPrice è undefined!');
      console.log('      Il fallback a totalCost potrebbe non essere il costo fornitore reale.');
      console.log(
        '      Verifica i log sopra per capire perché il master list non ha restituito un prezzo.'
      );
    } else {
      console.log('\n   ✅ supplierPrice è definito, il margine dovrebbe essere corretto.');
    }
  } else {
    console.log('   ❌ Impossibile calcolare margine (valori mancanti)');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🔍 FINE TRACCIAMENTO');
  console.log('═'.repeat(60));
}

traceApiFlow().catch(console.error);
