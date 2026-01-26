/**
 * API Route per Gestione Clienti Reseller
 *
 * POST: Crea un nuovo cliente per il reseller (persona o azienda)
 * GET: Ottiene lista clienti del reseller
 *
 * ✨ SICUREZZA TOP-TIER:
 * - Creazione atomica client + listino via RPC PostgreSQL
 * - Ownership check su listini (reseller può assegnare SOLO i suoi)
 * - Transazione unica: o tutto o niente
 */

import { requireAuth } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';
import type { DatiCliente } from '@/lib/database';
import { supabaseAdmin } from '@/lib/db/client';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/reseller/clients
 * Crea un nuovo cliente sotto il reseller corrente
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const actorEmail = context!.actor.email?.toLowerCase() || '';

    // Verifica che l'utente sia un reseller
    const { data: actorData, error: actorError } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller, reseller_role')
      .eq('email', actorEmail)
      .single();

    if (actorError || !actorData) {
      return ApiErrors.UNAUTHORIZED('Utente non trovato');
    }

    const isReseller =
      actorData.is_reseller === true ||
      actorData.account_type === 'reseller' ||
      actorData.account_type === 'reseller_admin' ||
      actorData.reseller_role === 'admin';

    if (!isReseller) {
      return ApiErrors.FORBIDDEN('Solo i reseller possono creare clienti');
    }

    const resellerId = actorData.id;

    const body = await request.json();
    const {
      email,
      nome,
      cognome,
      codiceFiscale,
      dataNascita,
      luogoNascita,
      sesso,
      telefono,
      cellulare,
      indirizzo,
      citta,
      provincia,
      cap,
      nazione,
      tipoCliente,
      ragioneSociale,
      partitaIva,
      codiceSDI,
      pec,
      indirizzoFatturazione,
      cittaFatturazione,
      provinciaFatturazione,
      capFatturazione,
      iban,
      banca,
      nomeIntestatario,
      documentoIdentita,
      password,
      priceListId, // ✨ NUOVO: Listino opzionale da assegnare atomicamente
    } = body;

    // Validazione email
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
    }

    // Validazione campi obbligatori
    if (
      !nome ||
      !cognome ||
      !codiceFiscale ||
      !telefono ||
      !indirizzo ||
      !citta ||
      !provincia ||
      !cap
    ) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
    }

    // Validazione codice fiscale
    if (codiceFiscale && codiceFiscale.length !== 16) {
      return NextResponse.json(
        { error: 'Il codice fiscale deve essere di 16 caratteri' },
        { status: 400 }
      );
    }

    // Validazione dati azienda se tipoCliente === 'azienda'
    if (tipoCliente === 'azienda') {
      if (!ragioneSociale || !partitaIva) {
        return NextResponse.json(
          {
            error: 'Ragione sociale e partita IVA sono obbligatori per le aziende',
          },
          { status: 400 }
        );
      }
      if (partitaIva.length !== 11) {
        return NextResponse.json(
          { error: 'La partita IVA deve essere di 11 caratteri' },
          { status: 400 }
        );
      }
    }

    // Verifica se utente esiste già
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Un utente con questa email esiste già' }, { status: 400 });
    }

    // Genera password se non fornita
    let finalPassword = password;
    let generatedPassword: string | undefined;

    if (!finalPassword) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
      finalPassword = '';
      for (let i = 0; i < 12; i++) {
        finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      generatedPassword = finalPassword;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Costruisci oggetto DatiCliente
    const datiCliente: DatiCliente = {
      nome,
      cognome,
      codiceFiscale: codiceFiscale.toUpperCase(),
      telefono,
      email: email.toLowerCase().trim(),
      indirizzo,
      citta,
      provincia: provincia.toUpperCase(),
      cap,
      nazione: nazione || 'Italia',
      tipoCliente: tipoCliente || 'persona',
      datiCompletati: true,
      dataCompletamento: new Date().toISOString(),
    };

    // Aggiungi campi opzionali se presenti
    if (dataNascita) datiCliente.dataNascita = dataNascita;
    if (luogoNascita) datiCliente.luogoNascita = luogoNascita;
    if (sesso) datiCliente.sesso = sesso as 'M' | 'F';
    if (cellulare) datiCliente.cellulare = cellulare;

    // Dati azienda
    if (tipoCliente === 'azienda') {
      datiCliente.ragioneSociale = ragioneSociale;
      datiCliente.partitaIva = partitaIva;
      if (codiceSDI) datiCliente.codiceSDI = codiceSDI;
      if (pec) datiCliente.pec = pec;
      if (indirizzoFatturazione) datiCliente.indirizzoFatturazione = indirizzoFatturazione;
      if (cittaFatturazione) datiCliente.cittaFatturazione = cittaFatturazione;
      if (provinciaFatturazione)
        datiCliente.provinciaFatturazione = provinciaFatturazione.toUpperCase();
      if (capFatturazione) datiCliente.capFatturazione = capFatturazione;
    }

    // Dati bancari
    if (iban) datiCliente.iban = iban.toUpperCase();
    if (banca) datiCliente.banca = banca;
    if (nomeIntestatario) datiCliente.nomeIntestatario = nomeIntestatario;

    // Documento identità
    if (documentoIdentita && documentoIdentita.tipo) {
      datiCliente.documentoIdentita = {
        tipo: documentoIdentita.tipo,
        numero: documentoIdentita.numero,
        rilasciatoDa: documentoIdentita.rilasciatoDa,
        dataRilascio: documentoIdentita.dataRilascio,
        dataScadenza: documentoIdentita.dataScadenza,
      };
    }

    // ========================================
    // ✨ CREAZIONE ATOMICA VIA RPC
    // ========================================
    // Usa la funzione PostgreSQL per garantire:
    // 1. Atomicità: client + listino creati insieme o nessuno dei due
    // 2. Privacy: verifica ownership listino prima di assegnare
    // 3. Sicurezza: SECURITY DEFINER con permessi controllati

    const clientName = `${nome} ${cognome}`;
    const companyName = tipoCliente === 'azienda' ? ragioneSociale : null;

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_client_with_listino',
      {
        p_reseller_id: resellerId,
        p_email: email.toLowerCase().trim(),
        p_password_hash: hashedPassword,
        p_name: clientName,
        p_dati_cliente: datiCliente,
        p_price_list_id: priceListId || null,
        p_company_name: companyName,
        p_phone: telefono,
      }
    );

    if (rpcError) {
      console.error('❌ [RESELLER CLIENTS] Errore RPC creazione cliente:', rpcError);

      // Gestione errori specifici dalla RPC
      const errorMessage = rpcError.message || '';

      if (errorMessage.includes('EMAIL_EXISTS')) {
        return NextResponse.json(
          { error: 'Un utente con questa email esiste già' },
          { status: 400 }
        );
      }

      if (errorMessage.includes('LISTINO_NOT_OWNED')) {
        return NextResponse.json(
          {
            error:
              'Non puoi assegnare questo listino. Puoi assegnare solo listini che hai creato tu.',
          },
          { status: 403 }
        );
      }

      if (errorMessage.includes('LISTINO_NOT_ACTIVE')) {
        return NextResponse.json({ error: 'Il listino selezionato non è attivo' }, { status: 400 });
      }

      if (errorMessage.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: 'Non sei autorizzato a creare clienti' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: rpcError.message || 'Errore durante la creazione del cliente' },
        { status: 500 }
      );
    }

    // Estrai dati dal risultato RPC
    const clientId = rpcResult?.client_id;
    const clientEmail = rpcResult?.email;

    console.log('✅ [RESELLER CLIENTS] Cliente creato ATOMICAMENTE:', {
      resellerId,
      clientId,
      clientEmail,
      tipoCliente,
      priceListId: priceListId || 'none',
    });

    return NextResponse.json({
      success: true,
      message: generatedPassword
        ? `Cliente creato con successo! Password generata: ${generatedPassword}`
        : 'Cliente creato con successo!',
      client: {
        id: clientId,
        email: clientEmail,
        name: clientName,
      },
      generatedPassword,
      priceListAssigned: !!priceListId,
    });
  } catch (error: any) {
    console.error('❌ [RESELLER CLIENTS] Errore:', error);
    return handleApiError(error, 'POST /api/reseller/clients');
  }
}

/**
 * GET /api/reseller/clients
 * Ottiene lista clienti del reseller corrente
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const actorEmail = context!.actor.email?.toLowerCase() || '';

    // Verifica che l'utente sia un reseller
    const { data: actorData, error: actorError } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller, reseller_role')
      .eq('email', actorEmail)
      .single();

    if (actorError || !actorData) {
      return ApiErrors.UNAUTHORIZED('Utente non trovato');
    }

    const isReseller =
      actorData.is_reseller === true ||
      actorData.account_type === 'reseller' ||
      actorData.account_type === 'reseller_admin' ||
      actorData.reseller_role === 'admin';

    if (!isReseller) {
      return ApiErrors.FORBIDDEN('Solo i reseller possono visualizzare i clienti');
    }

    const resellerId = actorData.id;

    // Ottieni clienti del reseller
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at, wallet_balance, dati_cliente, company_name, phone')
      .eq('parent_id', resellerId)
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('❌ [RESELLER CLIENTS] Errore fetch clienti:', clientsError);
      return NextResponse.json(
        { error: 'Errore durante il recupero dei clienti' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clients: clients || [],
      total: clients?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ [RESELLER CLIENTS] Errore GET:', error);
    return handleApiError(error, 'GET /api/reseller/clients');
  }
}
