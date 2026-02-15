/**
 * API Route per Gestione Clienti SuperAdmin
 *
 * POST: Crea un nuovo cliente assegnandolo a un reseller specifico
 *
 * ✨ SICUREZZA TOP-TIER:
 * - Solo superadmin può usare questa API
 * - Creazione atomica client + listino via RPC PostgreSQL
 * - Può assegnare clienti a qualsiasi reseller
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type { DatiCliente } from '@/lib/database';

/**
 * Verifica che l'utente sia superadmin
 */
async function verifySuperAdmin(): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { authorized: false, error: 'Non autenticato' };
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', context.actor.email)
      .single();

    if (error || !user) {
      return { authorized: false, error: 'Utente non trovato' };
    }

    if (user.account_type !== 'superadmin') {
      return { authorized: false, error: 'Accesso non autorizzato' };
    }

    return { authorized: true, userId: user.id };
  } catch (error: any) {
    console.error('Errore verifica superadmin:', error);
    return { authorized: false, error: error.message };
  }
}

/**
 * POST /api/superadmin/clients
 * Crea un nuovo cliente assegnandolo a un reseller specifico
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifySuperAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

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
      priceListId,
      parentResellerId, // ✨ NUOVO: Reseller a cui assegnare il cliente
    } = body;

    // Validazione parentResellerId obbligatorio per superadmin
    if (!parentResellerId) {
      return NextResponse.json(
        { error: 'Devi selezionare un reseller a cui assegnare il cliente' },
        { status: 400 }
      );
    }

    // Verifica che il reseller esista
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from('users')
      .select('id, email, is_reseller, account_type')
      .eq('id', parentResellerId)
      .single();

    if (resellerError || !reseller) {
      return NextResponse.json({ error: 'Reseller non trovato' }, { status: 400 });
    }

    const isValidReseller =
      reseller.is_reseller === true ||
      reseller.account_type === 'reseller' ||
      reseller.account_type === 'reseller_admin';

    if (!isValidReseller) {
      return NextResponse.json(
        { error: "L'utente selezionato non è un reseller valido" },
        { status: 400 }
      );
    }

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
    const clientName = `${nome} ${cognome}`;
    const companyName = tipoCliente === 'azienda' ? ragioneSociale : null;

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_client_with_listino',
      {
        p_reseller_id: parentResellerId,
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
      console.error('❌ [SUPERADMIN CLIENTS] Errore RPC creazione cliente:', rpcError);

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
            error: 'Il listino selezionato non appartiene al reseller scelto.',
          },
          { status: 403 }
        );
      }

      if (errorMessage.includes('LISTINO_NOT_ACTIVE')) {
        return NextResponse.json({ error: 'Il listino selezionato non è attivo' }, { status: 400 });
      }

      return NextResponse.json(
        { error: rpcError.message || 'Errore durante la creazione del cliente' },
        { status: 500 }
      );
    }

    const clientId = rpcResult?.client_id;
    const clientEmail = rpcResult?.email;

    console.log('✅ [SUPERADMIN CLIENTS] Cliente creato e assegnato a reseller:', {
      superadminId: authCheck.userId,
      resellerId: parentResellerId,
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
      parentResellerId,
    });
  } catch (error: any) {
    console.error('❌ [SUPERADMIN CLIENTS] Errore:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
