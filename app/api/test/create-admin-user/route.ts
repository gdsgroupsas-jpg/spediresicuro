/**
 * API Route per Test Creazione Utente Admin
 * 
 * ⚠️ ENDPOINT DI TEST - Usa questo per verificare se funziona
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/database';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { initializeDemoUsers } from '@/lib/database-init';

export async function GET(request: NextRequest) {
  try {
    const email = 'admin@spediresicuro.it';
    const password = 'admin123';
    
    // Verifica configurazione Supabase
    const supabaseConfigured = isSupabaseConfigured();
    
    // Verifica se l'utente esiste già
    const existingUser = await findUserByEmail(email);
    
    // Test connessione Supabase
    let supabaseTest = null;
    if (supabaseConfigured) {
      try {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('count')
          .limit(1);
        supabaseTest = { success: !error, error: error?.message };
      } catch (err: any) {
        supabaseTest = { success: false, error: err.message };
      }
    }
    
    return NextResponse.json({
      success: true,
      supabaseConfigured,
      supabaseTest,
      existingUser: existingUser ? {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
      } : null,
      message: existingUser 
        ? 'Utente admin già esistente' 
        : 'Utente admin non trovato - puoi crearlo con POST',
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Inizializza tutti gli utenti demo (admin e demo)
    const result = await initializeDemoUsers();
    
    // Verifica se l'utente admin esiste ora
    const adminUser = await findUserByEmail('admin@spediresicuro.it');
    
    return NextResponse.json({
      success: true,
      message: `Inizializzazione completata: ${result.created} utenti creati, ${result.skipped} già esistenti`,
      adminUser: adminUser ? {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      } : null,
      stats: result,
    });
  } catch (error: any) {
    console.error('Errore inizializzazione utenti demo:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

