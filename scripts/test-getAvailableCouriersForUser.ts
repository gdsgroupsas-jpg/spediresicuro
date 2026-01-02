/**
 * Test script per getAvailableCouriersForUser()
 * 
 * Uso: npx tsx scripts/test-getAvailableCouriersForUser.ts [userId]
 */

import { getAvailableCouriersForUser } from '../lib/db/price-lists';

async function testFunction() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Fornisci un userId come argomento');
    console.log('Uso: npx tsx scripts/test-getAvailableCouriersForUser.ts <userId>');
    process.exit(1);
  }

  console.log(`🧪 Test getAvailableCouriersForUser(${userId})`);
  console.log('─'.repeat(50));

  try {
    const result = await getAvailableCouriersForUser(userId);
    
    console.log(`✅ Funzione eseguita con successo`);
    console.log(`📊 Corrieri trovati: ${result.length}`);
    
    if (result.length === 0) {
      console.log('⚠️  Nessun corriere trovato per questo utente');
      console.log('   Verifica che:');
      console.log('   - L\'utente abbia configurazioni API attive (courier_configs)');
      console.log('   - Le configurazioni abbiano owner_user_id = userId');
      console.log('   - Le configurazioni abbiano contract_mapping con corrieri');
    } else {
      console.log('\n📋 Dettagli corrieri:');
      result.forEach((courier, index) => {
        console.log(`\n${index + 1}. ${courier.courierName}`);
        console.log(`   - ID: ${courier.courierId}`);
        console.log(`   - Provider: ${courier.providerId}`);
      });
    }
    
    console.log('\n✅ Test completato');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Errore durante il test:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testFunction();

