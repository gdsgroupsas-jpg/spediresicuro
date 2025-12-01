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
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('count')
          .limit(1);
        
        result.checks.supabaseConnection = {
          success: !error,
          error: error?.message || null,
          code: error?.code || null,
          hint: error?.hint || null,
          tableExists: !error || error.code !== '42P01', // 42P01 = table does not exist
        };

        // Se la tabella non esiste, prova a vedere quali tabelle ci sono
        if (error?.code === '42P01') {
          result.checks.tableExists = false;
          result.checks.message = 'La tabella users non esiste in Supabase. Esegui la migration 001_complete_schema.sql';
        } else if (!error) {
          result.checks.tableExists = true;
          result.checks.message = 'Supabase configurato correttamente e tabella users esiste';
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

