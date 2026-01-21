/**
 * Script per verificare e configurare l'account test come reseller
 * Eseguire con: npx tsx scripts/setup-test-reseller.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

async function main() {
  console.log('🔍 Verificando account:', TEST_EMAIL);

  // 1. Trova l'utente
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, is_reseller, reseller_role, account_type, dati_cliente')
    .eq('email', TEST_EMAIL)
    .single();

  if (userError) {
    console.error('❌ Errore ricerca utente:', userError.message);
    return;
  }

  console.log('📋 Stato attuale:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   is_reseller:', user.is_reseller);
  console.log('   reseller_role:', user.reseller_role);
  console.log('   account_type:', user.account_type);
  console.log('   dati_cliente:', JSON.stringify(user.dati_cliente, null, 2));

  // Controllo onboarding
  const hasDatiCliente = !!user.dati_cliente;
  const datiCompletati = user.dati_cliente?.datiCompletati === true;
  const onboardingCompleted = hasDatiCliente && datiCompletati;
  console.log('   onboardingCompleted:', onboardingCompleted);

  // 2. Se non è reseller, configura
  if (!user.is_reseller || user.reseller_role !== 'admin') {
    console.log('\n🔧 Configurando come reseller admin...');

    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_reseller: true,
        reseller_role: 'admin',
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Errore aggiornamento reseller:', updateError.message);
      return;
    }

    console.log('✅ Account configurato come reseller admin!');
  } else {
    console.log('\n✅ Account già configurato correttamente come reseller admin');
  }

  // 3. Se onboarding non completato, completalo
  if (!onboardingCompleted) {
    console.log('\n🔧 Completando onboarding...');

    const dati_cliente = {
      nomeAzienda: 'Test Reseller',
      ragioneSociale: 'Test Reseller SRL',
      partitaIva: '12345678901',
      codiceFiscale: 'TSTRSLLR12345678901',
      indirizzo: 'Via Test 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      telefono: '0212345678',
      email: TEST_EMAIL,
      datiCompletati: true,
      createdAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('users')
      .update({ dati_cliente })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Errore aggiornamento onboarding:', updateError.message);
      return;
    }

    console.log('✅ Onboarding completato!');

    // Verifica
    const { data: updated } = await supabase
      .from('users')
      .select('dati_cliente')
      .eq('id', user.id)
      .single();

    console.log('📋 Nuovo dati_cliente:', JSON.stringify(updated?.dati_cliente, null, 2));
  } else {
    console.log('\n✅ Onboarding già completato');
  }
}

main().catch(console.error);
