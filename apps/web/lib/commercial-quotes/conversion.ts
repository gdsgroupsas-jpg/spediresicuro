/**
 * Conversione Preventivo Accettato -> Cliente + Listino
 *
 * Quando un prospect accetta il preventivo, questo modulo:
 * 1. Crea un nuovo price_list custom dalla matrice snapshot
 * 2. Inserisce le price_list_entries dalla matrice
 * 3. Chiama create_client_with_listino() RPC per creare utente + assegnare listino
 *
 * Riusa la funzione atomica esistente in Supabase.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import type { CommercialQuote } from '@/types/commercial-quotes';
import bcrypt from 'bcryptjs';

export interface ConvertQuoteParams {
  quote: CommercialQuote;
  clientEmail: string;
  clientName: string;
  clientPassword: string;
  clientCompanyName?: string;
  clientPhone?: string;
  resellerId: string;
}

export interface ConvertQuoteResult {
  userId: string;
  priceListId: string;
}

/**
 * Converte un preventivo accettato in cliente operativo.
 * Crea listino custom + utente in modo atomico.
 */
export async function convertQuoteToClient(
  params: ConvertQuoteParams
): Promise<ConvertQuoteResult> {
  const {
    quote,
    clientEmail,
    clientName,
    clientPassword,
    resellerId,
    clientCompanyName,
    clientPhone,
  } = params;
  const matrix = quote.price_matrix;

  // Query builder con isolamento multi-tenant
  const wq = workspaceQuery(quote.workspace_id);

  // 1. Verifica stato preventivo
  if (quote.status !== 'accepted') {
    throw new Error('Solo preventivi accettati possono essere convertiti');
  }

  // 2. Crea price_list custom dalla matrice snapshot
  const priceListName = `Listino ${quote.prospect_company} (da preventivo)`;

  const { data: priceList, error: plError } = await supabaseAdmin
    .from('price_lists')
    .insert({
      name: priceListName,
      description: `Generato automaticamente dal preventivo commerciale rev.${quote.revision}`,
      list_type: 'custom',
      status: 'active',
      created_by: resellerId,
      workspace_id: quote.workspace_id,
      default_margin_percent: quote.margin_percent,
      vat_mode: matrix.vat_mode,
      vat_rate: matrix.vat_rate,
      metadata: {
        carrier_code: quote.carrier_code,
        contract_code: quote.contract_code,
        source: 'commercial_quote',
        source_quote_id: quote.id,
        source_revision: quote.revision,
      },
    })
    .select('id')
    .single();

  if (plError || !priceList) {
    throw new Error(`Errore creazione listino: ${plError?.message || 'sconosciuto'}`);
  }

  // 3. Inserisci entries dalla matrice snapshot
  // Zone inverse: da label a zone_code
  const labelToCode: Record<string, string> = {
    Italia: 'IT-ITALIA',
    Sicilia: 'IT-SICILIA',
    Calabria: 'IT-CALABRIA',
    Sardegna: 'IT-SARDEGNA',
    Livigno: 'IT-LIVIGNO',
  };

  const entries: Array<{
    price_list_id: string;
    weight_from: number;
    weight_to: number;
    zone_code: string;
    base_price: number;
    service_type: string;
  }> = [];

  for (let rowIdx = 0; rowIdx < matrix.weight_ranges.length; rowIdx++) {
    const range = matrix.weight_ranges[rowIdx];
    for (let colIdx = 0; colIdx < matrix.zones.length; colIdx++) {
      const zoneName = matrix.zones[colIdx];
      const price = matrix.prices[rowIdx]?.[colIdx];
      if (price && price > 0) {
        entries.push({
          price_list_id: priceList.id,
          weight_from: range.from,
          weight_to: range.to,
          zone_code: labelToCode[zoneName] || zoneName,
          base_price: price,
          service_type: 'standard',
        });
      }
    }
  }

  if (entries.length > 0) {
    const { error: entriesError } = await wq.from('price_list_entries').insert(entries);

    if (entriesError) {
      // Cleanup: elimina listino creato
      await wq.from('price_lists').delete().eq('id', priceList.id);
      throw new Error(`Errore inserimento voci listino: ${entriesError.message}`);
    }
  }

  // 4. Crea utente via RPC atomica
  const passwordHash = await bcrypt.hash(clientPassword, 10);

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'create_client_with_listino',
    {
      p_reseller_id: resellerId,
      p_email: clientEmail.toLowerCase().trim(),
      p_password_hash: passwordHash,
      p_name: clientName,
      p_dati_cliente: {
        ragioneSociale: clientCompanyName || quote.prospect_company,
        telefono: clientPhone || quote.prospect_phone,
        email: clientEmail,
        tipoCliente: 'azienda',
        settore: quote.prospect_sector,
        volumeStimato: quote.prospect_estimated_volume,
        fonte: 'preventivo_commerciale',
        preventivo_id: quote.id,
      },
      p_price_list_id: priceList.id,
      p_company_name: clientCompanyName || quote.prospect_company,
      p_phone: clientPhone || quote.prospect_phone,
    }
  );

  if (rpcError) {
    // Cleanup: elimina listino e entries
    await wq.from('price_list_entries').delete().eq('price_list_id', priceList.id);
    await wq.from('price_lists').delete().eq('id', priceList.id);
    throw new Error(`Errore creazione cliente: ${rpcError.message}`);
  }

  const result = rpcResult as { success: boolean; client_id?: string; error?: string };

  if (!result?.success || !result.client_id) {
    // Cleanup
    await wq.from('price_list_entries').delete().eq('price_list_id', priceList.id);
    await wq.from('price_lists').delete().eq('id', priceList.id);
    throw new Error(result?.error || 'Errore creazione cliente sconosciuto');
  }

  return {
    userId: result.client_id,
    priceListId: priceList.id,
  };
}
