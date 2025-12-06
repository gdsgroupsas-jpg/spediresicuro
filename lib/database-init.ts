/**
 * Inizializzazione Database - Utenti Demo
 * 
 * Funzione per inizializzare gli utenti demo in Supabase se non esistono già.
 * Viene chiamata automaticamente quando necessario.
 * 
 * ⚠️ SICUREZZA: Le password degli utenti demo devono essere configurate tramite
 * variabili d'ambiente. NON hardcodare password in questo file.
 */

import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { findUserByEmail, createUser } from './database';
import crypto from 'crypto';

/**
 * Genera una password sicura casuale se non configurata via env
 * Usa 24 bytes per maggiore sicurezza (48 caratteri hex)
 */
function generateSecurePassword(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Ottiene le credenziali demo dalle variabili d'ambiente
 * Se non configurate, genera password casuali sicure
 */
function getDemoUsers() {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || generateSecurePassword();
  const demoPassword = process.env.DEMO_USER_PASSWORD || generateSecurePassword();
  
  // Log solo se le password sono state generate (non configurate)
  if (!process.env.DEMO_ADMIN_PASSWORD) {
    console.warn('⚠️ [INIT] DEMO_ADMIN_PASSWORD non configurata. Generata password casuale.');
  }
  if (!process.env.DEMO_USER_PASSWORD) {
    console.warn('⚠️ [INIT] DEMO_USER_PASSWORD non configurata. Generata password casuale.');
  }
  
  return [
    {
      email: 'admin@spediresicuro.it',
      password: adminPassword,
      name: 'Admin',
      role: 'admin' as const,
    },
    {
      email: 'demo@spediresicuro.it',
      password: demoPassword,
      name: 'Demo User',
      role: 'user' as const,
    },
  ];
}

/**
 * Inizializza gli utenti demo in Supabase se non esistono già
 * 
 * ⚠️ IMPORTANTE: Questa funzione viene chiamata automaticamente quando necessario
 * Le password devono essere configurate tramite variabili d'ambiente:
 * - DEMO_ADMIN_PASSWORD per l'utente admin
 * - DEMO_USER_PASSWORD per l'utente demo
 */
export async function initializeDemoUsers(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // Se Supabase non è configurato, non possiamo inizializzare
  if (!isSupabaseConfigured()) {
    console.log('ℹ️ [INIT] Supabase non configurato, utenti demo disponibili solo in JSON locale');
    return { created: 0, skipped: 0 };
  }

  console.log('🔄 [INIT] Inizializzazione utenti demo in Supabase...');
  
  // Ottieni utenti demo con password da env
  const DEMO_USERS = getDemoUsers();

  for (const userData of DEMO_USERS) {
    try {
      // Verifica se l'utente esiste già
      const existingUser = await findUserByEmail(userData.email);
      
      if (existingUser) {
        console.log(`ℹ️ [INIT] Utente ${userData.email} già esistente, salto`);
        skipped++;
        continue;
      }

      // Crea l'utente
      try {
        await createUser(userData);
        console.log(`✅ [INIT] Utente ${userData.email} creato con successo`);
        created++;
      } catch (error: any) {
        if (error.message === 'Email già registrata') {
          console.log(`ℹ️ [INIT] Utente ${userData.email} già esistente (conflitto)`);
          skipped++;
        } else {
          console.error(`❌ [INIT] Errore creazione utente ${userData.email}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`❌ [INIT] Errore verifica utente ${userData.email}:`, error.message);
    }
  }

  console.log(`✅ [INIT] Inizializzazione completata: ${created} creati, ${skipped} saltati`);
  return { created, skipped };
}

/**
 * Inizializza gli utenti demo se necessario (chiamata sicura)
 * 
 * Questa funzione può essere chiamata in modo sicuro più volte.
 * Non crea duplicati.
 */
export async function ensureDemoUsersExist(): Promise<void> {
  try {
    console.log('🔄 [INIT] Verifica inizializzazione utenti demo...');
    const result = await initializeDemoUsers();
    console.log('✅ [INIT] Risultato inizializzazione:', result);
    
    // Se Supabase è configurato ma non sono stati creati utenti, potrebbe esserci un problema
    if (isSupabaseConfigured() && result.created === 0 && result.skipped === 0) {
      console.warn('⚠️ [INIT] Supabase configurato ma nessun utente demo inizializzato. Verifica la configurazione.');
    }
  } catch (error: any) {
    // Non bloccare l'applicazione se l'inizializzazione fallisce
    console.error('❌ [INIT] Errore inizializzazione utenti demo:', error.message);
    console.error('❌ [INIT] Stack trace:', error.stack);
    
    // Se Supabase è configurato ma c'è un errore, potrebbe essere un problema di connessione
    if (isSupabaseConfigured()) {
      console.warn('⚠️ [INIT] Supabase è configurato ma l\'inizializzazione è fallita. Verifica:');
      console.warn('   - Le variabili d\'ambiente SUPABASE sono corrette?');
      console.warn('   - La tabella "users" esiste in Supabase?');
      console.warn('   - La Service Role Key ha i permessi corretti?');
    }
  }
}

