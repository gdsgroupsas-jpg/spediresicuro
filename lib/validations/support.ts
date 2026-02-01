/**
 * Zod Validation Schemas per Sistema di Assistenza
 * 
 * Schemi di validazione per input utente e API
 */

import { z } from 'zod';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  KBCategory,
} from '@/types/support';

// ============================================
// TICKET SCHEMAS
// ============================================

export const createTicketSchema = z.object({
  category: z.enum([
    TicketCategory.SPEDIZIONE,
    TicketCategory.GIACENZA,
    TicketCategory.WALLET,
    TicketCategory.FATTURA,
    TicketCategory.TECNICO,
    TicketCategory.CONFIGURAZIONE,
    TicketCategory.ALTRO,
  ], {
    errorMap: () => ({ message: 'Categoria non valida' }),
  }),
  
  priority: z.enum([
    TicketPriority.BASSA,
    TicketPriority.MEDIA,
    TicketPriority.ALTA,
    TicketPriority.URGENTE,
  ]).default(TicketPriority.MEDIA),
  
  subject: z.string()
    .min(5, 'L\'oggetto deve contenere almeno 5 caratteri')
    .max(200, 'L\'oggetto non può superare 200 caratteri')
    .trim(),
  
  description: z.string()
    .min(20, 'La descrizione deve contenere almeno 20 caratteri')
    .max(5000, 'La descrizione non può superare 5000 caratteri')
    .trim(),
  
  // Riferimenti opzionali
  shipment_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  wallet_transaction_id: z.string().uuid().optional(),
  
  tags: z.array(z.string()).default([]),
});

export type CreateTicketSchema = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  status: z.enum([
    TicketStatus.NUOVO,
    TicketStatus.IN_LAVORAZIONE,
    TicketStatus.ATTESA_CLIENTE,
    TicketStatus.ATTESA_CORRIERE,
    TicketStatus.RISOLTO,
    TicketStatus.CHIUSO,
  ]).optional(),
  
  priority: z.enum([
    TicketPriority.BASSA,
    TicketPriority.MEDIA,
    TicketPriority.ALTA,
    TicketPriority.URGENTE,
  ]).optional(),
  
  assigned_to: z.string().uuid().nullable().optional(),
  
  rating: z.number().int().min(1).max(5).optional(),
  
  feedback: z.string().max(1000).optional(),
  
  tags: z.array(z.string()).optional(),
});

export type UpdateTicketSchema = z.infer<typeof updateTicketSchema>;

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const createMessageSchema = z.object({
  ticket_id: z.string().uuid('ID ticket non valido'),
  
  message: z.string()
    .min(1, 'Il messaggio non può essere vuoto')
    .max(5000, 'Il messaggio non può superare 5000 caratteri')
    .trim(),
  
  is_internal: z.boolean().default(false),
});

export type CreateMessageSchema = z.infer<typeof createMessageSchema>;

// ============================================
// ATTACHMENT SCHEMAS
// ============================================

export const attachmentMetadataSchema = z.object({
  ticket_id: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
  file_name: z.string(),
  file_size: z.number().positive(),
  mime_type: z.string(),
}).refine(
  (data) => data.ticket_id || data.message_id,
  {
    message: 'Deve essere specificato ticket_id o message_id',
  }
);

export type AttachmentMetadataSchema = z.infer<typeof attachmentMetadataSchema>;

// Validazione file upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Il file non può superare 10MB',
    };
  }
  
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo di file non supportato',
    };
  }
  
  return { valid: true };
}

// ============================================
// KB ARTICLE SCHEMAS
// ============================================

export const createKBArticleSchema = z.object({
  title: z.string()
    .min(5, 'Il titolo deve contenere almeno 5 caratteri')
    .max(200, 'Il titolo non può superare 200 caratteri')
    .trim(),
  
  slug: z.string()
    .min(3, 'Lo slug deve contenere almeno 3 caratteri')
    .max(200, 'Lo slug non può superare 200 caratteri')
    .regex(/^[a-z0-9-]+$/, 'Lo slug può contenere solo lettere minuscole, numeri e trattini')
    .trim(),
  
  content: z.string()
    .min(50, 'Il contenuto deve contenere almeno 50 caratteri')
    .max(50000, 'Il contenuto non può superare 50000 caratteri'),
  
  excerpt: z.string()
    .max(500, 'L\'estratto non può superare 500 caratteri')
    .optional(),
  
  category: z.enum([
    KBCategory.SPEDIZIONI,
    KBCategory.GIACENZE,
    KBCategory.WALLET,
    KBCategory.FATTURE,
    KBCategory.CONFIGURAZIONE,
    KBCategory.INTEGRAZIONI,
    KBCategory.FAQ,
  ]),
  
  tags: z.array(z.string()).default([]),
  
  published: z.boolean().default(false),
  
  meta_description: z.string()
    .max(160, 'La meta description non può superare 160 caratteri')
    .optional(),
});

export type CreateKBArticleSchema = z.infer<typeof createKBArticleSchema>;

export const updateKBArticleSchema = createKBArticleSchema.partial();

export type UpdateKBArticleSchema = z.infer<typeof updateKBArticleSchema>;

// ============================================
// CANNED RESPONSE SCHEMAS
// ============================================

export const createCannedResponseSchema = z.object({
  title: z.string()
    .min(3, 'Il titolo deve contenere almeno 3 caratteri')
    .max(100, 'Il titolo non può superare 100 caratteri')
    .trim(),
  
  shortcut: z.string()
    .min(2, 'Lo shortcut deve contenere almeno 2 caratteri')
    .max(50, 'Lo shortcut non può superare 50 caratteri')
    .regex(/^\/[a-z0-9-]+$/, 'Lo shortcut deve iniziare con / e contenere solo lettere minuscole, numeri e trattini')
    .trim(),
  
  content: z.string()
    .min(10, 'Il contenuto deve contenere almeno 10 caratteri')
    .max(2000, 'Il contenuto non può superare 2000 caratteri'),
  
  category: z.string().optional(),
});

export type CreateCannedResponseSchema = z.infer<typeof createCannedResponseSchema>;

// ============================================
// FILTER SCHEMAS
// ============================================

export const ticketFiltersSchema = z.object({
  status: z.union([
    z.enum([
      TicketStatus.NUOVO,
      TicketStatus.IN_LAVORAZIONE,
      TicketStatus.ATTESA_CLIENTE,
      TicketStatus.ATTESA_CORRIERE,
      TicketStatus.RISOLTO,
      TicketStatus.CHIUSO,
    ]),
    z.array(z.enum([
      TicketStatus.NUOVO,
      TicketStatus.IN_LAVORAZIONE,
      TicketStatus.ATTESA_CLIENTE,
      TicketStatus.ATTESA_CORRIERE,
      TicketStatus.RISOLTO,
      TicketStatus.CHIUSO,
    ])),
  ]).optional(),
  
  category: z.union([
    z.enum([
      TicketCategory.SPEDIZIONE,
      TicketCategory.GIACENZA,
      TicketCategory.WALLET,
      TicketCategory.FATTURA,
      TicketCategory.TECNICO,
      TicketCategory.CONFIGURAZIONE,
      TicketCategory.ALTRO,
    ]),
    z.array(z.enum([
      TicketCategory.SPEDIZIONE,
      TicketCategory.GIACENZA,
      TicketCategory.WALLET,
      TicketCategory.FATTURA,
      TicketCategory.TECNICO,
      TicketCategory.CONFIGURAZIONE,
      TicketCategory.ALTRO,
    ])),
  ]).optional(),
  
  priority: z.union([
    z.enum([
      TicketPriority.BASSA,
      TicketPriority.MEDIA,
      TicketPriority.ALTA,
      TicketPriority.URGENTE,
    ]),
    z.array(z.enum([
      TicketPriority.BASSA,
      TicketPriority.MEDIA,
      TicketPriority.ALTA,
      TicketPriority.URGENTE,
    ])),
  ]).optional(),
  
  assigned_to: z.string().uuid().nullable().optional(),
  
  user_id: z.string().uuid().optional(),
  
  search: z.string().optional(),
  
  date_from: z.string().datetime().optional(),
  
  date_to: z.string().datetime().optional(),
});

export type TicketFiltersSchema = z.infer<typeof ticketFiltersSchema>;

export const ticketListParamsSchema = ticketFiltersSchema.extend({
  page: z.number().int().positive().default(1),
  
  limit: z.number().int().positive().max(100).default(20),
  
  sort_by: z.enum(['created_at', 'updated_at', 'priority']).default('created_at'),
  
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type TicketListParamsSchema = z.infer<typeof ticketListParamsSchema>;

// ============================================
// ACTION SCHEMAS
// ============================================

export const giacenzaActionSchema = z.object({
  ticket_id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  action: z.enum(['riconsegna', 'reso', 'distruzione']),
});

export type GiacenzaActionSchema = z.infer<typeof giacenzaActionSchema>;

export const walletActionSchema = z.object({
  ticket_id: z.string().uuid(),
  action: z.enum(['ricarica', 'rimborso', 'verifica']),
  amount: z.number().positive().optional(),
  transaction_id: z.string().uuid().optional(),
});

export type WalletActionSchema = z.infer<typeof walletActionSchema>;

export const shipmentActionSchema = z.object({
  ticket_id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  action: z.enum(['cancella', 'tracking', 'download_ldv']),
});

export type ShipmentActionSchema = z.infer<typeof shipmentActionSchema>;

// ============================================
// RATING SCHEMA
// ============================================

export const submitRatingSchema = z.object({
  ticket_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});

export type SubmitRatingSchema = z.infer<typeof submitRatingSchema>;
