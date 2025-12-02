/**
 * API Route: Address Validation
 * 
 * Valida indirizzi usando Google Maps Geocoding API
 * Verifica l'esistenza della via e suggerisce correzioni se necessario
 */

import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResponse {
  results: Array<{
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, city, province, zip } = body;

    if (!address || !city) {
      return NextResponse.json(
        { success: false, error: 'Indirizzo e città sono obbligatori' },
        { status: 400 }
      );
    }

    // Verifica se Google Maps API Key è configurata
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      // Se non c'è API key, ritorna success senza validazione
      return NextResponse.json({
        success: true,
        isValid: true,
        message: 'Validazione non disponibile (API key non configurata)',
      });
    }

    // Costruisci query per Google Geocoding
    // Formato: "Via Roma 20, 00100 Roma, IT"
    const queryParts = [address];
    if (zip) queryParts.push(zip);
    if (city) queryParts.push(city);
    if (province) queryParts.push(province);
    queryParts.push('Italia');
    
    const query = queryParts.join(', ');
    const encodedQuery = encodeURIComponent(query);

    // Chiama Google Geocoding API
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${apiKey}&language=it&region=it`;
    
    const response = await fetch(geocodingUrl);
    const data: GeocodingResponse = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      // Nessun risultato trovato - indirizzo probabilmente non esiste
      return NextResponse.json({
        success: true,
        isValid: false,
        message: 'Indirizzo non trovato su Google Maps',
        suggestion: null,
      });
    }

    if (data.status === 'OK' && data.results.length > 0) {
      const firstResult = data.results[0];
      const formattedAddress = firstResult.formatted_address;

      // Estrai componenti dell'indirizzo
      const streetNumber = firstResult.address_components.find(c => 
        c.types.includes('street_number')
      )?.long_name || '';
      
      const route = firstResult.address_components.find(c => 
        c.types.includes('route')
      )?.long_name || '';

      // Verifica se l'indirizzo corrisponde (confronto fuzzy)
      const inputAddressLower = address.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const resultAddressLower = formattedAddress.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      
      // Controlla se la via corrisponde
      const routeMatch = route.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const inputRoute = inputAddressLower.split(/\s+/).slice(0, -1).join(' '); // Rimuovi numero civico

      // Se la via non corrisponde esattamente, suggerisci correzione
      if (!inputRoute.includes(routeMatch) && !routeMatch.includes(inputRoute)) {
        const suggestedAddress = streetNumber && route 
          ? `${route}, ${streetNumber}` 
          : formattedAddress;

        return NextResponse.json({
          success: true,
          isValid: false,
          message: 'Indirizzo non trovato esattamente',
          suggestion: suggestedAddress,
          formattedAddress: formattedAddress,
        });
      }

      // Indirizzo valido
      return NextResponse.json({
        success: true,
        isValid: true,
        message: 'Indirizzo verificato',
        formattedAddress: formattedAddress,
        location: firstResult.geometry.location,
      });
    }

    // Altri stati (es. OVER_QUERY_LIMIT, REQUEST_DENIED)
    return NextResponse.json({
      success: true,
      isValid: true,
      message: `Stato validazione: ${data.status}`,
    });

  } catch (error: any) {
    console.error('Errore validazione indirizzo:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la validazione',
      },
      { status: 500 }
    );
  }
}


