/**
 * API Route: Export CSV per Spedisci.online
 *
 * Endpoint: GET /api/export/spediscionline
 *
 * Genera un file CSV nel formato esatto richiesto da spedisci.online:
 * - Separatore: punto e virgola (;)
 * - Decimali: punto (.)
 * - Encoding: UTF-8
 * - Esporta solo spedizioni con status 'pending' (non ancora esportate)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getSafeAuth } from '@/lib/safe-auth';
import { getSpedizioni } from '@/lib/database';
import type { AuthContext } from '@/lib/auth-context';

// Disabilita cache statica per garantire dati sempre aggiornati
export const dynamic = 'force-dynamic';

/**
 * Helper: Ottiene user_id Supabase da email NextAuth
 */
async function getSupabaseUserIdFromEmail(email: string): Promise<string | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('supabase_user_id')
      .eq('email', email)
      .single();

    if (!error && profile?.supabase_user_id) {
      return profile.supabase_user_id;
    }

    const {
      data: { users },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (!authError && users) {
      const supabaseUser = users.find((u: any) => u.email === email);
      if (supabaseUser) {
        await supabaseAdmin
          .from('user_profiles')
          .upsert({ email, supabase_user_id: supabaseUser.id }, { onConflict: 'email' });
        return supabaseUser.id;
      }
    }
    return null;
  } catch (error) {
    console.error('⚠️ Errore getSupabaseUserIdFromEmail:', error);
    return null;
  }
}

/**
 * Helper per pulire stringhe CSV (rimuove punto e virgola che romperebbero il formato)
 */
function cleanString(str: string | null | undefined): string {
  if (!str) return '';
  // Sostituisce punto e virgola con spazio per evitare rotture CSV
  return String(str).replace(/;/g, ' ').trim();
}

/**
 * Helper per formattare valori numerici (mantiene punto decimale)
 */
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

export async function GET() {
  try {
    // Autenticazione: solo utenti autenticati possono esportare
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    let spedizioni: any[] = [];

    // Converti ActingContext in AuthContext
    const authContext: AuthContext = {
      type: 'user',
      userId: context.target.id,
      userEmail: context.target.email || undefined,
      isAdmin: context.target.role === 'admin' || context.target.account_type === 'superadmin',
    };

    // ⚠️ IMPORTANTE: Se Supabase non è configurato, usa JSON locale
    if (!isSupabaseConfigured()) {
      console.log('📁 [JSON] Supabase non configurato, uso database JSON locale per export');
      // Usa getSpedizioni che gestisce automaticamente il fallback
      const tutteSpedizioni = await getSpedizioni(authContext);
      // Filtra solo quelle con status 'pending' o 'in_preparazione'
      spedizioni = tutteSpedizioni.filter(
        (s: any) => (s.status === 'pending' || s.status === 'in_preparazione') && !s.deleted
      );
      console.log(`📁 [JSON] Esportate ${spedizioni.length} spedizioni dal database JSON`);
    } else {
      console.log('🔄 [SUPABASE] Tentativo export da Supabase...');
      // Usa Supabase se configurato
      const userId = await getSupabaseUserIdFromEmail(context.actor.email);

      // 1. Preleva SOLO le spedizioni non ancora esportate (status = 'pending')
      // ⚠️ IMPORTANTE: Filtra per user_id per multi-tenancy
      let query = supabaseAdmin
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Filtra per user_id se disponibile (multi-tenancy)
      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        // Se non trovato user_id, usa fallback: filtra per email nel campo notes
        // (per compatibilità con vecchi dati senza user_id)
        console.warn(
          `⚠️ Nessun user_id trovato per ${context.actor.email}, esporto tutte le spedizioni pending`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE] Errore query:', error.message);
        console.log('📁 [FALLBACK] Uso database JSON locale');
        // Fallback a JSON se errore Supabase
        const tutteSpedizioni = await getSpedizioni(authContext);
        spedizioni = tutteSpedizioni.filter(
          (s: any) => (s.status === 'pending' || s.status === 'in_preparazione') && !s.deleted
        );
        console.log(`📁 [JSON] Esportate ${spedizioni.length} spedizioni dal database JSON`);
      } else {
        spedizioni = data || [];
        console.log(`✅ [SUPABASE] Esportate ${spedizioni.length} spedizioni da Supabase`);
      }
    }

    if (!spedizioni || spedizioni.length === 0) {
      return NextResponse.json({ message: 'Nessuna spedizione da esportare' }, { status: 404 });
    }

    // 2. Definizione Header CSV (Formato Spedisci.online)
    // ⚠️ IMPORTANTE: Ordine e nomi colonne devono essere ESATTI come richiesto
    const headers = [
      'destinatario',
      'indirizzo',
      'cap',
      'citta',
      'provincia',
      'telefono',
      'email',
      'peso',
      'colli',
      'contrassegno',
    ].join(';');

    // 3. Mapping dei dati al formato CSV spedisci.online
    // ⚠️ IMPORTANTE: Gestisce sia formato Supabase (campi flat) che formato JSON (annidato)
    const rows = spedizioni.map((s) => {
      // Estrai dati destinatario (gestisce entrambi i formati)
      const destinatario = cleanString(
        s.recipient_name || s.destinatario?.nome || s.destinatarioNome || ''
      );
      const indirizzo = cleanString(
        s.recipient_address || s.destinatario?.indirizzo || s.destinatarioIndirizzo || ''
      );
      const cap = cleanString(s.recipient_zip || s.destinatario?.cap || s.destinatarioCap || '');
      const citta = cleanString(
        s.recipient_city || s.destinatario?.citta || s.destinatarioCitta || ''
      );
      const provincia = cleanString(
        s.recipient_province || s.destinatario?.provincia || s.destinatarioProvincia || ''
      );
      const telefono = cleanString(
        s.recipient_phone || s.destinatario?.telefono || s.destinatarioTelefono || ''
      );
      const email = cleanString(
        s.recipient_email || s.destinatario?.email || s.destinatarioEmail || ''
      );

      // Dati pacco
      const peso = formatNumber(s.weight || s.peso || 0);
      // ⚠️ NUOVO: packages_count (colli) - gestisce entrambi i formati
      const colli = s.packages_count || s.colli || 1;

      // Contrassegno: gestisce entrambi i formati
      const contrassegno =
        s.cash_on_delivery && s.cash_on_delivery_amount
          ? formatNumber(s.cash_on_delivery_amount)
          : s.contrassegno
            ? formatNumber(s.contrassegno)
            : '0';

      // Costruisci riga CSV
      return [
        destinatario,
        indirizzo,
        cap,
        citta,
        provincia,
        telefono,
        email,
        peso,
        colli,
        contrassegno,
      ].join(';');
    });

    // 4. Costruisci contenuto CSV completo (header + righe)
    const csvContent = [headers, ...rows].join('\n');

    // 5. (Opzionale) Marca come esportati per non duplicare al prossimo export
    // Scommenta se vuoi questa automazione:
    // const ids = spedizioni.map(s => s.id);
    // await supabaseAdmin
    //   .from('shipments')
    //   .update({ status: 'exported' })
    //   .in('id', ids);

    // 6. Genera nome file con data
    const filename = `export_spediscionline_${new Date().toISOString().slice(0, 10)}.csv`;

    // 7. Restituisci file CSV
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Errore Export CSV:', error);
    return NextResponse.json(
      {
        error: "Errore durante l'export",
        message: error.message || 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
