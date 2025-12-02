/**
 * API Route per Verificare Configurazione Database
 * 
 * Endpoint di test per verificare se Supabase è configurato e se la tabella users esiste
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseConfigured = isSupabaseConfigured();
    
    const result: any = {
      supabaseConfigured,
      environment: process.env.NODE_ENV,
      checks: {},
    };

    // Verifica variabili ambiente
    result.checks.envVars = {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
        `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : 
        'NON CONFIGURATO',
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Se Supabase è configurato, prova a connettersi
    if (supabaseConfigured) {
      try {
        // Prova a leggere dalla tabella users
        const { data, error, count } = await supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true });
        
        result.checks.supabaseConnection = {
          success: !error,
          error: error?.message || null,
          code: error?.code || null,
          hint: error?.hint || null,
          details: error?.details || null,
          tableExists: !error || error.code !== '42P01', // 42P01 = table does not exist
          userCount: count || 0,
        };

        // Se la tabella non esiste, prova a vedere quali tabelle ci sono
        if (error?.code === '42P01') {
          result.checks.tableExists = false;
          result.checks.message = '❌ La tabella users non esiste in Supabase. Vai su Supabase Dashboard → SQL Editor → Esegui il file supabase/migrations/001_complete_schema.sql';
          result.checks.action = 'Esegui la migration SQL per creare la tabella users';
        } else if (error?.code === 'PGRST116') {
          result.checks.tableExists = false;
          result.checks.message = '❌ Nessun risultato dalla tabella users (tabella vuota o non accessibile)';
        } else if (error) {
          result.checks.tableExists = false;
          result.checks.message = `❌ Errore connessione Supabase: ${error.message}`;
          result.checks.action = 'Verifica: 1) URL Supabase corretto, 2) Service Role Key corretta, 3) Progetto Supabase attivo';
        } else {
          result.checks.tableExists = true;
          result.checks.message = `✅ Supabase configurato correttamente! Tabella users esiste con ${count || 0} utenti`;
        }
      } catch (connError: any) {
        result.checks.supabaseConnection = {
          success: false,
          error: connError.message,
          code: connError.code,
        };
      }
    } else {
      result.checks.message = 'Supabase non configurato. Aggiungi le variabili ambiente su Vercel.';
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
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

