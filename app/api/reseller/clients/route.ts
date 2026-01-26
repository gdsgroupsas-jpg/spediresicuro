/**
 * API Route per Gestione Clienti Reseller
 *
 * POST: Crea un nuovo cliente per il reseller (persona o azienda)
 * GET: Ottiene lista clienti del reseller
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

    // Crea utente
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          name: `${nome} ${cognome}`,
          role: 'user',
          account_type: 'user',
          parent_id: resellerId,
          is_reseller: false,
          wallet_balance: 0.0,
          company_name: tipoCliente === 'azienda' ? ragioneSociale : null,
          phone: telefono,
          provider: 'credentials',
          dati_cliente: datiCliente,
        },
      ])
      .select('id, email, name')
      .single();

    if (createError) {
      console.error('❌ [RESELLER CLIENTS] Errore creazione cliente:', createError);
      return NextResponse.json(
        { error: createError.message || 'Errore durante la creazione del cliente' },
        { status: 500 }
      );
    }

    console.log('✅ [RESELLER CLIENTS] Cliente creato:', {
      resellerId,
      clientId: newUser.id,
      clientEmail: newUser.email,
      tipoCliente,
    });

    return NextResponse.json({
      success: true,
      message: generatedPassword
        ? `Cliente creato con successo! Password generata: ${generatedPassword}`
        : 'Cliente creato con successo!',
      client: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      generatedPassword,
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
