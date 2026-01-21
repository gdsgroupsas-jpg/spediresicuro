import { z } from 'zod';

/**
 * Schema per operazioni wallet singole
 */
export const walletOperationSchema = z.object({
  userId: z.string().uuid('ID utente non valido'),
  amount: z.number().refine((val) => val !== 0, "L'importo non può essere zero"),
  reason: z
    .string()
    .min(3, 'Causale troppo corta (min 3 caratteri)')
    .max(500, 'Causale troppo lunga (max 500 caratteri)')
    .trim(),
});

export type WalletOperationInput = z.infer<typeof walletOperationSchema>;

/**
 * Schema per operazioni wallet massive
 */
export const bulkWalletOperationSchema = z.object({
  userIds: z.array(z.string().uuid('ID utente non valido')).min(1, 'Seleziona almeno un utente'),
  amount: z.number().refine((val) => val !== 0, "L'importo non può essere zero"),
  reason: z
    .string()
    .min(3, 'Causale troppo corta (min 3 caratteri)')
    .max(500, 'Causale troppo lunga (max 500 caratteri)')
    .trim(),
});

export type BulkWalletOperationInput = z.infer<typeof bulkWalletOperationSchema>;

/**
 * Schema per i quick amounts (bottoni rapidi)
 */
export const quickAmountSchema = z.object({
  amount: z.number(),
  label: z.string(),
});

export type QuickAmount = z.infer<typeof quickAmountSchema>;

/**
 * Quick amounts predefiniti per ricarica wallet
 */
export const QUICK_AMOUNTS: QuickAmount[] = [
  { amount: 10, label: '+10 €' },
  { amount: 50, label: '+50 €' },
  { amount: 100, label: '+100 €' },
  { amount: 200, label: '+200 €' },
];

/**
 * Quick amounts per prelievo
 */
export const QUICK_DEBIT_AMOUNTS: QuickAmount[] = [
  { amount: -10, label: '-10 €' },
  { amount: -25, label: '-25 €' },
  { amount: -50, label: '-50 €' },
];

/**
 * Soglie per warning saldo
 */
export const WALLET_THRESHOLDS = {
  LOW: 10, // Saldo considerato basso
  HIGH: 100, // Saldo considerato alto
  WARNING_DEBIT: 500, // Importo che richiede conferma extra
} as const;
