/**
 * Integration Tests: Invoice Recharges System
 *
 * Testa il sistema completo di fatturazione ricariche:
 * - Generazione fattura da ricariche
 * - Collegamento ricariche → fatture
 * - Generazione PDF e XML
 *
 * @module tests/integration/invoice-recharges.integration.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '@/lib/db/client';
import { generateInvoiceFromRechargesAction } from '@/actions/invoice-recharges';

// SKIP: Questo test richiede setup DB completo con RPC generate_invoice_from_recharges
// e migrations invoice applicate. Da eseguire solo in ambiente con DB Supabase completo.
describe.skip('Invoice Recharges Integration', () => {
  let testUserId: string;
  let testTransactionIds: string[] = [];

  beforeAll(async () => {
    // Crea utente di test
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: `test-invoice-${Date.now()}@test.local`,
        name: 'Test Invoice User',
        account_type: 'user',
        wallet_balance: 0,
      })
      .select('id')
      .single();

    if (userError || !user) {
      throw new Error('Errore creazione utente test');
    }

    testUserId = user.id;

    // Crea ricariche di test
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert([
        {
          user_id: testUserId,
          amount: 100.0,
          type: 'deposit',
          description: 'Ricarica test 1',
        },
        {
          user_id: testUserId,
          amount: 50.0,
          type: 'deposit',
          description: 'Ricarica test 2',
        },
      ])
      .select('id');

    if (txError || !transactions) {
      throw new Error('Errore creazione transazioni test');
    }

    testTransactionIds = transactions.map((t) => t.id);
  });

  afterAll(async () => {
    // Cleanup: elimina fatture, links, transazioni, utente
    if (testUserId) {
      // Elimina invoice_recharge_links
      await supabaseAdmin
        .from('invoice_recharge_links')
        .delete()
        .in('wallet_transaction_id', testTransactionIds);

      // Elimina invoices
      const { data: invoices } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('user_id', testUserId);

      if (invoices) {
        for (const invoice of invoices) {
          await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', invoice.id);
        }

        await supabaseAdmin.from('invoices').delete().eq('user_id', testUserId);
      }

      // Elimina transazioni
      await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', testUserId);

      // Elimina utente
      await supabaseAdmin.from('users').delete().eq('id', testUserId);
    }
  });

  describe('generateInvoiceFromRechargesAction', () => {
    it('dovrebbe generare fattura da ricariche', async () => {
      // NOTA: Questo test richiede autenticazione admin
      // In ambiente test, potrebbe essere necessario mockare requireSafeAuth

      // Per ora, testiamo solo la logica SQL
      const { data: invoiceId, error } = await supabaseAdmin.rpc(
        'generate_invoice_from_recharges',
        {
          p_user_id: testUserId,
          p_transaction_ids: testTransactionIds,
          p_invoice_type: 'recharge',
          p_period_start: null,
          p_period_end: null,
          p_notes: 'Test fattura ricariche',
        }
      );

      expect(error).toBeNull();
      expect(invoiceId).toBeDefined();

      // Verifica fattura creata
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      expect(invoice).toBeDefined();
      expect(invoice?.invoice_type).toBe('recharge');
      expect(invoice?.subtotal).toBe(150.0); // 100 + 50
      expect(invoice?.tax_amount).toBe(33.0); // 150 * 0.22
      expect(invoice?.total).toBe(183.0); // 150 + 33

      // Verifica links creati
      const { data: links } = await supabaseAdmin
        .from('invoice_recharge_links')
        .select('*')
        .eq('invoice_id', invoiceId);

      expect(links).toHaveLength(2);
      expect(links?.map((l) => l.wallet_transaction_id).sort()).toEqual(testTransactionIds.sort());
    });

    it('dovrebbe prevenire doppia fatturazione della stessa ricarica', async () => {
      // Tenta di fatturare ricariche già fatturate
      const { error } = await supabaseAdmin.rpc('generate_invoice_from_recharges', {
        p_user_id: testUserId,
        p_transaction_ids: testTransactionIds,
        p_invoice_type: 'recharge',
        p_period_start: null,
        p_period_end: null,
        p_notes: null,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('già fatturate');
    });
  });

  describe('Database Constraints', () => {
    it('dovrebbe rispettare unicità ricarica → fattura', async () => {
      // Crea nuova ricarica
      const { data: newTx } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: testUserId,
          amount: 25.0,
          type: 'deposit',
          description: 'Ricarica test unicità',
        })
        .select('id')
        .single();

      if (!newTx) {
        throw new Error('Errore creazione transazione test');
      }

      // Crea prima fattura
      const { data: invoiceId1 } = await supabaseAdmin.rpc('generate_invoice_from_recharges', {
        p_user_id: testUserId,
        p_transaction_ids: [newTx.id],
        p_invoice_type: 'recharge',
        p_period_start: null,
        p_period_end: null,
        p_notes: null,
      });

      expect(invoiceId1).toBeDefined();

      // Tenta di creare seconda fattura con stessa ricarica
      const { error } = await supabaseAdmin.rpc('generate_invoice_from_recharges', {
        p_user_id: testUserId,
        p_transaction_ids: [newTx.id],
        p_invoice_type: 'recharge',
        p_period_start: null,
        p_period_end: null,
        p_notes: null,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('già fatturate');

      // Cleanup
      await supabaseAdmin
        .from('invoice_recharge_links')
        .delete()
        .eq('wallet_transaction_id', newTx.id);

      await supabaseAdmin.from('invoices').delete().eq('id', invoiceId1);

      await supabaseAdmin.from('wallet_transactions').delete().eq('id', newTx.id);
    });
  });
});
