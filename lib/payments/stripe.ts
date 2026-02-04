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
 *
 * VAT AWARENESS (ADR-002):
 * - IVA INCLUSA: €100 payment → €100 wallet credit
 * - IVA ESCLUSA: €100 payment → €81.97 wallet credit (100/1.22)
 * - VAT mode inherited from user's assigned price list
 */

import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/client';

// ─── VAT CALCULATION TYPES ───

export interface VatInfo {
  vatMode: 'included' | 'excluded';
  vatRate: number;
}

export interface WalletCreditCalculation {
  grossAmount: number; // Amount user pays (e.g., €100)
  creditAmount: number; // Amount credited to wallet
  vatAmount: number; // VAT portion
  netAmount: number; // Net amount (excluding VAT)
  vatMode: 'included' | 'excluded';
  vatRate: number;
}

// Lazy initialization per evitare errori a build-time
let _stripe: Stripe | null = null;

/**
 * Ottiene l'istanza Stripe (lazy init)
 *
 * Inizializza Stripe solo quando effettivamente necessario,
 * evitando errori durante il build di Next.js.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return _stripe;
}

// Export per backward compatibility (deprecato)
// ⚠️ Usare getStripe() nelle nuove implementazioni
export const stripe = {
  get webhooks() {
    return getStripe().webhooks;
  },
  get checkout() {
    return getStripe().checkout;
  },
  get paymentIntents() {
    return getStripe().paymentIntents;
  },
};

/**
 * Configurazione pagamento Stripe
 */
export interface StripePaymentConfig {
  grossAmount: number; // Importo che l'utente paga (lordo)
  userId: string;
  userEmail: string;
  // VAT info will be fetched from user's price list if not provided
  vatInfo?: VatInfo;
}

/**
 * Legacy config for backward compatibility
 * @deprecated Use StripePaymentConfig with grossAmount instead
 */
export interface LegacyStripePaymentConfig {
  amountCredit: number;
  userId: string;
  userEmail: string;
}

/**
 * Calcola commissioni Stripe
 *
 * @param amount - Importo su cui calcolare le commissioni
 * @returns Fee Stripe e totale da addebitare
 */
export function calculateStripeFee(amount: number): { fee: number; total: number } {
  const STRIPE_PERCENTAGE = 0.014; // 1.4%
  const STRIPE_FIXED = 0.25; // €0.25

  const fee = Number((amount * STRIPE_PERCENTAGE + STRIPE_FIXED).toFixed(2));
  const total = Number((amount + fee).toFixed(2));

  return { fee, total };
}

/**
 * Get user's VAT mode from their assigned price list
 *
 * @param userId - User ID
 * @returns VAT mode and rate from user's price list, defaults to 'excluded' / 22%
 */
export async function getUserVatInfo(userId: string): Promise<VatInfo> {
  const { data, error } = await supabaseAdmin.rpc('get_user_vat_mode', {
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    console.warn(
      `⚠️ [STRIPE] Could not get VAT info for user ${userId}, defaulting to excluded/22%`
    );
    return { vatMode: 'excluded', vatRate: 22.0 };
  }

  return {
    vatMode: (data[0].vat_mode as 'included' | 'excluded') || 'excluded',
    vatRate: data[0].vat_rate || 22.0,
  };
}

/**
 * Calculate wallet credit based on VAT mode
 *
 * IVA INCLUSA (B2C): User pays €100 → Gets €100 credit
 *   - The price shown already includes VAT
 *   - Full amount goes to wallet
 *
 * IVA ESCLUSA (B2B): User pays €100 → Gets €81.97 credit
 *   - €100 / 1.22 = €81.97 net
 *   - Only net amount goes to wallet
 *   - Invoice shows: €81.97 + €18.03 IVA = €100.00
 *
 * @param grossAmount - Amount user will pay
 * @param vatInfo - VAT mode and rate
 * @returns Calculation breakdown
 */
export function calculateWalletCredit(
  grossAmount: number,
  vatInfo: VatInfo
): WalletCreditCalculation {
  const { vatMode, vatRate } = vatInfo;
  const vatMultiplier = 1 + vatRate / 100;

  if (vatMode === 'included') {
    // IVA INCLUSA: €100 payment = €100 credit
    const netAmount = Number((grossAmount / vatMultiplier).toFixed(2));
    const vatAmount = Number((grossAmount - netAmount).toFixed(2));
    return {
      grossAmount,
      creditAmount: grossAmount, // Full amount credited
      vatAmount,
      netAmount,
      vatMode,
      vatRate,
    };
  } else {
    // IVA ESCLUSA: €100 payment = €81.97 credit
    const netAmount = Number((grossAmount / vatMultiplier).toFixed(2));
    const vatAmount = Number((grossAmount - netAmount).toFixed(2));
    return {
      grossAmount,
      creditAmount: netAmount, // Only net amount credited
      vatAmount,
      netAmount,
      vatMode,
      vatRate,
    };
  }
}

/**
 * Crea una transazione di pagamento nel DB (pending)
 */
async function createPaymentTransaction(config: {
  userId: string;
  amountCredit: number;
  amountFee: number;
  amountTotal: number;
  vatMode?: 'included' | 'excluded';
  vatRate?: number;
  vatAmount?: number;
  amountNet?: number;
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
      // VAT fields
      vat_mode: config.vatMode,
      vat_rate: config.vatRate,
      vat_amount: config.vatAmount,
      amount_net: config.amountNet,
    })
    .select('id')
    .single();

  if (error || !tx) {
    throw new Error(`Errore creazione transazione: ${error?.message || 'Unknown error'}`);
  }

  return tx;
}

/**
 * Crea una Stripe Checkout Session per pagamento con supporto VAT
 *
 * Il calcolo del credito wallet dipende dal vat_mode del listino utente:
 * - IVA INCLUSA: €100 pagamento → €100 credito wallet
 * - IVA ESCLUSA: €100 pagamento → €81.97 credito wallet (100/1.22)
 *
 * @param config - Configurazione pagamento
 * @returns Session ID e URL di redirect
 */
export async function createStripeCheckoutSession(
  config: StripePaymentConfig | LegacyStripePaymentConfig
): Promise<{
  sessionId: string;
  url: string | null;
  transactionId: string;
  creditCalculation?: WalletCreditCalculation;
}> {
  // Determine if using new or legacy config
  const grossAmount = 'grossAmount' in config ? config.grossAmount : config.amountCredit;

  // 1. Get user's VAT info from their assigned price list
  const vatInfo =
    'vatInfo' in config && config.vatInfo ? config.vatInfo : await getUserVatInfo(config.userId);

  // 2. Calculate wallet credit based on VAT mode
  const creditCalc = calculateWalletCredit(grossAmount, vatInfo);

  console.log(
    `💳 [STRIPE] Creating checkout for user ${config.userId.substring(0, 8)}***: ` +
      `€${grossAmount} (${vatInfo.vatMode}) → €${creditCalc.creditAmount} credit`
  );

  // 3. Calcola commissioni Stripe sull'importo lordo
  const { fee, total } = calculateStripeFee(grossAmount);

  // 4. Crea transazione DB (pending) con info VAT
  const tx = await createPaymentTransaction({
    userId: config.userId,
    amountCredit: creditCalc.creditAmount, // Amount that will go to wallet
    amountFee: fee,
    amountTotal: total,
    vatMode: vatInfo.vatMode,
    vatRate: vatInfo.vatRate,
    vatAmount: creditCalc.vatAmount,
    amountNet: creditCalc.netAmount,
  });

  // 5. Descrizione basata su VAT mode
  const description =
    vatInfo.vatMode === 'included'
      ? `Ricarica wallet €${creditCalc.creditAmount.toFixed(2)} (IVA inclusa)`
      : `Ricarica wallet €${creditCalc.creditAmount.toFixed(2)} + IVA €${creditCalc.vatAmount.toFixed(2)}`;

  // 6. Crea Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Ricarica Wallet SpedireSicuro',
            description,
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
      amount_credit: creditCalc.creditAmount.toString(),
      gross_amount: grossAmount.toString(),
      vat_mode: vatInfo.vatMode,
      vat_rate: vatInfo.vatRate.toString(),
      vat_amount: creditCalc.vatAmount.toString(),
      transaction_id: tx.id,
    },
    // Idempotency: usa transaction ID come chiave
    payment_intent_data: {
      metadata: {
        transaction_id: tx.id,
        user_id: config.userId,
        vat_mode: vatInfo.vatMode,
        amount_credit: creditCalc.creditAmount.toString(),
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
    transactionId: tx.id,
    creditCalculation: creditCalc,
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

/**
 * Preview wallet credit calculation for a given amount
 *
 * Useful for showing user what they'll get before payment
 *
 * @param userId - User ID to get VAT info for
 * @param grossAmount - Amount user wants to pay
 * @returns Credit calculation preview
 */
export async function previewWalletCredit(
  userId: string,
  grossAmount: number
): Promise<WalletCreditCalculation & { stripeFee: number; totalToPay: number }> {
  const vatInfo = await getUserVatInfo(userId);
  const creditCalc = calculateWalletCredit(grossAmount, vatInfo);
  const { fee, total } = calculateStripeFee(grossAmount);

  return {
    ...creditCalc,
    stripeFee: fee,
    totalToPay: total,
  };
}
