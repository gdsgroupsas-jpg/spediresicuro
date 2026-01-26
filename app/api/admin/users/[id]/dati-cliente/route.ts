/**
 * API Route per Gestione Dati Cliente (Admin)
 *
 * POST: Salva/aggiorna i dati cliente per un utente specifico (solo admin)
 */

import { requireAuth } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';
import type { DatiCliente } from '@/lib/database';
import { updateUser } from '@/lib/database';
import { supabaseAdmin } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // Verifica che l'utente sia admin o superadmin
    const actorEmail = context!.actor.email?.toLowerCase() || '';
    const { data: actorData } = await supabaseAdmin
      .from('users')
      .select('account_type, role')
      .eq('email', actorEmail)
      .single();

    const isAdmin =
      actorData?.account_type === 'superadmin' ||
      actorData?.account_type === 'reseller_admin' ||
      actorData?.role === 'admin';

    if (!isAdmin) {
      return ApiErrors.FORBIDDEN('Solo gli admin possono modificare i dati di altri utenti');
    }

    const userId = params.id;

    // Verifica che l'utente target esista
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return ApiErrors.NOT_FOUND('Utente');
    }

    const body = await request.json();
    const {
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
    } = body;

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

    // Costruisci oggetto DatiCliente
    const datiCliente: DatiCliente = {
      nome,
      cognome,
      codiceFiscale: codiceFiscale.toUpperCase(),
      telefono,
      email: targetUser.email,
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

    // Aggiorna utente
    console.log('💾 [API ADMIN DATI CLIENTE] Salvataggio dati cliente:', {
      adminEmail: actorEmail,
      targetUserId: userId,
      targetEmail: targetUser.email,
      datiCompletati: datiCliente.datiCompletati,
    });

    const updatedUser = await updateUser(userId, {
      datiCliente,
    });

    console.log('✅ [API ADMIN DATI CLIENTE] Utente aggiornato:', {
      userId: updatedUser.id,
      hasDatiCliente: !!updatedUser.datiCliente,
      datiCompletati: updatedUser.datiCliente?.datiCompletati,
    });

    return NextResponse.json({
      success: true,
      message: 'Dati cliente salvati con successo',
      datiCliente,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN DATI CLIENTE] Errore salvataggio dati cliente:', error);
    return handleApiError(error, 'POST /api/admin/users/[id]/dati-cliente');
  }
}
