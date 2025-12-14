'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { xpay } from '@/lib/payments/intesa-xpay';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Inizia una ricarica con Carta (Intesa XPay)
 */
export async function initiateCardRecharge(amountCredit: number) {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Calcola Totale con Commissioni
  const { fee, total } = xpay.calculateFee(amountCredit);

  // 2. Crea Transazione nel DB (Pending)
  const { data: tx, error } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: user.id,
      amount_credit: amountCredit,
      amount_fee: fee,
      amount_total: total,
      provider: 'intesa',
      status: 'pending'
    })
    .select()
    .single();

  if (error || !tx) throw new Error('Errore creazione transazione: ' + error?.message);

  // 3. Genera parametri XPay
  const paymentData = xpay.createPaymentSession(tx.id, total, user.email || '');

  return {
    success: true,
    paymentUrl: paymentData.url,
    fields: paymentData.fields,
    feeInfo: { credit: amountCredit, fee, total }
  };
}

/**
 * Gestisce l'upload della ricevuta bonifico
 * Con validazioni server-side: tipo file, dimensione, importo, rate limiting, duplicati
 */
export async function uploadBankTransferReceipt(formData: FormData) {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const file = formData.get('file') as File;
  const declaredAmount = parseFloat(formData.get('amount') as string);
  
  // ============================================
  // VALIDAZIONI SERVER-SIDE
  // ============================================
  
  // 1. Validazione file
  if (!file) return { success: false, error: 'File non fornito' };
  
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: `File troppo grande. Dimensione massima: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Formato file non supportato. Solo JPG, PNG o PDF.' };
  }
  
  // 2. Validazione importo
  const MIN_AMOUNT = 0.01;
  const MAX_AMOUNT = 10000.00;
  
  if (isNaN(declaredAmount) || declaredAmount < MIN_AMOUNT || declaredAmount > MAX_AMOUNT) {
    return { 
      success: false, 
      error: `Importo non valido. Deve essere tra €${MIN_AMOUNT} e €${MAX_AMOUNT.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` 
    };
  }
  
  // 3. Rate limiting: max 5 richieste nelle ultime 24h
  const { count: recentCount } = await supabase
    .from('top_up_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (recentCount && recentCount >= 5) {
    return { 
      success: false, 
      error: 'Hai raggiunto il limite di 5 richieste nelle ultime 24 ore. Riprova domani.' 
    };
  }
  
  // 4. Calcola hash file per anti-duplicati
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 5. Controllo duplicati: stesso file_hash + user_id
  const { data: duplicate } = await supabase
    .from('top_up_requests')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('file_hash', fileHash)
    .limit(1)
    .single();
  
  if (duplicate) {
    return { 
      success: false, 
      error: 'File già caricato in precedenza. Controlla le tue richieste in sospeso.' 
    };
  }
  
  // 6. Controllo duplicati: stesso amount + user_id nelle ultime 24h
  const { data: duplicateAmount } = await supabase
    .from('top_up_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('amount', declaredAmount)
    .in('status', ['pending', 'manual_review'])
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .single();
  
  if (duplicateAmount) {
    return { 
      success: false, 
      error: 'Hai già una richiesta in sospeso con lo stesso importo. Attendi l\'approvazione.' 
    };
  }

  // ============================================
  // UPLOAD FILE
  // ============================================
  
  const fileName = `${user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(fileName, file);

  if (uploadError) return { success: false, error: 'Upload fallito: ' + uploadError.message };

  // ============================================
  // CREA RECORD
  // ============================================
  
  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(fileName);

  const { data: req, error: dbError } = await supabase
    .from('top_up_requests')
    .insert({
      user_id: user.id,
      amount: declaredAmount,
      file_url: publicUrl,
      file_hash: fileHash,
      status: 'pending',
      ai_confidence: 0 // In attesa di analisi
    })
    .select()
    .single();
    
  if (dbError) return { success: false, error: dbError.message };

  // ============================================
  // AUDIT LOG
  // ============================================
  
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action: 'top_up_request_created',
      resource_type: 'top_up_request',
      resource_id: req.id,
      user_email: user.email || 'unknown',
      user_id: user.id,
      metadata: {
        amount: declaredAmount,
        file_size: file.size,
        file_type: file.type,
      }
    });
  } catch (auditError) {
    // Non bloccare se audit fallisce
    console.warn('Errore audit log:', auditError);
  }
  
  return { success: true, requestId: req.id, message: 'Ricevuta caricata. In attesa di approvazione.' };
}

/**
 * Aggiorna il bilancio del wallet (SOLO ADMIN o SYSTEM)
 * Exported per uso interno, non esporre direttamente senza controlli
 */
export async function rechargeMyWallet(amount: number, reason: string) {
    // Questa funzione era usata dal vecchio dialog di test. 
    // Ora la rendiamo compatibile o la deprecchiamo in favore dei nuovi flussi.
    // Per retrocompatibilità (Admin Gift):
    const supabase = createServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // In produzione, bloccare questo per utenti normali!
    // Qui assumiamo sia un ambiente dev o che solo admin la chiami.
    // Per ora la lasciamo funzionante come "Self Recharge" di test se l'utente è admin, altrimenti errore.
    
    /* 
    if (user.role !== 'admin') { 
        return { success: false, error: 'Solo Admin può usare ricarica manuale diretta.' };
    } 
    */
   
    // ... Logica vecchia ricarica ...
    // Per ora ritorniamo Errore per forzare uso nuovi metodi
    return { success: false, error: 'Usa il nuovo wizard Bonifico o Carta.' };
}

/**
 * Verifica se l'utente corrente è Admin o Super Admin
 * (Helper per funzioni di approvazione)
 */
async function verifyAdminAccess(): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return { isAdmin: false, error: 'Non autenticato' }
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type, role')
      .eq('email', session.user.email)
      .single()

    if (error || !user) {
      return { isAdmin: false, error: 'Utente non trovato' }
    }

    const isAdmin = user.account_type === 'superadmin' || 
                   user.account_type === 'admin' || 
                   user.role === 'admin'

    return { 
      isAdmin,
      userId: user.id 
    }
  } catch (error: any) {
    console.error('Errore verifica Admin:', error)
    return { isAdmin: false, error: error.message }
  }
}

/**
 * Server Action: Approva una richiesta top_up_requests e accredita wallet
 * 
 * @param requestId - ID della richiesta da approvare
 * @param approvedAmount - Importo da accreditare (opzionale, default = amount della richiesta)
 * @returns Risultato operazione
 */
export async function approveTopUpRequest(
  requestId: string,
  approvedAmount?: number
): Promise<{
  success: boolean
  message?: string
  error?: string
  transactionId?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin || !adminCheck.userId) {
      return {
        success: false,
        error: 'Solo gli Admin possono approvare richieste di ricarica.',
      }
    }

    // 2. Valida importo se fornito
    if (approvedAmount !== undefined) {
      if (approvedAmount <= 0 || approvedAmount > 10000) {
        return {
          success: false,
          error: 'Importo non valido. Deve essere tra €0.01 e €10.000',
        }
      }
    }

    // 3. Recupera richiesta per ottenere amount se approvedAmount non è specificato
    // (Necessario per impostare approved_amount nell'UPDATE atomico)
    let amountToCredit: number
    if (approvedAmount === undefined) {
      const { data: request, error: requestError } = await supabaseAdmin
        .from('top_up_requests')
        .select('amount')
        .eq('id', requestId)
        .maybeSingle()

      if (requestError || !request) {
        return {
          success: false,
          error: 'Richiesta non trovata.',
        }
      }

      amountToCredit = request.amount
      if (amountToCredit <= 0 || amountToCredit > 10000) {
        return {
          success: false,
          error: 'Importo non valido. Deve essere tra €0.01 e €10.000',
        }
      }
    } else {
      amountToCredit = approvedAmount
    }

    // 4. UPDATE atomico e idempotente: aggiorna solo se status è pending/manual_review
    // Questo pattern previene race conditions: solo il primo UPDATE riesce
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('top_up_requests')
      .update({
        status: 'approved',
        approved_by: adminCheck.userId,
        approved_at: new Date().toISOString(),
        approved_amount: amountToCredit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .in('status', ['pending', 'manual_review'])
      .select('id, user_id, approved_amount')
      .maybeSingle()

    // 5. Se UPDATE restituisce 0 righe (RETURNING null), la richiesta è già processata o non esiste
    if (updateError || !updatedRequest) {
      // Verifica se esiste ma con status diverso
      const { data: existingRequest } = await supabaseAdmin
        .from('top_up_requests')
        .select('status')
        .eq('id', requestId)
        .limit(1)
        .maybeSingle()

      if (existingRequest) {
        return {
          success: false,
          error: 'Richiesta già processata.',
        }
      } else {
        return {
          success: false,
          error: 'Richiesta non trovata.',
        }
      }
    }

    // 6. Accredita wallet usando RPC (no fallback manuale)
    const { data: txId, error: creditError } = await supabaseAdmin.rpc('add_wallet_credit', {
      p_user_id: updatedRequest.user_id,
      p_amount: amountToCredit,
      p_description: `Approvazione richiesta ricarica #${requestId}`,
      p_created_by: adminCheck.userId,
    })

    if (creditError) {
      console.error('Errore accredito wallet:', creditError)
      
      // Rollback: ripristina richiesta a status pending
      const { error: rollbackError } = await supabaseAdmin
        .from('top_up_requests')
        .update({
          status: 'pending',
          approved_by: null,
          approved_at: null,
          approved_amount: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (rollbackError) {
        console.error('Errore rollback richiesta:', rollbackError)
        // Log critico: richiesta in stato inconsistente
      }

      return {
        success: false,
        error: 'Credito non accreditato, richiesta ripristinata.',
      }
    }

    // 7. Audit log
    try {
      const session = await auth()
      // Recupera amount originale per audit (se non già noto)
      const requestAmount = approvedAmount === undefined 
        ? amountToCredit 
        : (await supabaseAdmin.from('top_up_requests').select('amount').eq('id', requestId).maybeSingle()).data?.amount || amountToCredit

      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_approved',
        resource_type: 'top_up_request',
        resource_id: requestId,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {
          request_amount: requestAmount,
          approved_amount: amountToCredit,
          target_user_id: updatedRequest.user_id,
          transaction_id: txId,
        }
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: `Richiesta approvata. Credito di €${amountToCredit} accreditato.`,
      transactionId: txId,
    }
  } catch (error: any) {
    console.error('Errore in approveTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante l\'approvazione.',
    }
  }
}

/**
 * Server Action: Rifiuta una richiesta top_up_requests
 * 
 * @param requestId - ID della richiesta da rifiutare
 * @param reason - Motivo del rifiuto
 * @returns Risultato operazione
 */
export async function rejectTopUpRequest(
  requestId: string,
  reason: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin || !adminCheck.userId) {
      return {
        success: false,
        error: 'Solo gli Admin possono rifiutare richieste di ricarica.',
      }
    }

    // 2. Recupera richiesta
    const { data: request, error: requestError } = await supabaseAdmin
      .from('top_up_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return {
        success: false,
        error: 'Richiesta non trovata.',
      }
    }

    // 3. Verifica status
    if (request.status !== 'pending' && request.status !== 'manual_review') {
      return {
        success: false,
        error: `Richiesta già processata. Status attuale: ${request.status}`,
      }
    }

    // 4. Aggiorna richiesta: status=rejected
    const { error: updateError } = await supabaseAdmin
      .from('top_up_requests')
      .update({
        status: 'rejected',
        approved_by: adminCheck.userId,
        approved_at: new Date().toISOString(),
        admin_notes: reason || 'Rifiutata da admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('Errore aggiornamento richiesta:', updateError)
      return {
        success: false,
        error: updateError.message || 'Errore durante il rifiuto della richiesta.',
      }
    }

    // 5. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_rejected',
        resource_type: 'top_up_request',
        resource_id: requestId,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {
          request_amount: request.amount,
          reason: reason || 'Nessun motivo specificato',
          target_user_id: request.user_id,
        }
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: 'Richiesta rifiutata con successo.',
    }
  } catch (error: any) {
    console.error('Errore in rejectTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il rifiuto.',
    }
  }
}
