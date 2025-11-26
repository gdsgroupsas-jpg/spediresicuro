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
  // Formatta i CAP: "00100, 00118" o solo "00100"
  const capsText = location.caps.length > 0 
    ? location.caps.slice(0, 3).join(', ') + (location.caps.length > 3 ? '...' : '')
    : 'N/A';

  // Testo display: "Roma (RM) - 00100, 00118"
  const displayText = `${location.name} (${location.province})${capsText !== 'N/A' ? ` - ${capsText}` : ''}`;

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
    const { data, error, count } = await supabase
      .from('geo_locations')
      .select('name, province, region, caps', { count: 'exact' })
      .textSearch('search_vector', searchTerms, {
        type: 'websearch', // Supporta operatori web search (AND, OR, etc.)
        config: 'italian',
      })
      .limit(20); // Max 20 risultati per performance

    if (error) {
      console.error('Errore ricerca Supabase:', error);
      return NextResponse.json(
        {
          error: 'Errore durante la ricerca',
          message: error.message,
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

