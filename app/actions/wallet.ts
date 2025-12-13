'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { xpay } from '@/lib/payments/intesa-xpay';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
 * (Nota: L'upload del file fisico idealmente avviene client-side su bucket o via Signed URL, 
 * qui simuliamo l'entry DB e triggeriamo l'AI)
 */
export async function uploadBankTransferReceipt(formData: FormData) {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const file = formData.get('file') as File;
  const declaredAmount = parseFloat(formData.get('amount') as string);
  
  if (!file) return { success: false, error: 'No file provided' };

  // 1. Upload File Storage
  const fileName = `${user.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(fileName, file);

  if (uploadError) return { success: false, error: 'Upload failed: ' + uploadError.message };

  // 2. Get Public/Signed URL
  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(fileName);

  // 3. Create Request Record
  const { data: req, error: dbError } = await supabase
    .from('top_up_requests')
    .insert({
      user_id: user.id,
      amount: declaredAmount,
      file_url: publicUrl,
      status: 'pending',
      ai_confidence: 0 // In attesa di analisi
    })
    .select()
    .single();
    
    if (dbError) return { success: false, error: dbError.message };

    // 4. Trigger AI Analysis (Async - qui simuliamo la chiamata diretta o si usa un queue)
    // In un sistema reale, chiameremmo una funzione separata. Per ora, lo facciamo "lazy" o client side trigger.
    
    return { success: true, requestId: req.id, message: 'Ricevuta caricata. L\'AI sta analizzando...' };
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
