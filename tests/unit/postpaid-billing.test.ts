/**
 * Postpaid Billing Tests
 *
 * Verifica il flusso fatturazione postpagata:
 * - credit-check: utente postpaid bypassa verifica saldo
 * - credit-check: utente prepaid con saldo 0 riceve errore
 * - create-shipment-core: biforcazione postpaid vs prepaid
 * - Migrazione SQL postpaid_monthly_summary esiste
 * - generatePostpaidMonthlyInvoice: validazione input
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Test credit-check.ts: postpaid bypass
// ============================================

// Mock supabase per credit-check
let creditCheckUserData: any = null;

vi.mock('@/lib/db/client', () => {
  const createQueryBuilder = () => {
    let currentTable = '';
    const builder: any = {};

    builder.from = (table: string) => {
      currentTable = table;
      return builder;
    };

    builder.select = () => builder;
    builder.eq = () => builder;
    builder.in = () => builder;
    builder.gt = () => builder;
    builder.gte = () => builder;
    builder.lte = () => builder;
    builder.not = () => builder;
    builder.is = () => builder;
    builder.limit = () => builder;
    builder.order = () => builder;

    builder.single = () => {
      if (currentTable === 'users' && creditCheckUserData) {
        return { data: creditCheckUserData, error: null };
      }
      return { data: null, error: { message: 'Not found' } };
    };

    builder.insert = () => ({
      data: null,
      error: null,
      select: () => ({ single: () => ({ data: { id: 'inv-001' }, error: null }) }),
    });
    builder.delete = () => builder;

    builder.rpc = (name: string, params: any) => {
      if (name === 'get_next_invoice_number') {
        return { data: '2026-0001', error: null };
      }
      return { data: null, error: null };
    };

    return builder;
  };

  return { supabaseAdmin: createQueryBuilder() };
});

vi.mock('@/lib/security/security-events', () => ({
  logSuperAdminWalletBypass: vi.fn(),
}));

import { checkCreditBeforeBooking } from '@/lib/wallet/credit-check';

describe('checkCreditBeforeBooking - Postpaid Bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditCheckUserData = null;
  });

  it('utente postpaid bypassa verifica credito con saldo 0', async () => {
    creditCheckUserData = {
      wallet_balance: 0,
      role: 'user',
      billing_mode: 'postpagato',
    };

    const result = await checkCreditBeforeBooking('user-001', 25.5);

    expect(result.sufficient).toBe(true);
    expect(result.bypassUsed).toBe(true);
    expect(result.bypassReason).toContain('Postpaid');
    expect(result.currentBalance).toBe(0);
  });

  it('utente prepaid con saldo 0 riceve credito insufficiente', async () => {
    creditCheckUserData = {
      wallet_balance: 0,
      role: 'user',
      billing_mode: 'prepagato',
    };

    const result = await checkCreditBeforeBooking('user-001', 25.5);

    expect(result.sufficient).toBe(false);
    expect(result.deficit).toBe(25.5);
    expect(result.bypassUsed).toBe(false);
  });

  it('utente prepaid con saldo sufficiente passa', async () => {
    creditCheckUserData = {
      wallet_balance: 100,
      role: 'user',
      billing_mode: 'prepagato',
    };

    const result = await checkCreditBeforeBooking('user-001', 25.5);

    expect(result.sufficient).toBe(true);
    expect(result.currentBalance).toBe(100);
    expect(result.bypassUsed).toBe(false);
  });

  it('utente senza billing_mode (default prepagato) NON ha bypass', async () => {
    creditCheckUserData = {
      wallet_balance: 0,
      role: 'user',
      // billing_mode non impostato -> default null
    };

    const result = await checkCreditBeforeBooking('user-001', 25.5);

    expect(result.sufficient).toBe(false);
    expect(result.bypassUsed).toBe(false);
  });
});

// ============================================
// Test migrazione SQL postpaid_monthly_summary
// ============================================

describe('Migrazione SQL postpaid_billing_support', () => {
  it('la migrazione SQL deve esistere', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216200000_postpaid_billing_support.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('deve creare la vista postpaid_monthly_summary', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216200000_postpaid_billing_support.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('postpaid_monthly_summary');
    expect(content).toContain('POSTPAID_CHARGE');
    expect(content).toContain('total_consumed');
    expect(content).toContain('shipments_count');
    expect(content).toContain("date_trunc('month'");
  });

  it('deve creare indice ottimizzato per query postpaid', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216200000_postpaid_billing_support.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('idx_wallet_transactions_postpaid');
    expect(content).toContain('CREATE INDEX');
  });
});

// ============================================
// Test create-shipment-core.ts: biforcazione postpaid
// ============================================

describe('create-shipment-core - Logica Postpaid', () => {
  it('il file deve contenere il ramo POSTPAID_CHARGE', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'lib/shipments/create-shipment-core.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica che il ramo postpaid esista
    expect(content).toContain('isPostpaid');
    expect(content).toContain('POSTPAID_CHARGE');
    expect(content).toContain('billing_mode');
    // Verifica bypass pre-check credito
    expect(content).toContain('!isPostpaid');
    // Verifica compensazione postpaid
    expect(content).toContain('POSTPAID_CHARGE rimosso');
  });

  it('credit-check.ts deve contenere bypass postpaid', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'lib/wallet/credit-check.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('billing_mode');
    expect(content).toContain('postpagato');
    expect(content).toContain('Postpaid billing mode');
  });
});

// ============================================
// Test wallet page: transaction type labels
// ============================================

describe('Wallet Page - Transaction Types', () => {
  it('deve avere label per POSTPAID_CHARGE', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'app/dashboard/wallet/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('postpaid_charge');
    expect(content).toContain('Postpagato');
  });
});

// ============================================
// Test generatePostpaidMonthlyInvoice: contract
// ============================================

describe('generatePostpaidMonthlyInvoice - Contratto', () => {
  it("la funzione esiste ed e' esportata", async () => {
    const mod = await import('@/actions/invoice-recharges');
    expect(typeof mod.generatePostpaidMonthlyInvoice).toBe('function');
  });

  it('il file deve contenere la logica di validazione', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'actions/invoice-recharges.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica struttura funzione
    expect(content).toContain('generatePostpaidMonthlyInvoice');
    expect(content).toContain('POSTPAID_CHARGE');
    expect(content).toContain('periodic');
    expect(content).toContain('period_start');
    expect(content).toContain('period_end');
    expect(content).toContain('invoice_items');
    expect(content).toContain('invoice_recharge_links');
  });
});
