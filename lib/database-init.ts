/**
 * Inizializzazione Database - Utenti Demo
 * 
 * Funzione per inizializzare gli utenti demo in Supabase se non esistono già.
 * Viene chiamata automaticamente quando necessario.
 */

import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { findUserByEmail, createUser } from './database';

const DEMO_USERS = [
  {
    email: 'admin@spediresicuro.it',
    password: 'admin123',
    name: 'Admin',
    role: 'admin' as const,
  },
  {
    email: 'demo@spediresicuro.it',
    password: 'demo123',
    name: 'Demo User',
    role: 'user' as const,
  },
];

/**
 * Inizializza gli utenti demo in Supabase se non esistono già
 * 
 * ⚠️ IMPORTANTE: Questa funzione viene chiamata automaticamente quando necessario
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
    await initializeDemoUsers();
  } catch (error: any) {
    // Non bloccare l'applicazione se l'inizializzazione fallisce
    console.warn('⚠️ [INIT] Errore inizializzazione utenti demo:', error.message);
  }
}

