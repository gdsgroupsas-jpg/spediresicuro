#!/usr/bin/env node

/**
 * Script di debug per analizzare le 40 spedizioni "non filtrate"
 * Questo script queries il database e mostra:
 * - Quali sono le spedizioni
 * - Chi le ha create (utente)
 * - Perché sono considerate "production"
 * - Quali pattern di test potrebbero mancare
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeShipments() {
  console.log('📊 Analizzando le spedizioni non filtrate...\n');

  // Pattern di test
  const TEST_EMAIL_PATTERNS = [
    /^test@/i,
    /test-.*@spediresicuro\.it$/i,
    /@test\./i,
    /test.*@.*test/i,
    /^e2e-/i,
    /^smoke-test-/i,
    /^integration-test-/i,
  ];

  const TEST_NAME_PATTERNS = [
    /^test\s+/i,
    /test\s+user/i,
    /e2e\s+test/i,
    /smoke\s+test/i,
    /integration\s+test/i,
    /^test\s*$/i,
  ];

  function isTestEmail(email) {
    if (!email) return false;
    return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email));
  }

  function isTestName(name) {
    if (!name) return false;
    return TEST_NAME_PATTERNS.some(pattern => pattern.test(name));
  }

  function isTestUser(user) {
    return isTestEmail(user.email) || isTestName(user.name);
  }

  function isTestShipment(shipment, userMap) {
    if (shipment.tracking_number && /test/i.test(shipment.tracking_number)) {
      return true;
    }
    if (shipment.status === 'cancelled') {
      return true;
    }
    if (userMap) {
      const userId = shipment.user_id || shipment.created_by;
      if (userId) {
        const user = userMap.get(userId);
        // Se l'utente è orfano (non trovato nella mappa), è considerato test
        if (!user) {
          return true;
        }
        // Se l'utente esiste e è di test, è considerato test
        if (isTestUser(user)) {
          return true;
        }
      } else {
        // Se non ha user_id, è orfano e quindi test
        return true;
      }
    }
    return false;
  }

  try {
    // 1. Carica tutti gli utenti
    console.log('📥 Caricando utenti...');
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, account_type');

    if (usersError) throw usersError;

    // Crea mappa utenti
    const userMap = new Map();
    allUsers.forEach(user => {
      userMap.set(user.id, user);
    });

    console.log(`✅ Caricati ${allUsers.length} utenti\n`);

    // 2. Carica tutte le spedizioni
    console.log('📥 Caricando spedizioni...');
    const { data: allShipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .or('deleted.is.null,deleted.eq.false')
      .is('deleted_at', null)
      .not('status', 'in', '(cancelled,deleted)')
      .order('created_at', { ascending: false });

    if (shipmentsError) throw shipmentsError;

    console.log(`✅ Caricate ${allShipments.length} spedizioni\n`);

    // 3. Analizza spedizioni
    console.log('🔍 Analizzando spedizioni...\n');

    const productionShipments = [];
    const testShipments = [];

    allShipments.forEach(shipment => {
      if (isTestShipment(shipment, userMap)) {
        testShipments.push(shipment);
      } else {
        productionShipments.push(shipment);
      }
    });

    console.log(`📊 RISULTATI:`);
    console.log(`   Spedizioni di PRODUZIONE: ${productionShipments.length}`);
    console.log(`   Spedizioni di TEST: ${testShipments.length}`);
    console.log(`   TOTALE: ${allShipments.length}\n`);

    // 4. Mostra prime 40 spedizioni di produzione (quelle che vedi nel dashboard)
    if (productionShipments.length > 0) {
      console.log(`🎯 Prime ${Math.min(40, productionShipments.length)} spedizioni considerate "production":\n`);

      const first40 = productionShipments.slice(0, 40);

      first40.forEach((shipment, index) => {
        const user = userMap.get(shipment.user_id);
        const testReason = isTestShipment(shipment, userMap) ? '⚠️ TEST' : '✅ PROD';

        console.log(`${index + 1}. ID: ${shipment.id}`);
        console.log(`   Tracking: ${shipment.tracking_number || 'N/A'}`);
        console.log(`   Status: ${shipment.status}`);
        console.log(`   User: ${user?.email || 'UNKNOWN'} (${user?.name || 'no name'})`);
        console.log(`   User Role: ${user?.role || 'unknown'}`);
        console.log(`   Created: ${shipment.created_at}`);
        console.log(`   Price: €${shipment.final_price || 0}`);
        console.log(`   ${testReason}`);
        console.log('');
      });
    }

    // 5. Statistiche sugli utenti che creano spedizioni di produzione
    if (productionShipments.length > 0) {
      console.log('\n👥 Utenti che creano spedizioni "production":\n');

      const userStats = new Map();
      productionShipments.forEach(shipment => {
        const user = userMap.get(shipment.user_id);
        if (user) {
          const key = user.id;
          if (!userStats.has(key)) {
            userStats.set(key, {
              email: user.email,
              name: user.name,
              role: user.role,
              count: 0,
              isTest: isTestUser(user)
            });
          }
          userStats.get(key).count++;
        }
      });

      const sortedUsers = Array.from(userStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      sortedUsers.forEach(user => {
        console.log(`${user.count.toString().padStart(3)} spedizioni - ${user.email} (${user.role}) ${user.isTest ? '⚠️ TEST USER' : '✅ PROD USER'}`);
      });
    }

    // 6. Analizza pattern mancanti
    if (testShipments.length > 0) {
      console.log('\n🔬 Analizzando pattern di test...\n');

      const reasonsForTest = new Map();

      testShipments.forEach(shipment => {
        let reason = 'user_is_test';

        if (shipment.tracking_number && /test/i.test(shipment.tracking_number)) {
          reason = 'test_tracking_number';
        } else if (shipment.status === 'cancelled') {
          reason = 'status_cancelled';
        }

        reasonsForTest.set(reason, (reasonsForTest.get(reason) || 0) + 1);
      });

      console.log('Ragioni perché le spedizioni sono considerate TEST:');
      reasonsForTest.forEach((count, reason) => {
        console.log(`  ${reason}: ${count}`);
      });
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

analyzeShipments();
