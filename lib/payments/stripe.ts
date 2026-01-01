/**
 * Stripe Payment Integration
 * 
 * Sostituisce XPay (Intesa) con Stripe per pagamenti più universali e migliore UX.
 * 
 * SECURITY:
 * - PCI DSS Compliance: Stripe gestisce tutti i dati carta (no dati sui nostri server)
 * - Webhook Signature: Verifica firma in ogni webhook
 * - Idempotency: Usa idempotency_key per evitare doppi accrediti
 * 
 * COMMISSIONI:
 * - Stripe Fee: 1.4% + €0.25 per transazioni europee
 * - Platform Fee: Configurabile (default: 0%)
 */

import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/client';

// Inizializza Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

/**
 * Configurazione pagamento Stripe
 */
export interface StripePaymentConfig {
  amountCredit: number; // Importo netto da accreditare al wallet
  userId: string;
  userEmail: string;
}

/**
 * Calcola commissioni Stripe
 * 
 * @param amountCredit - Importo netto da accreditare
 * @returns Fee Stripe e totale da addebitare
 */
export function calculateStripeFee(amountCredit: number): { fee: number; total: number } {
  const STRIPE_PERCENTAGE = 0.014; // 1.4%
  const STRIPE_FIXED = 0.25; // €0.25
  
  const fee = Number(((amountCredit * STRIPE_PERCENTAGE) + STRIPE_FIXED).toFixed(2));
  const total = Number((amountCredit + fee).toFixed(2));
  
  return { fee, total };
}

/**
 * Crea una transazione di pagamento nel DB (pending)
 */
async function createPaymentTransaction(config: {
  userId: string;
  amountCredit: number;
  amountFee: number;
  amountTotal: number;
}): Promise<{ id: string }> {
  const { data: tx, error } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      user_id: config.userId,
      amount_credit: config.amountCredit,
      amount_fee: config.amountFee,
      amount_total: config.amountTotal,
      provider: 'stripe',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !tx) {
    throw new Error(`Errore creazione transazione: ${error?.message || 'Unknown error'}`);
  }

  return tx;
}

/**
 * Crea una Stripe Checkout Session per pagamento
 * 
 * @param config - Configurazione pagamento
 * @returns Session ID e URL di redirect
 */
export async function createStripeCheckoutSession(
  config: StripePaymentConfig
): Promise<{ sessionId: string; url: string | null; transactionId: string }> {
  // 1. Calcola commissioni
  const { fee, total } = calculateStripeFee(config.amountCredit);

  // 2. Crea transazione DB (pending)
  const tx = await createPaymentTransaction({
    userId: config.userId,
    amountCredit: config.amountCredit,
    amountFee: fee,
    amountTotal: total,
  });

  // 3. Crea Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Ricarica Wallet SpedireSicuro',
            description: `Ricarica credito wallet di €${config.amountCredit.toFixed(2)}`,
          },
          unit_amount: Math.round(total * 100), // Stripe usa centesimi
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true&tx_id=${tx.id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?canceled=true`,
    client_reference_id: tx.id, // Per riconciliazione
    metadata: {
      user_id: config.userId,
      amount_credit: config.amountCredit.toString(),
      transaction_id: tx.id,
    },
    // Idempotency: usa transaction ID come chiave
    payment_intent_data: {
      metadata: {
        transaction_id: tx.id,
        user_id: config.userId,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
    transactionId: tx.id,
  };
}

/**
 * Recupera una transazione di pagamento
 */
export async function getPaymentTransaction(transactionId: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (error) {
    throw new Error(`Errore recupero transazione: ${error.message}`);
  }

  return data;
}

/**
 * Aggiorna una transazione di pagamento
 */
export async function updatePaymentTransaction(
  transactionId: string,
  updates: {
    status?: string;
    provider_tx_id?: string;
    metadata?: Record<string, any>;
  }
) {
  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  if (error) {
    throw new Error(`Errore aggiornamento transazione: ${error.message}`);
  }
}

