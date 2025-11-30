/**
 * API Route: OCR Extract
 *
 * Endpoint per estrazione dati da immagini tramite OCR
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOCRAdapter } from '@/lib/adapters/ocr';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, options } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Immagine mancante' },
        { status: 400 }
      );
    }

    // Crea adapter OCR
    // Usa 'auto' per selezionare automaticamente il migliore disponibile:
    // 1. Google Vision (se GOOGLE_CLOUD_CREDENTIALS configurata) ✅ ATTIVO
    // 2. Claude Vision (se ANTHROPIC_API_KEY configurata)
    // 3. Tesseract (se disponibile)
    // 4. Mock (fallback)
    const ocr = createOCRAdapter('auto');
    
    console.log(`🔍 OCR Adapter utilizzato: ${(ocr as any).name || 'unknown'}`);

    // Check disponibilità
    const available = await ocr.isAvailable();
    console.log(`📊 OCR disponibile: ${available}`);
    if (!available) {
      return NextResponse.json(
        {
          success: false,
          error: 'Servizio OCR non disponibile. Contattare l\'amministratore.',
        },
        { status: 503 }
      );
    }

    // Converti base64 a Buffer
    const imageBuffer = Buffer.from(image, 'base64');

    // Estrai dati con fallback: Google Vision → Claude Vision
    let result = await ocr.extract(imageBuffer, options);
    let usedAdapter = (ocr as any).name;

    // Fallback: se Google Vision fallisce, prova Claude
    if (!result.success && usedAdapter === 'google-vision') {
      console.warn('⚠️ Google Vision fallito, provo Claude Vision:', result.error);
      
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const claudeOcr = createOCRAdapter('claude');
          result = await claudeOcr.extract(imageBuffer, options);
          usedAdapter = 'claude-vision';
          console.log('✅ Usando Claude Vision come fallback');
        } catch (error) {
          console.warn('❌ Anche Claude Vision fallito:', error);
        }
      }
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Errore durante l\'estrazione OCR',
        },
        { status: 500 }
      );
    }

    // Normalizza e valida dati estratti
    const normalizedData = normalizeExtractedData(result.extractedData);

    // Valida e corregge CAP-città se possibile
    const validatedData = await validateAndCorrectLocation(normalizedData);

    return NextResponse.json({
      success: true,
      confidence: result.confidence,
      extractedData: validatedData,
      rawText: result.rawText,
    });
  } catch (error: any) {
    console.error('OCR Extract Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore interno del server',
      },
      { status: 500 }
    );
  }
}

/**
 * Normalizza e valida dati estratti
 * Formato compatibile con spedisci.online
 */
function normalizeExtractedData(data: any) {
  return {
    recipient_name: data.recipient_name?.trim() || '',
    recipient_address: data.recipient_address?.trim() || '',
    recipient_city: data.recipient_city?.trim() || data.localita?.trim() || '',
    recipient_zip: data.recipient_zip?.replace(/\s/g, '') || '',
    recipient_province: data.recipient_province?.toUpperCase()?.trim().slice(0, 2) || '',
    recipient_phone: normalizePhone(data.recipient_phone || ''),
    recipient_email: data.recipient_email?.trim() || data.email_destinatario?.trim() || '',
    notes: data.notes?.trim() || '',
    // Campi aggiuntivi per formato spedisci.online
    peso: data.peso?.replace(',', '.') || '',
    colli: data.colli || '1',
    contrassegno: data.contrassegno?.replace(',', '.') || '',
    contenuto: data.contenuto?.trim() || '',
    order_id: data.order_id?.trim() || '',
    totale_ordine: data.totale_ordine?.replace(',', '.') || '',
    rif_mittente: data.rif_mittente?.trim() || '',
    rif_destinatario: data.rif_destinatario?.trim() || data.recipient_name?.trim() || '',
  };
}

/**
 * Normalizza numero telefono italiano
 * Mantiene il simbolo + se presente
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Rimuovi spazi, trattini, parentesi (ma mantieni il +)
  let normalized = phone.replace(/[\s\-()]/g, '');

  // Se inizia con +39, mantieni il +
  if (normalized.startsWith('+39')) {
    return normalized; // Es: "+393911639459"
  }

  // Se inizia con 0039, converti in +39
  if (normalized.startsWith('0039')) {
    return '+' + normalized.substring(2); // Es: "0039333123456" → "+39333123456"
  }

  // Se è un numero italiano senza prefisso (10 cifre che inizia con 3), aggiungi +39
  if (/^3\d{9}$/.test(normalized)) {
    return '+39' + normalized; // Es: "3331234567" → "+393331234567"
  }

  // Se inizia già con +, mantienilo
  if (normalized.startsWith('+')) {
    return normalized;
  }

  // Altrimenti ritorna normalizzato senza prefisso
  return normalized;
}

/**
 * Valida e corregge CAP-città usando il database geo
 * Verifica che CAP e città corrispondano e correggere se necessario
 */
async function validateAndCorrectLocation(data: any): Promise<any> {
  // Se mancano CAP o città, non possiamo validare
  if (!data.recipient_zip || !data.recipient_city) {
    return data;
  }

  try {
    // Valida formato CAP (5 cifre)
    if (!/^\d{5}$/.test(data.recipient_zip)) {
      return data; // CAP non valido, non possiamo validare
    }

    // Cerca la città nel database Supabase
    const { data: cityResults, error: cityError } = await supabase
      .from('comuni')
      .select('name, province, caps')
      .ilike('name', `%${data.recipient_city}%`)
      .limit(10);

    if (!cityError && cityResults && cityResults.length > 0) {
      // Cerca una corrispondenza con il CAP
      const matchingLocation = cityResults.find((loc: any) => 
        loc.caps && Array.isArray(loc.caps) && loc.caps.includes(data.recipient_zip)
      );

      if (matchingLocation) {
        // CAP e città corrispondono - correggi eventuali errori di scrittura
        return {
          ...data,
          recipient_city: matchingLocation.name, // Usa nome corretto dalla DB
          recipient_province: matchingLocation.province || data.recipient_province,
          recipient_zip: data.recipient_zip, // CAP già corretto
        };
      }
    }

    // CAP non corrisponde alla città - cerca per CAP direttamente
    const { data: capResults, error: capError } = await supabase
      .from('comuni')
      .select('name, province, caps')
      .contains('caps', [data.recipient_zip])
      .limit(5);

    if (!capError && capResults && capResults.length > 0) {
      // Prendi il primo risultato (di solito c'è solo una città per CAP)
      const capMatch = capResults[0];

      if (capMatch) {
        // CAP corretto, città sbagliata - correggi
        return {
          ...data,
          recipient_city: capMatch.name,
          recipient_province: capMatch.province || data.recipient_province,
          recipient_zip: data.recipient_zip,
        };
      }
    }
  } catch (error) {
    console.error('Errore validazione CAP-città:', error);
    // In caso di errore, ritorna dati originali
  }

  // Se non riusciamo a validare, ritorna dati originali
  return data;
}
