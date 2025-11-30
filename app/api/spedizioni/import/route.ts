/**
 * API Route: Import Ordine da File CSV/XLS
 * 
 * Endpoint: POST /api/spedizioni/import
 * 
 * Crea una spedizione da un ordine importato
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { addSpedizione } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Leggi i dati dal body
    const body = await request.json();

    // Validazione campi obbligatori
    if (!body.destinatarioNome) {
      return NextResponse.json(
        { error: 'Nome destinatario obbligatorio' },
        { status: 400 }
      );
    }

    if (!body.destinatarioIndirizzo) {
      return NextResponse.json(
        { error: 'Indirizzo destinatario obbligatorio' },
        { status: 400 }
      );
    }

    if (!body.destinatarioCap || !body.destinatarioCitta) {
      return NextResponse.json(
        { error: 'CAP e città destinatario obbligatori' },
        { status: 400 }
      );
    }

    // Carica mittente predefinito (se disponibile)
    // TODO: Recuperare da impostazioni utente
    const defaultSender = {
      nome: 'Mittente Predefinito',
      indirizzo: '',
      citta: '',
      provincia: '',
      cap: '',
      telefono: '',
      email: '',
    };

    // Prepara dati spedizione
    const spedizioneData = {
      // Mittente (predefinito o da body se presente)
      mittenteNome: body.mittenteNome || defaultSender.nome,
      mittenteIndirizzo: body.mittenteIndirizzo || defaultSender.indirizzo,
      mittenteCitta: body.mittenteCitta || defaultSender.citta,
      mittenteProvincia: body.mittenteProvincia || defaultSender.provincia,
      mittenteCap: body.mittenteCap || defaultSender.cap,
      mittenteTelefono: body.mittenteTelefono || defaultSender.telefono,
      mittenteEmail: body.mittenteEmail || defaultSender.email,

      // Destinatario (da file importato) - struttura completa
      destinatarioNome: body.destinatarioNome || body.nome || body.nominativo || '',
      destinatarioIndirizzo: body.destinatarioIndirizzo || body.indirizzo || '',
      destinatarioCitta: body.destinatarioCitta || body.citta || body.localita || '',
      destinatarioProvincia: body.destinatarioProvincia || body.provincia || '',
      destinatarioCap: body.destinatarioCap || body.cap || '',
      destinatarioTelefono: body.destinatarioTelefono || body.telefono || '',
      destinatarioEmail: body.destinatarioEmail || body.email_dest || body.email || '',

      // Dettagli spedizione
      peso: parseFloat(body.peso) || 1,
      lunghezza: body.lunghezza ? parseFloat(body.lunghezza) : undefined,
      larghezza: body.larghezza ? parseFloat(body.larghezza) : undefined,
      altezza: body.altezza ? parseFloat(body.altezza) : undefined,
      tipoSpedizione: body.tipoSpedizione || 'standard',
      corriere: body.corriere || '',
      contrassegno: body.contrassegno ? parseFloat(String(body.contrassegno).replace(',', '.')) : undefined,
      assicurazione: body.assicurazione ? parseFloat(String(body.assicurazione).replace(',', '.')) : undefined,
      note: body.note || body.contenuto || '',
      
      // Campi aggiuntivi
      order_id: body.order_id || '',
      totale_ordine: body.totale_ordine ? parseFloat(String(body.totale_ordine).replace(',', '.')) : undefined,
      rif_mittente: body.rif_mittente || body.mittenteNome || defaultSender.nome,
      rif_destinatario: body.rif_destinatario || body.destinatarioNome,
      colli: parseInt(body.colli) || 1,
      
      // ⚠️ CRITICO: Tracking/LDV (ldv è il tracking number, NON order_id)
      // LDV = Lettera di Vettura = Tracking Number (es. "3UW1LZ1436641")
      // order_id è un campo separato (es. "406-5945828-8539538")
      // Per ordini importati da Spedisci.Online, ldv contiene il tracking
      // Per ordini da altre fonti (Amazon, Shopify, ecc.), tracking può essere in altri campi
      // ⚠️ DEBUG: Log per verificare cosa arriva
      ldv: body.ldv || '', // PRIMA PRIORITÀ: ldv dal CSV di Spedisci.Online
      tracking: body.ldv || body.tracking || body.tracking_number || body.trackingNumber || '', // PRIMA PRIORITÀ: ldv
      
      // ⚠️ IMPORTANTE: Marca come ordine importato
      imported: true,
      importSource: body.importSource || 'file_csv_xls', // 'file_csv_xls', 'marketplace', 'platform'
      importPlatform: body.importPlatform || '', // Nome piattaforma/marketplace
      verified: false, // Non verificato di default
    };

    // Crea spedizione
    const nuovaSpedizione = addSpedizione(spedizioneData, session.user.email);

    return NextResponse.json(
      {
        success: true,
        data: nuovaSpedizione,
        message: 'Spedizione importata con successo',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Errore import spedizione:', error);
    return NextResponse.json(
      {
        error: 'Errore durante l\'importazione',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

