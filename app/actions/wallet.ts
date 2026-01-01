'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { createStripeCheckoutSession, calculateStripeFee } from '@/lib/payments/stripe';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { withConcurrencyRetry } from '@/lib/wallet/retry';
import { requireSafeAuth } from '@/lib/safe-auth';

/**
 * Inizia una ricarica con Carta (Stripe)
 * 
 * Sostituisce XPay con Stripe per pagamenti più universali e migliore UX.
 */
export async function initiateCardRecharge(amountCredit: number) {
  // Usa requireSafeAuth per supportare impersonation
  const context = await requireSafeAuth();
  const targetId = context.target.id;
  const targetEmail = context.target.email || '';

  // Validazione importo
  if (amountCredit <= 0 || amountCredit > 10000) {
    throw new Error('Importo non valido. Deve essere tra €0.01 e €10.000');
  }

  // 1. Calcola Totale con Commissioni Stripe
  const { fee, total } = calculateStripeFee(amountCredit);

  // 2. Crea Stripe Checkout Session
  const { sessionId, url, transactionId } = await createStripeCheckoutSession({
    amountCredit,
    userId: targetId,
    userEmail: targetEmail,
  });

  if (!url) {
    throw new Error('Errore creazione sessione Stripe');
  }

  return {
    success: true,
    checkoutUrl: url, // URL Stripe Checkout (redirect diretto)
    sessionId,
    transactionId,
    feeInfo: { credit: amountCredit, fee, total },
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

  // ============================================
  // AI ANALYSIS (ASYNC / BLOCKING for MVP)
  // ============================================
  
  // Per MVP facciamo attendere l'utente qualche secondo per dargli feedback immediato
  // In futuro: spostare in background job (Inngest/Queue)
  let aiConfidence = 0;
  let aiNotes = '';

  try {
    const { analyzeBankReceipt } = await import('@/lib/ai/vision');
    const arrayBuffer = await file.arrayBuffer(); // Rileggiamo buffer
    
    console.log('🤖 Avvio analisi AI ricevuta...');
    const analysis = await analyzeBankReceipt(arrayBuffer, file.type);
    console.log('🤖 Risultato AI:', analysis);

    aiConfidence = analysis.confidence;
    
    // Aggiorna subito il record con i dati AI
    if (analysis.confidence > 0) {
        await supabase
            .from('top_up_requests')
            .update({
                ai_confidence: analysis.confidence,
                // Salviamo i dati estratti in un campo metadata (se esiste) o in admin_notes per ora
                admin_notes: `[AI EXTRACTION]\nImporto rilevato: ${analysis.amount}\nCRO: ${analysis.cro}\nData: ${analysis.date}\nConfidenza: ${analysis.confidence}`,
                // Se l'importo rilevato differisce molto da quello dichiarato, flaggiamo
                status: (analysis.amount && Math.abs(analysis.amount - declaredAmount) > 0.1) ? 'manual_review' : 'pending'
            })
            .eq('id', req.id);
    }

  } catch (aiError) {
    console.error('Errore AI Pipeline:', aiError);
    // Non blocchiamo il flusso se l'AI fallisce
  }

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
  // const fs = require('fs');
  // const path = require('path');
  // const logFile = '...';
  // const log = ...
  // Disable file logging for production
  
  const log = (msg: string, data?: any) => {
    console.log(`[TOPUP_APPROVE] ${msg}`, data ? JSON.stringify(data) : '');
  };

  log('START approveTopUpRequest', { requestId, approvedAmount });

  log('START approveTopUpRequest', { requestId, approvedAmount });
 
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    log('Admin Check result', adminCheck);
    if (!adminCheck.isAdmin || !adminCheck.userId) {
      log('Admin Access Denied');
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
    // Nota: supabaseAdmin usa service role key che dovrebbe bypassare RLS
    console.info('[TOPUP_APPROVE] Attempting UPDATE', {
      requestId,
      adminUserId: adminCheck.userId,
      amountToCredit,
      usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    
    // Prova UPDATE con supabaseAdmin (service role key bypassa RLS)
    // Se fallisce, potrebbe essere un problema di configurazione service role key
    const updatePayload = {
      status: 'approved',
      approved_by: adminCheck.userId,
      approved_at: new Date().toISOString(),
      approved_amount: amountToCredit,
      updated_at: new Date().toISOString(),
    }
    
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('top_up_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .in('status', ['pending', 'manual_review'])
      .select('id, user_id, approved_amount, status')
      .maybeSingle()
    
    // Log dettagliato per debug
    if (updateError) {
      console.error('[TOPUP_APPROVE] UPDATE error details', {
        requestId,
        updatePayload,
        errorMessage: updateError.message,
        errorCode: updateError.code,
        errorDetails: updateError.details,
        errorHint: updateError.hint,
      })
    }

    // 5. Se UPDATE non ha aggiornato righe, diagnostica il problema
    if (updateError || !updatedRequest) {
      console.error('[TOPUP_APPROVE] UPDATE failed', {
        requestId,
        updateError: updateError?.message || 'No error but no rows updated',
        updateErrorCode: updateError?.code,
        updateErrorDetails: updateError?.details,
      })

      // Verifica stato reale della richiesta per capire il motivo
      const { data: existingRequest, error: selectError } = await supabaseAdmin
        .from('top_up_requests')
        .select('id, status, approved_by, approved_at, approved_amount, updated_at')
        .eq('id', requestId)
        .maybeSingle()

      if (selectError) {
        console.error('[TOPUP_APPROVE] SELECT failed after UPDATE failure', {
          requestId,
          selectError: selectError.message,
          selectErrorCode: selectError.code,
        })
        return {
          success: false,
          error: 'Errore durante la verifica della richiesta.',
        }
      }

      // Caso 1: Richiesta non esiste
      if (!existingRequest) {
        console.info('[TOPUP_APPROVE] Request not found', { requestId })
        return {
          success: false,
          error: 'Richiesta non trovata.',
        }
      }

      // Caso 2: Richiesta esiste ma status NON è pending/manual_review → già processata
      if (existingRequest.status !== 'pending' && existingRequest.status !== 'manual_review') {
        console.info('[TOPUP_APPROVE] Request already processed', {
          requestId,
          currentStatus: existingRequest.status,
          approvedBy: existingRequest.approved_by,
          approvedAt: existingRequest.approved_at,
        })
        return {
          success: false,
          error: 'Richiesta già processata.',
        }
      }

      // Caso 3: Richiesta esiste e status è ancora pending/manual_review → UPDATE fallito per altri motivi
      console.warn('[TOPUP_APPROVE] UPDATE failed but status still pending/manual_review. Attempting RPC fallback.', {
        requestId,
        updateError: updateError?.message
      })
      
      // FALLBACK: Prova funzione RPC (SECURITY DEFINER)
      // Questo bypassa RLS se la policy UPDATE fallisce e se la funzione esiste
      try {
        log('Attempting RPC fallback');
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('approve_top_up_request', {
          p_request_id: requestId,
          p_admin_user_id: adminCheck.userId,
          p_approved_amount: amountToCredit
        })

        if (rpcError) {
             log('RPC Error thrown', rpcError);
             throw rpcError
        }

        // Se RPC ritorna array (pattern comune in PG functions) o oggetto
        const resultRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
        log('RPC Result Row', resultRow);

        if (!resultRow || !resultRow.success) {
            console.error('[TOPUP_APPROVE] RPC fallback failed logic', resultRow)
            log('RPC Failed Logic', resultRow);
            return {
                success: false, 
                error: resultRow?.error_message || 'Impossibile approvare: anche RPC fallback fallito.'
            }
        }

        // Se RPC ha successo, consideriamo l'update fatto.
        // Dobbiamo però recuperare i dati aggiornati per proseguire col wallet credit?
        // La funzione RPC in migration 030 fa SOLO l'update dello status.
        // NON fa l'accredito wallet (quello lo facciamo noi qui sotto).
        // Quindi dobbiamo solo assicurarci che RPC abbia settato approved_amount ecc.
        
        // Recuperiamo request aggiornata per sicurezza e per avere user_id
        const { data: refreshedRequest, error: refreshError } = await supabaseAdmin
            .from('top_up_requests')
            .select('id, user_id, approved_amount, status')
            .eq('id', requestId)
            .single()
            
        if (refreshError || !refreshedRequest) {
            return { success: false, error: 'Errore post-RPC: impossibile rileggere la richiesta.' }
        }
        
        // Aggiorniamo updatedRequest per usarlo nello step successivo (accredito wallet)
        // ATTENZIONE: updatedRequest era const, ma qui siamo in un blocco dove updatedRequest era nullo.
        // Dobbiamo restituire il controllo al flusso principale?
        // Il codice originale faceva "return { error }" qui. 
        // Invece di ritornare, impostiamo una variabile flag o proseguiamo duplicando logica?
        // Per pulizia, eseguiamo accredito wallet QUI e ritorniamo.
        
         console.info('[TOPUP_APPROVE] RPC fallback successful', {
          requestId,
          userId: refreshedRequest.user_id,
          approvedAmount: refreshedRequest.approved_amount,
        })
        
        // 7. Accredita wallet usando RPC (no fallback manuale)
        // Smart retry per lock contention (55P03)
        const { data: txId, error: creditError } = await withConcurrencyRetry(
          async () => await supabaseAdmin.rpc('add_wallet_credit', {
            p_user_id: refreshedRequest.user_id,
            p_amount: refreshedRequest.approved_amount, // Usa quello salvato nel DB
            p_description: `Approvazione richiesta ricarica #${requestId}`,
            p_created_by: adminCheck.userId,
          }),
          { operationName: 'topup_credit_fallback' }
        )
        
        if (creditError) {
             console.error('[TOPUP_APPROVE] RPC add_wallet_credit failed (in fallback)', creditError)
             return { success: false, error: 'Status aggiornato ma accredito wallet fallito. Contattare supporto.' }
        }
        
        // Audit log (non bloccante)
        try {
          const session = await auth()
          await supabaseAdmin.from('audit_logs').insert({
            action: 'top_up_request_approved_rpc',
            resource_type: 'top_up_request',
            resource_id: requestId,
            user_email: session?.user?.email || 'unknown',
            user_id: adminCheck.userId,
            metadata: {
               method: 'rpc_fallback',
               amount: refreshedRequest.approved_amount,
               target: refreshedRequest.user_id
            }
          })
        } catch (e) {}

        return {
            success: true,
            message: `Richiesta approvata (RPC). Credito di €${refreshedRequest.approved_amount} accreditato.`,
            transactionId: txId
        }

      } catch (rpcErr: any) {
          console.error('[TOPUP_APPROVE] RPC fallback exception', rpcErr)
          return {
            success: false,
            error: 'Impossibile approvare: UPDATE fallito e RPC errore: ' + rpcErr.message,
          }
      }
    }

    // 6. UPDATE riuscito: log e procedi con accredito wallet
    console.info('[TOPUP_APPROVE] UPDATE successful', {
      requestId,
      userId: updatedRequest.user_id,
      approvedAmount: amountToCredit,
      adminUserId: adminCheck.userId,
    })

    // 7. Accredita wallet usando RPC (no fallback manuale)
    // Smart retry per lock contention (55P03)
    const { data: txId, error: creditError } = await withConcurrencyRetry(
      async () => await supabaseAdmin.rpc('add_wallet_credit', {
        p_user_id: updatedRequest.user_id,
        p_amount: amountToCredit,
        p_description: `Approvazione richiesta ricarica #${requestId}`,
        p_created_by: adminCheck.userId,
      }),
      { operationName: 'topup_credit' }
    )

    if (creditError) {
      console.error('[TOPUP_APPROVE] RPC add_wallet_credit failed', {
        requestId,
        userId: updatedRequest.user_id,
        amount: amountToCredit,
        creditError: creditError.message,
        creditErrorCode: creditError.code,
        creditErrorDetails: creditError.details,
      })
      
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
        console.error('[TOPUP_APPROVE] Rollback failed - CRITICAL: request in inconsistent state', {
          requestId,
          rollbackError: rollbackError.message,
          rollbackErrorCode: rollbackError.code,
          rollbackErrorDetails: rollbackError.details,
        })
        // Log critico: richiesta in stato inconsistente
      } else {
        console.info('[TOPUP_APPROVE] Rollback successful', { requestId })
      }

      return {
        success: false,
        error: 'Credito non accreditato, richiesta ripristinata.',
      }
    }

    console.info('[TOPUP_APPROVE] Wallet credit successful', {
      requestId,
      transactionId: txId,
      userId: updatedRequest.user_id,
      amount: amountToCredit,
    })

    // 8. Audit log (non bloccante)
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
      console.info('[TOPUP_APPROVE] Audit log inserted', { requestId })
    } catch (auditError) {
      console.warn('[TOPUP_APPROVE] Audit log failed (non-blocking)', {
        requestId,
        auditError: auditError instanceof Error ? auditError.message : 'Unknown error',
      })
    }

    return {
      success: true,
      message: `Richiesta approvata. Credito di €${amountToCredit} accreditato.`,
      transactionId: txId,
    }
  } catch (error: any) {
    console.error('[TOPUP_APPROVE] Unexpected error', {
      requestId,
      error: error.message,
      errorStack: error.stack,
    })
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

/**
 * Server Action: Elimina una richiesta top_up_requests
 * 
 * ⚠️ ATTENZIONE: Solo per richieste pending/manual_review non ancora processate
 * 
 * @param requestId - ID della richiesta da eliminare
 * @returns Risultato operazione
 */
export async function deleteTopUpRequest(
  requestId: string
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
        error: 'Solo gli Admin possono eliminare richieste di ricarica.',
      }
    }

    // 2. Recupera richiesta per verificare status
    const { data: request, error: requestError } = await supabaseAdmin
      .from('top_up_requests')
      .select('id, status, user_id, amount')
      .eq('id', requestId)
      .maybeSingle()

    if (requestError || !request) {
      return {
        success: false,
        error: 'Richiesta non trovata.',
      }
    }

    // 3. Verifica che sia cancellabile (solo pending o manual_review)
    if (request.status !== 'pending' && request.status !== 'manual_review') {
      return {
        success: false,
        error: `Impossibile eliminare una richiesta già processata (status: ${request.status}).`,
      }
    }

    // 4. Elimina richiesta (hard delete)
    const { error: deleteError } = await supabaseAdmin
      .from('top_up_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('Errore cancellazione richiesta:', deleteError)
      return {
        success: false,
        error: deleteError.message || 'Errore durante la cancellazione della richiesta.',
      }
    }

    // 5. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_deleted',
        resource_type: 'top_up_request',
        resource_id: requestId,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {
          request_amount: request.amount,
          request_status: request.status,
          target_user_id: request.user_id,
        }
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: 'Richiesta eliminata con successo.',
    }
  } catch (error: any) {
    console.error('Errore in deleteTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante la cancellazione.',
    }
  }
}
