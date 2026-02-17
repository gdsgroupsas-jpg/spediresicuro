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
import { sendPremiumWelcomeEmail } from '@/lib/email/resend';
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

    // Validazione password se fornita dall'utente
    if (password) {
      if (typeof password !== 'string' || password.trim().length < 8 || password.length > 128) {
        return NextResponse.json(
          { error: 'La password deve essere tra 8 e 128 caratteri' },
          { status: 400 }
        );
      }
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
      // Genera password crittograficamente sicura (CSPRNG)
      const crypto = await import('crypto');
      generatedPassword = crypto.randomBytes(12).toString('base64url').slice(0, 12);
      finalPassword = generatedPassword;
    }

    // ========================================
    // ✨ STEP 1: Crea utente in Supabase Auth PRIMA
    // ========================================
    // Questo è necessario per permettere il login con credentials
    const emailLower = email.toLowerCase().trim();
    const clientName = `${nome} ${cognome}`;

    console.log('🔐 [RESELLER CLIENTS] Creazione utente in Supabase Auth...');

    const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: finalPassword, // Supabase hasha automaticamente
      email_confirm: true, // Conferma email automaticamente (clienti creati da reseller sono verificati)
      user_metadata: {
        name: clientName,
      },
      app_metadata: {
        role: 'user',
        account_type: 'user',
        provider: 'credentials',
        parent_id: resellerId,
      },
    });

    if (authError || !authUserData?.user) {
      console.error('❌ [RESELLER CLIENTS] Errore creazione utente in auth.users:', authError);
      return NextResponse.json(
        { error: authError?.message || "Errore durante la creazione dell'account" },
        { status: 400 }
      );
    }

    const authUserId = authUserData.user.id;
    console.log('✅ [RESELLER CLIENTS] Utente creato in auth.users:', authUserId);

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
    // ✨ STEP 2: CREAZIONE RECORD IN PUBLIC.USERS VIA RPC
    // ========================================
    // Usa la funzione PostgreSQL per garantire:
    // 1. Atomicità: client + listino creati insieme o nessuno dei due
    // 2. Privacy: verifica ownership listino prima di assegnare
    // 3. Sicurezza: SECURITY DEFINER con permessi controllati
    // NOTA: L'utente è già stato creato in auth.users, ora creiamo il record in public.users

    const companyName = tipoCliente === 'azienda' ? ragioneSociale : null;

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_client_with_listino',
      {
        p_reseller_id: resellerId,
        p_email: emailLower,
        p_password_hash: null, // Password gestita da Supabase Auth
        p_name: clientName,
        p_dati_cliente: datiCliente,
        p_price_list_id: priceListId || null,
        p_company_name: companyName,
        p_phone: telefono,
        p_auth_user_id: authUserId, // ⚠️ NUOVO: Usa ID da auth.users
      }
    );

    if (rpcError) {
      console.error('❌ [RESELLER CLIENTS] Errore RPC creazione cliente:', rpcError);

      // ⚠️ ROLLBACK: Elimina utente da auth.users se la creazione in public.users fallisce
      console.log('🔄 [RESELLER CLIENTS] Rollback: eliminazione utente da auth.users...');
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        console.log('✅ [RESELLER CLIENTS] Rollback completato');
      } catch (rollbackError) {
        console.error('❌ [RESELLER CLIENTS] Errore rollback:', rollbackError);
      }

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
        { error: 'Errore durante la creazione del cliente' },
        { status: 500 }
      );
    }

    // Estrai dati dal risultato RPC
    const clientId = rpcResult?.client_id;
    const clientEmail = rpcResult?.email;

    console.log('✅ [RESELLER CLIENTS] Cliente creato:', {
      resellerId,
      clientId,
      tipoCliente,
      priceListId: priceListId || 'none',
    });

    // ========================================
    // ✨ STEP 3: Invia email di benvenuto
    // ========================================
    // Recupera info reseller per personalizzare email
    const { data: resellerInfo } = await supabaseAdmin
      .from('users')
      .select('name, dati_cliente')
      .eq('id', resellerId)
      .single();

    const resellerName = resellerInfo?.name || resellerInfo?.dati_cliente?.ragioneSociale;
    const resellerCompanyName = resellerInfo?.dati_cliente?.ragioneSociale;

    // Invia email premium (non blocca se fallisce)
    try {
      await sendPremiumWelcomeEmail({
        to: emailLower,
        userName: clientName,
        credentials: { email: emailLower, password: finalPassword },
        resellerName: resellerName || undefined,
        resellerCompany: resellerCompanyName || undefined,
      });
      console.log('✅ [RESELLER CLIENTS] Email premium di benvenuto inviata a clientId:', clientId);
    } catch (emailError) {
      console.error('⚠️ [RESELLER CLIENTS] Errore invio email benvenuto:', emailError);
      // Non blocchiamo, il cliente è stato creato
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente creato con successo!',
      client: {
        id: clientId,
        email: clientEmail,
        name: clientName,
      },
      generatedPassword, // Password nel campo dedicato, MAI nel message
      priceListAssigned: !!priceListId,
    });
  } catch (error: any) {
    console.error('❌ [RESELLER CLIENTS] Errore:', error?.message);
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
