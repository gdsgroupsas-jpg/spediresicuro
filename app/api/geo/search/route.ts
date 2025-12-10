/**
 * API Route: Ricerca Geo-Locations
 * 
 * Endpoint: GET /api/geo/search?q=query
 * 
 * Cerca comuni italiani per nome, provincia o CAP usando full-text search.
 * Restituisce max 20 risultati per performance.
 * 
 * Cache: 1 ora (dati geografici cambiano raramente)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { GeoLocationOption, GeoSearchResponse } from '@/types/geo';

/**
 * Formatta un risultato per la UI
 */
function formatLocationOption(location: {
  name: string;
  province: string;
  region: string | null;
  caps: string[];
}): GeoLocationOption {
  // Testo display semplificato: solo "Roma (RM)" senza CAP o regione
  // Il CAP verrà mostrato solo dopo la selezione
  const displayText = `${location.name} (${location.province})`;

  return {
    city: location.name,
    province: location.province,
    region: location.region,
    caps: location.caps,
    displayText,
  };
}

/**
 * Handler GET
 */
// Forza route dinamica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Estrai query parameter
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();

    // Validazione
    if (!query || query.length < 2) {
      return NextResponse.json<GeoSearchResponse>(
        {
          results: [],
          count: 0,
          query: query || '',
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=3600', // Cache 1 ora
          },
        }
      );
    }

    // Prepara query per full-text search
    // Converte query in formato tsquery: "Roma" -> "Roma:*" (prefix matching)
    const searchTerms = query
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `${term}:*`)
      .join(' & ');

    // Esegui ricerca su Supabase usando textSearch
    console.log('🔍 Ricerca geo_locations:', { query, searchTerms });
    
    let { data, error, count } = await supabase
      .from('geo_locations')
      .select('name, province, region, caps', { count: 'exact' })
      .textSearch('search_vector', searchTerms, {
        type: 'websearch', // Supporta operatori web search (AND, OR, etc.)
        config: 'italian',
      })
      .limit(20); // Max 20 risultati per performance
    
    // Se textSearch fallisce, prova con query ILIKE più semplice (fallback)
    if (error && (error.code === 'PGRST116' || error.message?.includes('textSearch') || error.message?.includes('search_vector'))) {
      console.log('⚠️ textSearch fallito, provo con query ILIKE...');
      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
        .from('geo_locations')
        .select('name, province, region, caps', { count: 'exact' })
        .or(`name.ilike.%${query}%,province.ilike.%${query}%`)
        .limit(20);
      
      if (!fallbackError) {
        data = fallbackData;
        error = null;
        count = fallbackCount;
        console.log('✅ Query ILIKE funziona! (textSearch non disponibile)');
      } else {
        console.log('❌ Anche query ILIKE fallita:', fallbackError);
      }
    }
    
    console.log('📊 Risultato query:', { 
      dataCount: data?.length || 0, 
      count, 
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message 
    });

    if (error) {
      console.error('❌ Errore ricerca Supabase:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Messaggi errore più specifici
      let errorMessage = 'Errore durante la ricerca';
      let errorDetails: any = {
        code: error.code,
        message: error.message,
      };
      
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        errorMessage = 'Database non configurato correttamente. La tabella geo_locations potrebbe non esistere.';
        errorDetails.hint = 'Verifica che la tabella geo_locations esista e che RLS sia configurato correttamente.';
      } else if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
        errorMessage = 'Errore di permessi. La policy RLS su geo_locations potrebbe non essere configurata correttamente.';
        errorDetails.hint = 'Crea una policy SELECT pubblica su geo_locations: CREATE POLICY "geo_locations_select_public" ON geo_locations FOR SELECT USING (true);';
      } else if (error.message?.includes('timeout') || error.message?.includes('network')) {
        errorMessage = 'Errore di connessione al database. Riprova tra qualche istante.';
      } else if (error.message?.includes('textSearch') || error.message?.includes('search_vector')) {
        errorMessage = 'Errore nella ricerca full-text. La colonna search_vector potrebbe non essere configurata correttamente.';
        errorDetails.hint = 'Verifica che la colonna search_vector esista e sia di tipo tsvector.';
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          results: [],
        },
        { status: 500 }
      );
    }

    // Formatta risultati per la UI
    const results: GeoLocationOption[] = (data || []).map(formatLocationOption);

    // Risposta con cache
    return NextResponse.json<GeoSearchResponse>(
      {
        results,
        count: count || results.length,
        query,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache 1 ora
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Errore API geo/search:', error);
    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

