import { z } from 'zod'

/**
 * Schema di validazione per la creazione di un nuovo Sub-User
 */
export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve contenere almeno 2 caratteri')
    .max(100, 'Nome troppo lungo (max 100 caratteri)')
    .trim(),
  email: z
    .string()
    .email('Email non valida')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password deve contenere almeno 8 caratteri')
    .regex(/[A-Z]/, 'Password deve contenere almeno una maiuscola')
    .regex(/[0-9]/, 'Password deve contenere almeno un numero')
    .optional()
    .or(z.literal('')),
  initialBalance: z
    .number()
    .min(0, 'Il saldo non può essere negativo')
    .max(10000, 'Saldo iniziale massimo: 10.000 €')
    .default(0),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

/**
 * Schema per l'aggiornamento di un utente
 */
export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve contenere almeno 2 caratteri')
    .max(100, 'Nome troppo lungo')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Email non valida')
    .toLowerCase()
    .trim()
    .optional(),
  companyName: z
    .string()
    .max(200, 'Nome azienda troppo lungo')
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Numero telefono troppo lungo')
    .trim()
    .optional()
    .nullable(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/**
 * Schema per i filtri di ricerca utenti
 */
export const userFiltersSchema = z.object({
  search: z.string().optional(),
  accountType: z.enum(['all', 'admin', 'reseller', 'user']).default('all'),
  resellerStatus: z.enum(['all', 'active', 'inactive']).default('all'),
  walletMin: z.number().min(0).optional(),
  walletMax: z.number().min(0).optional(),
  dateFrom: z.date().optional().nullable(),
  dateTo: z.date().optional().nullable(),
  sortBy: z.enum(['name', 'email', 'wallet_balance', 'created_at', 'shipments']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
})

export type UserFilters = z.infer<typeof userFiltersSchema>

/**
 * Schema per toggle status reseller
 */
export const toggleResellerSchema = z.object({
  userId: z.string().uuid('ID utente non valido'),
  enabled: z.boolean(),
  confirmationName: z
    .string()
    .min(1, 'Inserisci il nome per confermare')
    .optional(),
})

export type ToggleResellerInput = z.infer<typeof toggleResellerSchema>
