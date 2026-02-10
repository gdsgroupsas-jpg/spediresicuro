import { z } from 'zod';

// Helper per email opzionale: accetta stringa vuota o email valida
const optionalEmail = z
  .string()
  .transform((val) => (val === '' ? undefined : val))
  .pipe(z.string().email('Email non valida').optional())
  .or(z.literal(''));

export const createShipmentSchema = z.object({
  sender: z.object({
    name: z.string().min(1, 'Nome mittente obbligatorio'),
    company: z.string().optional(),
    address: z.string().min(1, 'Indirizzo mittente obbligatorio'),
    address2: z.string().optional(),
    city: z.string().min(1, 'Città mittente obbligatoria'),
    province: z.string().min(1, 'Provincia mittente obbligatoria'),
    postalCode: z.string().min(1, 'CAP mittente obbligatorio'),
    country: z.string().default('IT'),
    phone: z.string().optional(),
    email: optionalEmail.optional(),
  }),
  recipient: z.object({
    name: z.string().min(1, 'Nome destinatario obbligatorio'),
    company: z.string().optional(),
    address: z.string().min(1, 'Indirizzo destinatario obbligatorio'),
    address2: z.string().optional(),
    city: z.string().min(1, 'Città destinatario obbligatoria'),
    province: z.string().min(1, 'Provincia destinatario obbligatoria'),
    postalCode: z.string().min(1, 'CAP destinatario obbligatorio'),
    country: z.string().default('IT'),
    phone: z.string().optional(),
    email: optionalEmail.optional(),
  }),
  packages: z
    .array(
      z.object({
        length: z.number().positive('Lunghezza deve essere positiva'),
        width: z.number().positive('Larghezza deve essere positiva'),
        height: z.number().positive('Altezza deve essere positiva'),
        weight: z.number().positive('Peso deve essere positivo'),
      })
    )
    .min(1, 'Almeno un pacco richiesto'),
  insurance: z
    .object({
      value: z.number().nonnegative('Valore assicurazione non valido'),
    })
    .optional(),
  cod: z
    .object({
      value: z
        .number()
        .nonnegative('Valore contrassegno non valido')
        .max(5000, 'Contrassegno massimo 5.000 €'),
    })
    .optional(),
  notes: z.string().optional(),
  provider: z
    .enum(['spediscionline', 'poste_native', 'gls_native', 'brt_native'])
    .default('spediscionline'),
  carrier: z.enum(['GLS', 'POSTE', 'BRT', 'UPS', 'DHL', 'SDA', 'TNT', 'FEDEX']),
  contract_id: z.string().optional(), // Se user ha più contratti stesso corriere
  configId: z.string().optional(), // ID configurazione API specifica (per multi-config)
  // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali per retrocompatibilità
  vat_mode: z.enum(['included', 'excluded']).optional().nullable(), // NULL = legacy (assume 'excluded')
  vat_rate: z.number().positive().optional(), // Default 22.0 se non specificato
  // ✨ ENTERPRISE: Pricing info dal preventivo (per calcolo margine accurato)
  base_price: z.number().positive().optional(), // Costo fornitore reale dal listino
  final_price: z.number().positive().optional(), // Prezzo finale di vendita
  priceListId: z.string().optional(), // ID listino usato per il preventivo
  // ✨ PICKUP: Prenotazione ritiro a domicilio (per API Spedisci.online)
  pickup: z
    .object({
      pickup_from_address: z.string().optional(), // "1" se attivo
      pickup_date: z.string().optional(), // formato DD/MM/YYYY
      pickup_time: z.enum(['AM', 'PM']).optional(), // Mattino o Pomeriggio
    })
    .optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
