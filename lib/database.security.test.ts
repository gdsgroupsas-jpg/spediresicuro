/**
 * Test di Sicurezza: Database Functions
 * 
 * Verifica che:
 * 1. User A non vede shipments user B
 * 2. Select shipments where user_id is null non ritorna nulla per user normale
 * 
 * ⚠️ IMPORTANTE: Questi test verificano i fix di sicurezza HIGH
 */

import { getSpedizioni, addSpedizione } from './database';
import { createAuthContextFromSession, createServiceRoleContext } from './auth-context';
import { supabaseAdmin } from './supabase';

/**
 * Test 1: User A non vede shipments user B
 */
export async function testUserIsolation(): Promise<boolean> {
  console.log('🧪 [TEST] Test isolamento utenti...');
  
  try {
    // Crea due contesti utente diversi (mock)
    const userAContext = {
      type: 'user' as const,
      userId: 'user-a-uuid',
      userEmail: 'user-a@test.com',
    };
    
    const userBContext = {
      type: 'user' as const,
      userId: 'user-b-uuid',
      userEmail: 'user-b@test.com',
    };
    
    // Crea una spedizione per user B usando service_role
    const serviceContext = createServiceRoleContext('admin-id', 'Test isolamento');
    const testShipment = {
      tracking: `TEST_${Date.now()}`,
      destinatario: { nome: 'Test User B' },
      mittente: { nome: 'Test Sender' },
      peso: 1,
      status: 'pending',
    };
    
    // Salva spedizione per user B
    const shipmentB = await addSpedizione(testShipment, {
      ...serviceContext,
      userId: userBContext.userId,
    });
    
    // User A cerca le proprie spedizioni
    const shipmentsA = await getSpedizioni(userAContext);
    
    // Verifica: User A NON deve vedere la spedizione di User B
    const foundShipmentB = shipmentsA.find((s: any) => s.id === shipmentB.id);
    
    if (foundShipmentB) {
      console.error('❌ [TEST] FAIL: User A vede spedizione di User B!');
      return false;
    }
    
    console.log('✅ [TEST] PASS: User A non vede shipments user B');
    return true;
  } catch (error: any) {
    console.error('❌ [TEST] Errore test isolamento:', error.message);
    return false;
  }
}

/**
 * Test 2: Select shipments where user_id is null non ritorna nulla per user normale
 */
export async function testNoNullUserIdForUsers(): Promise<boolean> {
  console.log('🧪 [TEST] Test user_id null per utenti normali...');
  
  try {
    // Crea una spedizione con user_id=null usando service_role
    const serviceContext = createServiceRoleContext('admin-id', 'Test user_id null');
    const testShipment = {
      tracking: `TEST_NULL_${Date.now()}`,
      destinatario: { nome: 'Test Null User' },
      mittente: { nome: 'Test Sender' },
      peso: 1,
      status: 'pending',
    };
    
    // Salva spedizione con user_id=null (solo service_role può farlo)
    await addSpedizione(testShipment, {
      ...serviceContext,
      userId: null, // Esplicitamente null
    });
    
    // User normale cerca le proprie spedizioni
    const userContext = {
      type: 'user' as const,
      userId: 'user-normal-uuid',
      userEmail: 'user-normal@test.com',
    };
    
    const shipments = await getSpedizioni(userContext);
    
    // Verifica: User normale NON deve vedere spedizioni con user_id=null
    const nullUserIdShipments = shipments.filter((s: any) => {
      // Verifica direttamente nel database se possibile
      return s.user_id === null || s.user_id === undefined;
    });
    
    if (nullUserIdShipments.length > 0) {
      console.error('❌ [TEST] FAIL: User normale vede spedizioni con user_id=null!');
      console.error('❌ [TEST] Spedizioni trovate:', nullUserIdShipments.length);
      return false;
    }
    
    // Verifica anche direttamente nel database con query
    const { data: directQuery, error } = await supabaseAdmin
      .from('shipments')
      .select('id, user_id')
      .eq('user_id', userContext.userId);
    
    if (error) {
      console.error('❌ [TEST] Errore query diretta:', error.message);
      return false;
    }
    
    // Verifica che non ci siano spedizioni con user_id=null nei risultati
    const nullInResults = directQuery?.some((s: any) => s.user_id === null);
    if (nullInResults) {
      console.error('❌ [TEST] FAIL: Query diretta restituisce user_id=null per user normale!');
      return false;
    }
    
    console.log('✅ [TEST] PASS: User normale non vede spedizioni con user_id=null');
    return true;
  } catch (error: any) {
    console.error('❌ [TEST] Errore test user_id null:', error.message);
    return false;
  }
}

/**
 * Test 3: Anonymous non può chiamare getSpedizioni
 */
export async function testAnonymousBlocked(): Promise<boolean> {
  console.log('🧪 [TEST] Test blocco anonymous...');
  
  try {
    const anonymousContext = {
      type: 'anonymous' as const,
    };
    
    // Dovrebbe lanciare errore
    try {
      await getSpedizioni(anonymousContext);
      console.error('❌ [TEST] FAIL: Anonymous può chiamare getSpedizioni!');
      return false;
    } catch (error: any) {
      if (error.message?.includes('Non autenticato') || error.message?.includes('accesso negato')) {
        console.log('✅ [TEST] PASS: Anonymous bloccato correttamente');
        return true;
      }
      throw error; // Rilancia se è un errore diverso
    }
  } catch (error: any) {
    console.error('❌ [TEST] Errore test anonymous:', error.message);
    return false;
  }
}

/**
 * Test 4: User normale non può creare spedizione con user_id=null
 */
export async function testUserCannotCreateNullUserId(): Promise<boolean> {
  console.log('🧪 [TEST] Test user non può creare user_id=null...');
  
  try {
    const userContext = {
      type: 'user' as const,
      userId: 'user-test-uuid',
      userEmail: 'user-test@test.com',
    };
    
    const testShipment = {
      tracking: `TEST_USER_NULL_${Date.now()}`,
      destinatario: { nome: 'Test' },
      mittente: { nome: 'Test Sender' },
      peso: 1,
      status: 'pending',
    };
    
    // Dovrebbe lanciare errore se user_id manca
    try {
      // Prova a creare senza userId (simula fallimento lookup)
      const contextWithoutUserId = {
        ...userContext,
        userId: undefined, // Simula userId mancante
      };
      
      await addSpedizione(testShipment, contextWithoutUserId);
      console.error('❌ [TEST] FAIL: User può creare spedizione senza userId!');
      return false;
    } catch (error: any) {
      if (error.message?.includes('userId mancante') || 
          error.message?.includes('Impossibile salvare') ||
          error.message?.includes('user_id')) {
        console.log('✅ [TEST] PASS: User bloccato da creare senza userId');
        return true;
      }
      throw error; // Rilancia se è un errore diverso
    }
  } catch (error: any) {
    console.error('❌ [TEST] Errore test user null userId:', error.message);
    return false;
  }
}

/**
 * Esegue tutti i test di sicurezza
 */
export async function runSecurityTests(): Promise<{
  allPassed: boolean;
  results: Record<string, boolean>;
}> {
  console.log('🔐 [SECURITY TESTS] Esecuzione test di sicurezza...\n');
  
  const results: Record<string, boolean> = {};
  
  results.isolation = await testUserIsolation();
  results.noNullUserId = await testNoNullUserIdForUsers();
  results.anonymousBlocked = await testAnonymousBlocked();
  results.userCannotCreateNull = await testUserCannotCreateNullUserId();
  
  const allPassed = Object.values(results).every((passed) => passed);
  
  console.log('\n📊 [SECURITY TESTS] Risultati:');
  console.log('  - Isolamento utenti:', results.isolation ? '✅' : '❌');
  console.log('  - No user_id null per utenti:', results.noNullUserId ? '✅' : '❌');
  console.log('  - Anonymous bloccato:', results.anonymousBlocked ? '✅' : '❌');
  console.log('  - User non può creare null:', results.userCannotCreateNull ? '✅' : '❌');
  console.log('\n' + (allPassed ? '✅ TUTTI I TEST PASSATI' : '❌ ALCUNI TEST FALLITI'));
  
  return { allPassed, results };
}
