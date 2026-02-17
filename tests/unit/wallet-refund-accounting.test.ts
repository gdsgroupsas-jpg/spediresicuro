/**
 * Test Wallet Refund Accounting
 *
 * Verifica che ogni movimento wallet abbia la sua controparte contabile:
 * - SHIPMENT_CHARGE alla creazione (decrement_wallet_balance)
 * - SHIPMENT_REFUND alla cancellazione (refund_wallet_balance)
 *
 * I grandi player (Stripe, PayPal) registrano OGNI movimento.
 * Noi non siamo da meno.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leggiamo i sorgenti per verificare che le RPC corrette siano usate
const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

describe('Wallet Refund Accounting - Tracciabilita Contabile', () => {
  describe('DELETE /api/spedizioni - User cancellation', () => {
    const source = readSource('app/api/spedizioni/route.ts');

    it('usa refund_wallet_balance (non increment_wallet_balance) per rimborso', () => {
      // Nella sezione RIMBORSO WALLET deve usare refund_wallet_balance
      expect(source).toContain("'refund_wallet_balance'");
    });

    it('NON usa increment_wallet_balance per rimborso cancellazione', () => {
      // increment_wallet_balance NON deve apparire nella sezione rimborso
      // Potrebbe esistere altrove nel file, ma nella sezione cancel deve usare refund
      const cancelSection = source.split('RIMBORSO WALLET')[1];
      if (cancelSection) {
        expect(cancelSection).not.toContain("'increment_wallet_balance'");
      }
    });

    it('passa p_shipment_id per reference tracking', () => {
      expect(source).toContain('p_shipment_id');
    });

    it('passa p_description con dettagli rimborso', () => {
      expect(source).toContain('p_description: refundDescription');
    });

    it('usa idempotency key per prevenire doppi rimborsi', () => {
      expect(source).toContain('p_idempotency_key: idempotencyKey');
    });

    it('ha compensation queue come fallback se rimborso fallisce', () => {
      expect(source).toContain('compensation_queue');
    });

    it('skip rimborso per superadmin', () => {
      expect(source).toContain('ownerIsSuperadmin');
    });
  });

  describe('DELETE /api/admin/shipments - Admin cancellation', () => {
    const source = readSource('app/api/admin/shipments/[id]/route.ts');

    it('usa refund_wallet_balance (non increment_wallet_balance) per rimborso', () => {
      expect(source).toContain("'refund_wallet_balance'");
    });

    it('NON usa increment_wallet_balance per rimborso', () => {
      expect(source).not.toContain("'increment_wallet_balance'");
    });

    it('passa p_shipment_id per reference tracking', () => {
      expect(source).toContain('p_shipment_id');
    });

    it('include admin email nella descrizione', () => {
      expect(source).toContain('context.actor.email');
    });
  });

  describe('create-shipment-core.ts - Compensazione errore corriere', () => {
    const source = readSource('lib/shipments/create-shipment-core.ts');

    it('usa refund_wallet_balance_v2 per compensazione (non increment_wallet_balance)', () => {
      // Verifica che nella sezione compensazione si usi refund_wallet_balance_v2
      expect(source).toContain("'refund_wallet_balance_v2'");
    });

    it('NON usa increment_wallet_balance per compensazione', () => {
      // increment_wallet_balance non deve essere usato per refund
      expect(source).not.toContain("'increment_wallet_balance'");
    });

    it('ha description per compensazione automatica', () => {
      expect(source).toContain('Rimborso automatico: errore creazione etichetta corriere');
    });
  });

  describe('Migration SQL - refund_wallet_balance function', () => {
    const migration = readSource('supabase/migrations/20260206100000_wallet_refund_function.sql');

    it('crea funzione refund_wallet_balance', () => {
      expect(migration).toContain('CREATE OR REPLACE FUNCTION refund_wallet_balance');
    });

    it('usa tipo SHIPMENT_REFUND (non DEPOSIT)', () => {
      expect(migration).toContain("'SHIPMENT_REFUND'");
    });

    it('ha idempotency check', () => {
      expect(migration).toContain('IDEMPOTENCY CHECK');
      expect(migration).toContain('idempotent_replay');
    });

    it('ha lock pessimistico', () => {
      expect(migration).toContain('FOR UPDATE NOWAIT');
    });

    it('registra reference_id (shipment_id)', () => {
      expect(migration).toContain('reference_id');
      expect(migration).toContain('p_shipment_id');
    });

    it('registra reference_type', () => {
      expect(migration).toContain("'shipment_cancellation'");
    });

    it('importo e sempre positivo (e un accredito)', () => {
      expect(migration).toContain('p_amount,  -- Positivo: e un accredito');
    });
  });

  describe('Coerenza contabile: charge e refund sono simmetrici', () => {
    const debitMigration = readSource(
      'supabase/migrations/20260125180000_wallet_idempotency_standalone.sql'
    );
    const refundMigration = readSource(
      'supabase/migrations/20260206100000_wallet_refund_function.sql'
    );

    it('decrement usa SHIPMENT_CHARGE, refund usa SHIPMENT_REFUND', () => {
      // decrement_wallet_balance scrive SHIPMENT_CHARGE
      expect(debitMigration).toContain("'SHIPMENT_CHARGE'");
      // refund_wallet_balance scrive SHIPMENT_REFUND
      expect(refundMigration).toContain("'SHIPMENT_REFUND'");
    });

    it('entrambi supportano idempotency_key', () => {
      expect(debitMigration).toContain('p_idempotency_key');
      expect(refundMigration).toContain('p_idempotency_key');
    });

    it('entrambi usano lock pessimistico', () => {
      expect(debitMigration).toContain('FOR UPDATE NOWAIT');
      expect(refundMigration).toContain('FOR UPDATE NOWAIT');
    });

    it('entrambi ritornano JSONB con transaction_id', () => {
      expect(debitMigration).toContain("'transaction_id'");
      expect(refundMigration).toContain("'transaction_id'");
    });
  });
});
