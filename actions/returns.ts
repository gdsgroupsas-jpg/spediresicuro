'use server'

/**
 * Server Actions per Gestione Resi
 * 
 * Gestisce la scansione e registrazione dei resi con OCR/Barcode
 */

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'
import { generateTrackingNumber } from '@/lib/db/shipments'
import type { Shipment } from '@/types/shipments'

/**
 * Cerca una spedizione per tracking number o LDV
 */
async function findShipmentByTracking(trackingNumber: string): Promise<Shipment | null> {
  try {
    // Cerca prima per tracking_number
    let { data, error } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('tracking_number', trackingNumber)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Errore ricerca spedizione per tracking:', error)
      throw new Error(`Errore ricerca spedizione: ${error.message}`)
    }

    // Se trovato per tracking, ritorna
    if (data) {
      return data as Shipment
    }

    // Fallback: cerca per LDV
    const { data: ldvData, error: ldvError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('ldv', trackingNumber)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()

    if (ldvError && ldvError.code !== 'PGRST116') {
      console.error('Errore ricerca spedizione per LDV:', ldvError)
      throw new Error(`Errore ricerca spedizione: ${ldvError.message}`)
    }

    return ldvData as Shipment | null
  } catch (error: any) {
    console.error('Errore in findShipmentByTracking:', error)
    throw error
  }
}

/**
 * Server Action: Processa scansione reso
 * 
 * @param ldvReturnNumber - Numero LDV del reso scansionato
 * @param originalTracking - Tracking number spedizione originale
 * @param returnReason - Motivo del reso
 * @param gpsLocation - Posizione GPS (opzionale)
 * @returns Oggetto con success e dati spedizione reso creata
 */
export async function processReturnScan(
  ldvReturnNumber: string,
  originalTracking: string,
  returnReason: string,
  gpsLocation?: string | null
): Promise<{
  success: boolean
  message?: string
  error?: string
  returnShipment?: Shipment
  originalShipment?: Shipment
}> {
  try {
    // 1. Verifica autenticazione
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per registrare un reso.',
      }
    }

    // 2. Valida input
    if (!ldvReturnNumber || ldvReturnNumber.trim() === '') {
      return {
        success: false,
        error: 'Numero LDV del reso non valido.',
      }
    }

    if (!originalTracking || originalTracking.trim() === '') {
      return {
        success: false,
        error: 'Tracking number spedizione originale non valido.',
      }
    }

    if (!returnReason || returnReason.trim() === '') {
      return {
        success: false,
        error: 'Motivo del reso è obbligatorio.',
      }
    }

    const ldvClean = ldvReturnNumber.trim().toUpperCase()
    const trackingClean = originalTracking.trim().toUpperCase()

    // 3. Cerca spedizione originale
    const originalShipment = await findShipmentByTracking(trackingClean)

    if (!originalShipment) {
      return {
        success: false,
        error: `Nessuna spedizione trovata con tracking: ${trackingClean}`,
      }
    }

    // 4. Verifica che non sia già un reso
    if (originalShipment.is_return) {
      return {
        success: false,
        error: 'La spedizione selezionata è già un reso. Non puoi creare un reso di un reso.',
      }
    }

    // 5. Verifica che non sia già in reso
    if (originalShipment.return_status && originalShipment.return_status !== 'cancelled') {
      return {
        success: false,
        error: `Questa spedizione è già in stato reso: ${originalShipment.return_status}`,
      }
    }

    // 6. Verifica che esista già un reso per questa spedizione
    const { data: existingReturn } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number')
      .eq('original_shipment_id', originalShipment.id)
      .eq('is_return', true)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()

    if (existingReturn) {
      return {
        success: false,
        error: `Esiste già un reso per questa spedizione: ${existingReturn.tracking_number}`,
      }
    }

    // 7. Prepara dati spedizione reso (inverti mittente/destinatario)
    const returnTrackingNumber = generateTrackingNumber()
    const now = new Date().toISOString()

    // Inverti mittente e destinatario per il reso
    const returnShipmentData: any = {
      // ID e tracking
      tracking_number: returnTrackingNumber,
      ldv: ldvClean,
      
      // Reso
      is_return: true,
      original_shipment_id: originalShipment.id,
      return_reason: returnReason.trim(),
      return_status: 'processing',
      
      // Inverti mittente/destinatario
      sender_name: originalShipment.recipient_name,
      sender_address: originalShipment.recipient_address,
      sender_city: originalShipment.recipient_city,
      sender_zip: originalShipment.recipient_zip,
      sender_province: originalShipment.recipient_province,
      sender_country: originalShipment.recipient_country || 'IT',
      sender_phone: originalShipment.recipient_phone,
      sender_email: originalShipment.recipient_email,
      
      recipient_name: originalShipment.sender_name,
      recipient_address: originalShipment.sender_address,
      recipient_city: originalShipment.sender_city,
      recipient_zip: originalShipment.sender_zip,
      recipient_province: originalShipment.sender_province,
      recipient_country: originalShipment.sender_country || 'IT',
      recipient_phone: originalShipment.sender_phone,
      recipient_email: originalShipment.sender_email,
      recipient_type: originalShipment.recipient_type || 'B2C',
      
      // Dati pacco (stessi della spedizione originale)
      weight: originalShipment.weight,
      length: originalShipment.length,
      width: originalShipment.width,
      height: originalShipment.height,
      volumetric_weight: originalShipment.volumetric_weight,
      
      // Valore merce
      declared_value: originalShipment.declared_value,
      currency: originalShipment.currency || 'EUR',
      content: originalShipment.content || `Reso: ${returnReason.trim()}`,
      
      // Servizio (stesso corriere)
      courier_id: originalShipment.courier_id,
      service_type: originalShipment.service_type || 'standard',
      cash_on_delivery: false, // Resi generalmente senza contrassegno
      insurance: originalShipment.insurance || false,
      
      // Pricing (da ricalcolare o lasciare vuoto)
      base_price: originalShipment.base_price,
      final_price: 0, // Reso potrebbe essere gratuito o avere costo diverso
      
      // Utente (stesso della spedizione originale)
      user_id: originalShipment.user_id,
      created_by_user_email: session.user.email,
      
      // Status
      status: 'processing',
      
      // Note
      notes: `Reso della spedizione ${originalShipment.tracking_number}. Motivo: ${returnReason.trim()}`,
      internal_notes: `Reso creato automaticamente tramite scansione LDV: ${ldvClean}`,
      
      // Timestamps
      created_at: now,
      updated_at: now,
      
      // Soft delete
      deleted: false,
    }

    // Aggiungi GPS se fornito
    if (gpsLocation && gpsLocation.trim() !== '') {
      const gpsParts = gpsLocation.split(',')
      if (gpsParts.length === 2) {
        const lat = parseFloat(gpsParts[0].trim())
        const lng = parseFloat(gpsParts[1].trim())
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          returnShipmentData.gps_location = `${lat},${lng}`
        }
      }
    }

    // 8. Crea nuova spedizione reso
    const { data: createdReturn, error: createError } = await supabaseAdmin
      .from('shipments')
      .insert([returnShipmentData])
      .select()
      .single()

    if (createError) {
      console.error('Errore creazione spedizione reso:', createError)
      return {
        success: false,
        error: `Errore durante la creazione del reso: ${createError.message}`,
      }
    }

    // 9. Aggiorna spedizione originale
    const updateOriginalData: any = {
      return_status: 'processing',
      updated_at: now,
    }

    // Aggiungi nota interna
    const existingNotes = originalShipment.internal_notes || ''
    updateOriginalData.internal_notes = existingNotes
      ? `${existingNotes}\n[${new Date().toLocaleString('it-IT')}] Reso richiesto: ${returnReason.trim()}. LDV reso: ${ldvClean}`
      : `[${new Date().toLocaleString('it-IT')}] Reso richiesto: ${returnReason.trim()}. LDV reso: ${ldvClean}`

    const { data: updatedOriginal, error: updateError } = await supabaseAdmin
      .from('shipments')
      .update(updateOriginalData)
      .eq('id', originalShipment.id)
      .select()
      .single()

    if (updateError) {
      console.error('Errore aggiornamento spedizione originale:', updateError)
      // Non bloccare se fallisce, il reso è già stato creato
      console.warn('⚠️ Reso creato ma aggiornamento spedizione originale fallito')
    }

    // 10. Ritorna successo
    return {
      success: true,
      message: `Reso registrato e collegato con successo! Tracking reso: ${returnTrackingNumber}`,
      returnShipment: createdReturn as Shipment,
      originalShipment: updatedOriginal as Shipment || originalShipment,
    }
  } catch (error: any) {
    console.error('Errore in processReturnScan:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la registrazione del reso.',
    }
  }
}

