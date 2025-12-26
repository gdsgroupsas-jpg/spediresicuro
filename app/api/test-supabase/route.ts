/**
 * Endpoint di test per diagnostica Supabase
 * 
 * Verifica:
 * 1. Presenza variabili ambiente
 * 2. Configurazione Supabase
 * 3. Connessione al database
 * 4. Permessi INSERT su shipments
 * 
 * ⚠️ TEMPORANEO: Rimuovere dopo diagnosi
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Verifica variabili ambiente (⚠️ SEC-1: NO log di chiavi, solo presenza)
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: {
        present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        // ⚠️ SEC-1: NO value parziale - rischio exposure
        isPlaceholder: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('xxxxxxxxxxxxx') || false,
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        // ⚠️ SEC-1: NO value parziale - rischio exposure
        isPlaceholder: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('placeholder') || false,
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        // ⚠️ SEC-1: NO value parziale - rischio exposure
        isPlaceholder: process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('placeholder') || false,
      },
    };

    // 2. Verifica configurazione
    const isConfigured = isSupabaseConfigured();

    // 3. Test connessione (solo se configurato)
    let connectionTest = null;
    let insertTest = null;
    let userIdTest = null;

    if (isConfigured) {
      try {
        // Test 1: Connessione base (SELECT)
        const { data: selectData, error: selectError } = await supabaseAdmin
          .from('shipments')
          .select('id')
          .limit(1);
        
        connectionTest = {
          success: !selectError,
          error: selectError?.message || null,
          code: selectError?.code || null,
          dataCount: selectData?.length || 0,
        };

        // Test 2: Verifica permessi INSERT (test con rollback)
        if (!selectError) {
          try {
            const testPayload = {
              tracking_number: `TEST_${Date.now()}`,
              status: 'draft',
              weight: 1,
              recipient_name: 'TEST DELETE ME',
              recipient_city: 'TEST',
              recipient_zip: '00000',
              recipient_province: 'TEST',
              recipient_address: 'TEST',
              recipient_phone: '0000000000',
              sender_name: 'TEST',
              deleted: true, // Marca come eliminato per sicurezza
            };

            const { data: insertData, error: insertError } = await supabaseAdmin
              .from('shipments')
              .insert([testPayload])
              .select('id')
              .single();

            if (!insertError && insertData?.id) {
              // Elimina il test record
              await supabaseAdmin
                .from('shipments')
                .delete()
                .eq('id', insertData.id);

              insertTest = {
                success: true,
                message: 'INSERT test passed (record created and deleted)',
              };
            } else {
              insertTest = {
                success: false,
                error: insertError?.message || 'Unknown error',
                code: insertError?.code || null,
                hint: insertError?.hint || null,
              };
            }
          } catch (insertErr: any) {
            insertTest = {
              success: false,
              error: insertErr.message,
              type: 'exception',
            };
          }
        }

        // Test 3: Verifica accesso user_profiles (usato da getSupabaseUserIdFromEmail)
        try {
          const { data: profileData, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, email')
            .limit(1);

          userIdTest = {
            success: !profileError,
            error: profileError?.message || null,
            code: profileError?.code || null,
            canAccess: !profileError,
          };
        } catch (profileErr: any) {
          userIdTest = {
            success: false,
            error: profileErr.message,
            type: 'exception',
          };
        }
      } catch (connErr: any) {
        connectionTest = {
          success: false,
          error: connErr.message,
          type: 'exception',
        };
      }
    }

    // Risposta completa
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      envCheck,
      isConfigured,
      connectionTest,
      insertTest,
      userIdTest,
      diagnosis: {
        issue: !isConfigured 
          ? 'SUPABASE_SERVICE_ROLE_KEY missing or invalid'
          : !connectionTest?.success
          ? 'Cannot connect to Supabase'
          : !insertTest?.success
          ? 'INSERT permission denied or schema mismatch'
          : !userIdTest?.success
          ? 'Cannot access user_profiles table'
          : 'All checks passed',
        severity: !isConfigured 
          ? 'CRITICAL'
          : !connectionTest?.success
          ? 'CRITICAL'
          : !insertTest?.success
          ? 'HIGH'
          : !userIdTest?.success
          ? 'MEDIUM'
          : 'NONE',
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

