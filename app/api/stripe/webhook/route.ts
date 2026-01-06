/**
 * Stripe Webhook Handler
 *
 * Gestisce eventi Stripe per confermare pagamenti e accreditare wallet.
 *
 * SECURITY:
 * - Verifica firma webhook in ogni richiesta
 * - Idempotency: evita doppi accrediti
 * - Audit log completo
 *
 * EVENTI GESTITI:
 * - checkout.session.completed → Approva transazione, accredita wallet
 * - payment_intent.succeeded → Conferma pagamento
 * - payment_intent.payment_failed → Notifica errore
 */

import { supabaseAdmin } from "@/lib/db/client";
import {
  getPaymentTransaction,
  stripe,
  updatePaymentTransaction,
} from "@/lib/payments/stripe";
import { withConcurrencyRetry } from "@/lib/wallet/retry";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stripe/webhook
 *
 * Webhook endpoint per eventi Stripe
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ [STRIPE WEBHOOK] Missing signature");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ [STRIPE WEBHOOK] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event;
  try {
    // Verifica firma webhook (CRITICAL per sicurezza)
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("❌ [STRIPE WEBHOOK] Invalid signature:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`📥 [STRIPE WEBHOOK] Received event: ${event.type}`);

  try {
    // Gestisci eventi
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as any);
        break;
      }
      case "payment_intent.succeeded": {
        await handlePaymentIntentSucceeded(event.data.object as any);
        break;
      }
      case "payment_intent.payment_failed": {
        await handlePaymentIntentFailed(event.data.object as any);
        break;
      }
      default:
        console.log(`ℹ️ [STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("❌ [STRIPE WEBHOOK] Error processing event:", error);
    // Ritorna 200 per evitare retry infiniti di Stripe
    // Loggiamo l'errore per investigazione manuale
    return NextResponse.json(
      { error: "Error processing webhook", details: error.message },
      { status: 200 }
    );
  }
}

/**
 * Gestisce checkout.session.completed
 *
 * Quando l'utente completa il pagamento su Stripe Checkout
 */
async function handleCheckoutSessionCompleted(session: any) {
  const transactionId = session.client_reference_id;

  if (!transactionId) {
    console.error("❌ [STRIPE WEBHOOK] Missing client_reference_id in session");
    return;
  }

  // Log strutturato senza PII
  console.log(
    JSON.stringify({
      event: "stripe_checkout_completed",
      transaction_id: transactionId,
      timestamp: new Date().toISOString(),
    })
  );

  // 1. Recupera transazione
  const tx = await getPaymentTransaction(transactionId);

  // 2. Idempotency: verifica se già processato
  if (tx.status !== "pending") {
    console.log(
      `ℹ️ [STRIPE WEBHOOK] Transaction ${transactionId} already processed (status: ${tx.status})`
    );
    return; // Già processato, ignora
  }

  // 3. Verifica che il pagamento sia stato completato
  if (session.payment_status !== "paid") {
    console.warn(
      `⚠️ [STRIPE WEBHOOK] Session ${session.id} not paid (status: ${session.payment_status})`
    );
    await updatePaymentTransaction(transactionId, {
      status: "failed",
      provider_tx_id: session.payment_intent,
      metadata: {
        payment_status: session.payment_status,
        reason: "Payment not completed",
      },
    });
    return;
  }

  // 4. Accredita wallet usando RPC (con retry per lock contention)
  const userId = session.metadata?.user_id || tx.user_id;
  const amountCredit = parseFloat(
    session.metadata?.amount_credit || tx.amount_credit.toString()
  );

  // Log strutturato con userId hashato (GDPR compliance)
  const userIdHash = userId ? userId.substring(0, 8) + "***" : "unknown";
  console.log(
    JSON.stringify({
      event: "stripe_wallet_credit",
      user_id_hash: userIdHash,
      amount: amountCredit,
      transaction_id: transactionId,
      timestamp: new Date().toISOString(),
    })
  );

  const { data: txId, error: creditError } = await withConcurrencyRetry(
    async () =>
      await supabaseAdmin.rpc("add_wallet_credit", {
        p_user_id: userId,
        p_amount: amountCredit,
        p_description: `Ricarica Stripe #${transactionId}`,
        p_created_by: null, // System operation
      }),
    { operationName: "stripe_webhook_credit" }
  );

  if (creditError) {
    console.error("❌ [STRIPE WEBHOOK] Wallet credit failed:", creditError);
    // Aggiorna transazione come failed
    await updatePaymentTransaction(transactionId, {
      status: "failed",
      provider_tx_id: session.payment_intent,
      metadata: {
        error: creditError.message,
        credit_failed: true,
      },
    });
    throw new Error(`Wallet credit failed: ${creditError.message}`);
  }

  // 5. Aggiorna transazione come success
  await updatePaymentTransaction(transactionId, {
    status: "success",
    provider_tx_id: session.payment_intent,
    metadata: {
      session_id: session.id,
      payment_intent: session.payment_intent,
      wallet_transaction_id: txId,
    },
  });

  // 6. Audit log (non bloccante)
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: "stripe_payment_completed",
      resource_type: "payment_transaction",
      resource_id: transactionId,
      user_email: session.customer_email || "unknown",
      user_id: userId,
      metadata: {
        amount_credit: amountCredit,
        amount_fee: tx.amount_fee,
        amount_total: tx.amount_total,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        wallet_transaction_id: txId,
      },
    });
  } catch (auditError) {
    console.warn(
      "⚠️ [STRIPE WEBHOOK] Audit log failed (non-blocking):",
      auditError
    );
  }

  console.log(
    JSON.stringify({
      event: "stripe_transaction_success",
      transaction_id: transactionId,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Gestisce payment_intent.succeeded
 *
 * Backup handler se checkout.session.completed non viene chiamato
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const transactionId = paymentIntent.metadata?.transaction_id;

  if (!transactionId) {
    console.warn(
      "⚠️ [STRIPE WEBHOOK] PaymentIntent succeeded but no transaction_id in metadata"
    );
    return;
  }

  console.log(
    `✅ [STRIPE WEBHOOK] PaymentIntent succeeded for transaction: ${transactionId}`
  );

  // Verifica se già processato da checkout.session.completed
  const tx = await getPaymentTransaction(transactionId);

  if (tx.status === "success") {
    console.log(
      `ℹ️ [STRIPE WEBHOOK] Transaction ${transactionId} already processed`
    );
    return;
  }

  // Se ancora pending, processa (backup)
  if (tx.status === "pending") {
    await handleCheckoutSessionCompleted({
      client_reference_id: transactionId,
      payment_status: "paid",
      payment_intent: paymentIntent.id,
      metadata: {
        user_id: paymentIntent.metadata?.user_id || tx.user_id,
        amount_credit:
          paymentIntent.metadata?.amount_credit || tx.amount_credit.toString(),
      },
      customer_email: paymentIntent.receipt_email,
      id: paymentIntent.id,
    });
  }
}

/**
 * Gestisce payment_intent.payment_failed
 *
 * Marca transazione come failed
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const transactionId = paymentIntent.metadata?.transaction_id;

  if (!transactionId) {
    console.warn(
      "⚠️ [STRIPE WEBHOOK] PaymentIntent failed but no transaction_id in metadata"
    );
    return;
  }

  console.log(
    `❌ [STRIPE WEBHOOK] PaymentIntent failed for transaction: ${transactionId}`
  );

  await updatePaymentTransaction(transactionId, {
    status: "failed",
    provider_tx_id: paymentIntent.id,
    metadata: {
      error: paymentIntent.last_payment_error?.message || "Payment failed",
      failure_code: paymentIntent.last_payment_error?.code,
    },
  });

  // Audit log
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: "stripe_payment_failed",
      resource_type: "payment_transaction",
      resource_id: transactionId,
      user_id: paymentIntent.metadata?.user_id,
      metadata: {
        payment_intent_id: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message,
        failure_code: paymentIntent.last_payment_error?.code,
      },
    });
  } catch (auditError) {
    console.warn(
      "⚠️ [STRIPE WEBHOOK] Audit log failed (non-blocking):",
      auditError
    );
  }
}

// Disabilita body parsing per webhook (Stripe ha bisogno del raw body)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
