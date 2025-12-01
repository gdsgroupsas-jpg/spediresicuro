/**
 * API Route per Gestione Dati Cliente
 * 
 * GET: Recupera i dati cliente dell'utente corrente
 * POST: Salva/aggiorna i dati cliente dell'utente corrente
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { findUserByEmail, updateUser } from '@/lib/database'
import type { DatiCliente } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const user = await findUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      datiCliente: user.datiCliente || null,
    })
  } catch (error: any) {
    console.error('Errore recupero dati cliente:', error)
    return NextResponse.json(
      { error: 'Errore durante il recupero dei dati' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let user: any = null; // Dichiarato fuori dal try per accesso nel catch
  let session: any = null; // Dichiarato fuori dal try per accesso nel catch
  try {
    session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    user = await findUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    const body = await request.json()
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
    } = body

    // Validazione campi obbligatori
    if (!nome || !cognome || !codiceFiscale || !telefono || !indirizzo || !citta || !provincia || !cap) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      )
    }

    // Validazione codice fiscale
    if (codiceFiscale.length !== 16) {
      return NextResponse.json(
        { error: 'Il codice fiscale deve essere di 16 caratteri' },
        { status: 400 }
      )
    }

    // Validazione dati azienda se tipoCliente === 'azienda'
    if (tipoCliente === 'azienda') {
      if (!ragioneSociale || !partitaIva) {
        return NextResponse.json(
          { error: 'Ragione sociale e partita IVA sono obbligatori per le aziende' },
          { status: 400 }
        )
      }
      if (partitaIva.length !== 11) {
        return NextResponse.json(
          { error: 'La partita IVA deve essere di 11 caratteri' },
          { status: 400 }
        )
      }
    }

    // Costruisci oggetto DatiCliente
    const datiCliente: DatiCliente = {
      nome,
      cognome,
      codiceFiscale: codiceFiscale.toUpperCase(),
      telefono,
      email: session.user.email,
      indirizzo,
      citta,
      provincia: provincia.toUpperCase(),
      cap,
      nazione: nazione || 'Italia',
      tipoCliente: tipoCliente || 'persona',
      datiCompletati: true,
      dataCompletamento: new Date().toISOString(),
    }

    // Aggiungi campi opzionali se presenti
    if (dataNascita) datiCliente.dataNascita = dataNascita
    if (luogoNascita) datiCliente.luogoNascita = luogoNascita
    if (sesso) datiCliente.sesso = sesso as 'M' | 'F'
    if (cellulare) datiCliente.cellulare = cellulare

    // Dati azienda
    if (tipoCliente === 'azienda') {
      datiCliente.ragioneSociale = ragioneSociale
      datiCliente.partitaIva = partitaIva
      if (codiceSDI) datiCliente.codiceSDI = codiceSDI
      if (pec) datiCliente.pec = pec
      if (indirizzoFatturazione) datiCliente.indirizzoFatturazione = indirizzoFatturazione
      if (cittaFatturazione) datiCliente.cittaFatturazione = cittaFatturazione
      if (provinciaFatturazione) datiCliente.provinciaFatturazione = provinciaFatturazione.toUpperCase()
      if (capFatturazione) datiCliente.capFatturazione = capFatturazione
    }

    // Dati bancari
    if (iban) datiCliente.iban = iban.toUpperCase()
    if (banca) datiCliente.banca = banca
    if (nomeIntestatario) datiCliente.nomeIntestatario = nomeIntestatario

    // Documento identità
    if (documentoIdentita && documentoIdentita.tipo) {
      datiCliente.documentoIdentita = {
        tipo: documentoIdentita.tipo,
        numero: documentoIdentita.numero,
        rilasciatoDa: documentoIdentita.rilasciatoDa,
        dataRilascio: documentoIdentita.dataRilascio,
        dataScadenza: documentoIdentita.dataScadenza,
      }
    }

    // Aggiorna utente (ora è asincrono e usa Supabase)
    await updateUser(user.id, {
      datiCliente,
    })

    return NextResponse.json({
      success: true,
      message: 'Dati cliente salvati con successo',
      datiCliente,
    })
  } catch (error: any) {
    console.error('❌ [DATI CLIENTE] Errore salvataggio dati cliente:', error)
    console.error('❌ [DATI CLIENTE] Dettagli errore:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      userId: user?.id,
      email: session?.user?.email,
    })
    
    // Messaggio errore più dettagliato per l'utente
    let errorMessage = 'Errore durante il salvataggio dei dati';
    if (error?.message?.includes('dati_cliente')) {
      errorMessage = 'Errore: il campo dati_cliente non esiste nella tabella users. Esegui lo script SQL per aggiungere il campo.';
    } else if (error?.message?.includes('Supabase')) {
      errorMessage = `Errore Supabase: ${error.message}`;
    } else if (error?.code === 'EROFS') {
      errorMessage = 'Errore: file system read-only. Verifica che Supabase sia configurato correttamente.';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

