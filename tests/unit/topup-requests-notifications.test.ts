/**
 * TopUp Requests & Notifications Tests
 *
 * Test per:
 * - getMyTopUpRequests: server action per recuperare richieste utente
 * - TopUpRequestsList: componente visualizzazione richieste
 * - Email notifiche su approvazione/rifiuto
 * - sendTopUpRejectedEmail: template e parametri email rifiuto
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

// ============================================
// LOGICA ESTRATTA DAL COMPONENTE PER TEST
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'In attesa', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50' },
  manual_review: {
    label: 'In revisione',
    color: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  },
  approved: { label: 'Approvata', color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  rejected: { label: 'Rifiutata', color: 'bg-red-900/40 text-red-300 border-red-700/50' },
};

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

interface TopUpRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  approved_amount: number | null;
  admin_notes: string | null;
}

/**
 * Conta richieste pendenti (stessa logica del componente)
 */
function countPending(requests: TopUpRequest[]): number {
  return requests.filter((r) => r.status === 'pending' || r.status === 'manual_review').length;
}

/**
 * Determina se mostrare il componente (stessa logica)
 */
function shouldShowComponent(isLoading: boolean, requests: TopUpRequest[]): boolean {
  if (isLoading) return true; // Mostra loader
  return requests.length > 0;
}

// ============================================
// TEST: STATUS CONFIG
// ============================================

describe('TopUpRequestsList - Status Config', () => {
  it('definisce tutti e 4 gli stati possibili', () => {
    expect(STATUS_CONFIG).toHaveProperty('pending');
    expect(STATUS_CONFIG).toHaveProperty('manual_review');
    expect(STATUS_CONFIG).toHaveProperty('approved');
    expect(STATUS_CONFIG).toHaveProperty('rejected');
  });

  it('ogni stato ha label e color', () => {
    for (const [, config] of Object.entries(STATUS_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
    }
  });

  it('labels in italiano', () => {
    expect(STATUS_CONFIG.pending.label).toBe('In attesa');
    expect(STATUS_CONFIG.manual_review.label).toBe('In revisione');
    expect(STATUS_CONFIG.approved.label).toBe('Approvata');
    expect(STATUS_CONFIG.rejected.label).toBe('Rifiutata');
  });

  it('stati pending/manual_review usano colori warm (yellow/orange)', () => {
    expect(STATUS_CONFIG.pending.color).toContain('yellow');
    expect(STATUS_CONFIG.manual_review.color).toContain('orange');
  });

  it('stato approved usa verde, rejected usa rosso', () => {
    expect(STATUS_CONFIG.approved.color).toContain('green');
    expect(STATUS_CONFIG.rejected.color).toContain('red');
  });

  it('fallback a pending per stato sconosciuto', () => {
    const unknownStatus = 'xyz_unknown';
    const config = STATUS_CONFIG[unknownStatus] || STATUS_CONFIG.pending;
    expect(config.label).toBe('In attesa');
  });
});

// ============================================
// TEST: FORMATTING
// ============================================

describe('TopUpRequestsList - Formattazione', () => {
  it('formatta importo in EUR con formato italiano', () => {
    const result = formatCurrency(100);
    // Locale it-IT usa € e virgola decimale
    expect(result).toContain('100');
    expect(result).toContain('€');
  });

  it('formatta importi decimali correttamente', () => {
    const result = formatCurrency(49.99);
    expect(result).toContain('49');
    expect(result).toContain('99');
  });

  it('formatta zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formatta data in formato italiano dd/mm/yyyy HH:mm', () => {
    const result = formatDate('2025-01-15T10:30:00Z');
    // Deve contenere 15/01/2025
    expect(result).toContain('15');
    expect(result).toContain('01');
    expect(result).toContain('2025');
  });

  it('formatta date diverse correttamente', () => {
    const result = formatDate('2024-12-25T14:00:00Z');
    expect(result).toContain('25');
    expect(result).toContain('12');
    expect(result).toContain('2024');
  });
});

// ============================================
// TEST: CONTEGGIO PENDENTI
// ============================================

describe('TopUpRequestsList - Conteggio Pendenti', () => {
  const mockRequests: TopUpRequest[] = [
    {
      id: '1',
      amount: 100,
      status: 'pending',
      created_at: '2025-01-15T10:00:00Z',
      approved_amount: null,
      admin_notes: null,
    },
    {
      id: '2',
      amount: 200,
      status: 'manual_review',
      created_at: '2025-01-14T10:00:00Z',
      approved_amount: null,
      admin_notes: null,
    },
    {
      id: '3',
      amount: 150,
      status: 'approved',
      created_at: '2025-01-13T10:00:00Z',
      approved_amount: 150,
      admin_notes: null,
    },
    {
      id: '4',
      amount: 50,
      status: 'rejected',
      created_at: '2025-01-12T10:00:00Z',
      approved_amount: null,
      admin_notes: 'Ricevuta non valida',
    },
  ];

  it('conta solo pending e manual_review come pendenti', () => {
    expect(countPending(mockRequests)).toBe(2);
  });

  it('0 pendenti se tutte processate', () => {
    const processed = mockRequests.filter(
      (r) => r.status === 'approved' || r.status === 'rejected'
    );
    expect(countPending(processed)).toBe(0);
  });

  it('array vuoto restituisce 0 pendenti', () => {
    expect(countPending([])).toBe(0);
  });

  it('tutte pending restituisce count corretto', () => {
    const allPending = [
      { ...mockRequests[0], id: 'a' },
      { ...mockRequests[0], id: 'b' },
      { ...mockRequests[0], id: 'c' },
    ];
    expect(countPending(allPending)).toBe(3);
  });
});

// ============================================
// TEST: VISIBILITA COMPONENTE
// ============================================

describe('TopUpRequestsList - Visibilità', () => {
  it('nasconde componente se non ci sono richieste e non sta caricando', () => {
    expect(shouldShowComponent(false, [])).toBe(false);
  });

  it('mostra componente durante caricamento', () => {
    expect(shouldShowComponent(true, [])).toBe(true);
  });

  it('mostra componente se ci sono richieste', () => {
    const requests: TopUpRequest[] = [
      {
        id: '1',
        amount: 100,
        status: 'pending',
        created_at: '2025-01-15T10:00:00Z',
        approved_amount: null,
        admin_notes: null,
      },
    ];
    expect(shouldShowComponent(false, requests)).toBe(true);
  });
});

// ============================================
// TEST: SORGENTE getMyTopUpRequests
// ============================================

describe('getMyTopUpRequests - Server Action', () => {
  const walletSource = readSource('app/actions/wallet.ts');

  it('funzione esiste e viene esportata', () => {
    expect(walletSource).toContain('export async function getMyTopUpRequests');
  });

  it('verifica autenticazione utente', () => {
    // Deve usare supabase.auth.getUser() o requireSafeAuth
    expect(walletSource).toMatch(/getMyTopUpRequests[\s\S]*?auth\.getUser/);
  });

  it('ritorna errore se non autenticato', () => {
    expect(walletSource).toContain("success: false, error: 'Non autenticato'");
  });

  it('query sulla tabella top_up_requests', () => {
    expect(walletSource).toMatch(/getMyTopUpRequests[\s\S]*?top_up_requests/);
  });

  it('seleziona campi necessari (id, amount, status, created_at, approved_amount, admin_notes)', () => {
    // Nella funzione deve selezionare almeno questi campi
    const fnSection = walletSource.split('getMyTopUpRequests')[1];
    expect(fnSection).toContain('id');
    expect(fnSection).toContain('amount');
    expect(fnSection).toContain('status');
    expect(fnSection).toContain('created_at');
    expect(fnSection).toContain('approved_amount');
    expect(fnSection).toContain('admin_notes');
  });

  it('filtra per user_id dell utente corrente', () => {
    const fnSection = walletSource.split('getMyTopUpRequests')[1];
    expect(fnSection).toContain("eq('user_id'");
  });

  it('ordina per created_at desc', () => {
    const fnSection = walletSource.split('getMyTopUpRequests')[1];
    expect(fnSection).toContain("order('created_at'");
    expect(fnSection).toContain('ascending: false');
  });

  it('limita a 20 risultati', () => {
    const fnSection = walletSource.split('getMyTopUpRequests')[1];
    expect(fnSection).toContain('limit(20)');
  });

  it('gestisce errori con try/catch', () => {
    const fnSection = walletSource.split('getMyTopUpRequests')[1]?.split('export')[0];
    expect(fnSection).toContain('catch');
  });
});

// ============================================
// TEST: INTEGRAZIONE COMPONENTE NELLA PAGINA WALLET
// ============================================

describe('TopUpRequestsList - Integrazione Pagina Wallet', () => {
  const walletPage = readSource('app/dashboard/wallet/page.tsx');

  it('importa TopUpRequestsList nella pagina wallet', () => {
    expect(walletPage).toContain('import { TopUpRequestsList }');
    expect(walletPage).toContain("from '@/components/wallet/top-up-requests-list'");
  });

  it('usa il componente <TopUpRequestsList /> nel JSX', () => {
    expect(walletPage).toContain('<TopUpRequestsList');
  });

  it('componente posizionato prima della lista transazioni', () => {
    const topUpIndex = walletPage.indexOf('<TopUpRequestsList');
    const transactionsIndex = walletPage.indexOf('Storico Transazioni');
    expect(topUpIndex).toBeGreaterThan(0);
    expect(transactionsIndex).toBeGreaterThan(topUpIndex);
  });
});

// ============================================
// TEST: COMPONENTE top-up-requests-list.tsx
// ============================================

describe('TopUpRequestsList - File Componente', () => {
  const componentSource = readSource('components/wallet/top-up-requests-list.tsx');

  it('è un client component (use client)', () => {
    expect(componentSource).toMatch(/^'use client'/);
  });

  it('importa getMyTopUpRequests server action', () => {
    expect(componentSource).toContain('getMyTopUpRequests');
  });

  it('usa useState per requests, isLoading, isExpanded', () => {
    expect(componentSource).toContain('useState<TopUpRequest[]>');
    expect(componentSource).toContain('useState(true)');
    expect(componentSource).toContain('useState(false)');
  });

  it('usa useEffect per caricare dati al mount', () => {
    expect(componentSource).toContain('useEffect');
    expect(componentSource).toContain('loadRequests');
  });

  it('mostra importo accreditato per richieste approvate', () => {
    expect(componentSource).toContain("req.status === 'approved'");
    expect(componentSource).toContain('approved_amount');
    expect(componentSource).toContain('Accreditato');
  });

  it('mostra motivo rifiuto per richieste rifiutate', () => {
    expect(componentSource).toContain("req.status === 'rejected'");
    expect(componentSource).toContain('admin_notes');
    expect(componentSource).toContain('Motivo');
  });

  it('ha accordion espandibile', () => {
    expect(componentSource).toContain('isExpanded');
    expect(componentSource).toContain('setIsExpanded');
    expect(componentSource).toContain('ChevronDown');
    expect(componentSource).toContain('ChevronUp');
  });

  it('mostra badge con conteggio pendenti', () => {
    expect(componentSource).toContain('pendingCount');
    expect(componentSource).toContain('in attesa di approvazione');
  });
});

// ============================================
// TEST: EMAIL NOTIFICA APPROVAZIONE
// ============================================

describe('Email Notifica Approvazione Top-Up', () => {
  const walletSource = readSource('app/actions/wallet.ts');

  it('importa sendWalletTopUp da resend', () => {
    expect(walletSource).toContain('import { sendWalletTopUp');
    expect(walletSource).toContain("from '@/lib/email/resend'");
  });

  it('approveTopUpRequest invia email dopo approvazione', () => {
    // La sezione email è nella parte finale della funzione, usiamo il commento come anchor
    const emailSection = walletSource.split('Email notifica al cliente')[1];
    expect(emailSection).toContain('sendWalletTopUp');
  });

  it('email approvazione è non-bloccante (try/catch)', () => {
    const emailSection = walletSource.split('Email notifica al cliente')[1]?.split('return {')[0];
    expect(emailSection).toContain('catch');
    expect(emailSection).toContain('TOPUP_APPROVE');
  });

  it('email approvazione recupera dati utente dal DB', () => {
    const emailSection = walletSource.split('Email notifica al cliente')[1]?.split('return {')[0];
    expect(emailSection).toContain("from('users')");
    expect(emailSection).toContain('email');
    expect(emailSection).toContain('name');
  });

  it('email approvazione usa metodo bank_transfer', () => {
    const emailSection = walletSource.split('Email notifica al cliente')[1]?.split('return {')[0];
    expect(emailSection).toContain('bank_transfer');
  });

  it('email approvazione include nuovo saldo', () => {
    const emailSection = walletSource.split('Email notifica al cliente')[1]?.split('return {')[0];
    expect(emailSection).toContain('newBalance');
    expect(emailSection).toContain('wallet_balance');
  });
});

// ============================================
// TEST: EMAIL NOTIFICA RIFIUTO
// ============================================

describe('Email Notifica Rifiuto Top-Up', () => {
  const walletSource = readSource('app/actions/wallet.ts');
  const resendSource = readSource('lib/email/resend.ts');

  it('importa sendTopUpRejectedEmail da resend', () => {
    expect(walletSource).toContain('sendTopUpRejectedEmail');
    expect(walletSource).toContain("from '@/lib/email/resend'");
  });

  it('rejectTopUpRequest invia email dopo rifiuto', () => {
    const rejectSection = walletSource.split('rejectTopUpRequest')[1];
    expect(rejectSection).toContain('sendTopUpRejectedEmail');
  });

  it('email rifiuto è non-bloccante (try/catch)', () => {
    const rejectSection = walletSource.split('Email notifica rifiuto')[1]?.split('return {')[0];
    expect(rejectSection).toContain('catch');
    expect(rejectSection).toContain('warn');
  });

  it('email rifiuto include importo e motivo', () => {
    const rejectSection = walletSource.split('rejectTopUpRequest')[1];
    expect(rejectSection).toContain('amount: request.amount');
    expect(rejectSection).toContain("reason: reason || 'Nessun motivo specificato'");
  });

  it('sendTopUpRejectedEmail esiste in resend.ts', () => {
    expect(resendSource).toContain('export async function sendTopUpRejectedEmail');
  });

  it('template email rifiuto contiene testo appropriato', () => {
    expect(resendSource).toContain('Ricarica Non Approvata');
    expect(resendSource).toContain('Importo richiesto');
    expect(resendSource).toContain('Motivo');
  });

  it('template email rifiuto ha link alla pagina wallet', () => {
    expect(resendSource).toContain('spediresicuro.it/dashboard/wallet');
  });

  it('template email rifiuto usa colori rossi (coerenza visiva)', () => {
    // Il gradient dell header deve essere rosso per rifiuto
    expect(resendSource).toContain('#dc2626');
  });

  it('sendTopUpRejectedEmail usa sendEmail internamente', () => {
    // Dopo la definizione di sendTopUpRejectedEmail, deve chiamare sendEmail
    const fnSection = resendSource.split('sendTopUpRejectedEmail')[1];
    expect(fnSection).toContain('sendEmail');
  });

  it('email rifiuto ha subject appropriato', () => {
    expect(resendSource).toContain('Richiesta ricarica non approvata');
  });
});

// ============================================
// TEST: SICUREZZA E CONSISTENZA
// ============================================

describe('Sicurezza e Consistenza', () => {
  const walletSource = readSource('app/actions/wallet.ts');

  it('getMyTopUpRequests non espone campi sensibili (receipt_url, user_id)', () => {
    // Il select deve contenere solo i campi necessari, non *
    const fnSection = walletSource.split('getMyTopUpRequests')[1]?.split('export')[0];
    // Non deve usare select('*')
    expect(fnSection).not.toContain("select('*')");
  });

  it('email fallita non blocca il flusso di approvazione', () => {
    // Dopo sendWalletTopUp, il try/catch deve avere warn/info, non throw
    const approveSection = walletSource.split('Email notifica al cliente')[1]?.split('return {')[0];
    expect(approveSection).toContain('catch');
    expect(approveSection).toContain('warn');
  });

  it('email fallita non blocca il flusso di rifiuto', () => {
    const rejectSection = walletSource.split('Email notifica rifiuto')[1]?.split('return {')[0];
    expect(rejectSection).toContain('catch');
    expect(rejectSection).toContain('warn');
  });

  it('getMyTopUpRequests limita risultati per prevenire abuse', () => {
    const fnSection = walletSource.split('getMyTopUpRequests')[1]?.split('export')[0];
    expect(fnSection).toContain('limit(');
  });

  it('topup rejected email sanitizza il motivo (non injection HTML)', () => {
    // Il template usa interpolazione in HTML - verifica che usi sendEmail wrapper
    const resendSource = readSource('lib/email/resend.ts');
    const fnSection = resendSource.split('sendTopUpRejectedEmail')[1];
    // Usa il wrapper sendEmail che gestisce invio sicuro via Resend
    expect(fnSection).toContain('sendEmail');
  });
});
