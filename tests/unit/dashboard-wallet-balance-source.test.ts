/**
 * Test Dashboard Wallet Balance Source
 *
 * Verifica che il dashboard usi users.wallet_balance (source of truth)
 * e NON workspaces.wallet_balance (snapshot statico) per il banner saldo.
 *
 * Problema originale: le RPC wallet scrivono su users.wallet_balance,
 * ma il dashboard leggeva da workspaces.wallet_balance (mai aggiornato).
 * Risultato: "Saldo esaurito" anche con credito reale.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

describe('Dashboard Wallet Balance - Source of Truth', () => {
  const source = readSource('app/dashboard/page.tsx');

  it('ha variabile walletBalance derivata da user.wallet_balance', () => {
    expect(source).toContain('user?.wallet_balance');
  });

  it('walletBalance ha fallback a workspace.wallet_balance', () => {
    expect(source).toContain('user?.wallet_balance ?? workspace?.wallet_balance ?? 0');
  });

  it('NON usa workspace.wallet_balance direttamente nel banner saldo', () => {
    // Estrai la sezione tra "Wallet depletion warning" e "Main Content"
    const bannerStart = source.indexOf('Wallet depletion warning');
    const bannerEnd = source.indexOf('Main Content', bannerStart);

    if (bannerStart !== -1 && bannerEnd !== -1) {
      const bannerSection = source.slice(bannerStart, bannerEnd);
      expect(bannerSection).not.toContain('workspace.wallet_balance');
    }
  });

  it('usa walletBalance (derivato) per la condizione del banner', () => {
    const bannerStart = source.indexOf('Wallet depletion warning');
    const bannerEnd = source.indexOf('Main Content', bannerStart);

    if (bannerStart !== -1 && bannerEnd !== -1) {
      const bannerSection = source.slice(bannerStart, bannerEnd);
      expect(bannerSection).toContain('walletBalance < 10');
      expect(bannerSection).toContain('walletBalance <= 0');
    }
  });

  it('NON usa workspace.wallet_balance nel display saldo header', () => {
    // Sezione "Saldo" nell'header (tra "Saldo wallet" e "Wallet depletion")
    const saldoStart = source.indexOf('Saldo wallet');
    const saldoEnd = source.indexOf('Wallet depletion warning', saldoStart);

    if (saldoStart !== -1 && saldoEnd !== -1) {
      const saldoSection = source.slice(saldoStart, saldoEnd);
      expect(saldoSection).not.toContain('workspace.wallet_balance');
      expect(saldoSection).toContain('walletBalance');
    }
  });
});

describe('Coerenza: credit-check usa stessa source del dashboard', () => {
  const creditCheck = readSource('lib/wallet/credit-check.ts');
  const dashboardSource = readSource('app/dashboard/page.tsx');

  it('credit-check legge da users table (non workspaces)', () => {
    // credit-check.ts fa query su users table
    expect(creditCheck).toContain(".from('users')");
    expect(creditCheck).toContain('wallet_balance');
  });

  it('dashboard usa user.wallet_balance come source primaria (allineato a credit-check)', () => {
    // Entrambi leggono da users.wallet_balance
    expect(dashboardSource).toContain('user?.wallet_balance');
  });

  it('QuickModeForm usa stessa source (user.wallet_balance)', () => {
    const quickMode = readSource('app/dashboard/spedizioni/nuova/QuickModeForm.tsx');
    expect(quickMode).toContain('user?.wallet_balance');
  });
});
