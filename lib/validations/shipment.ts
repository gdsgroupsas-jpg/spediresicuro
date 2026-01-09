import { z } from 'zod'

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
    email: z.string().email('Email mittente non valida')
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
    email: z.string().email('Email destinatario non valida').optional()
  }),
  packages: z.array(z.object({
    length: z.number().positive('Lunghezza deve essere positiva'),
    width: z.number().positive('Larghezza deve essere positiva'),
    height: z.number().positive('Altezza deve essere positiva'),
    weight: z.number().positive('Peso deve essere positivo')
  })).min(1, 'Almeno un pacco richiesto'),
  insurance: z.object({
    value: z.number().nonnegative('Valore assicurazione non valido')
  }).optional(),
  cod: z.object({
    value: z.number().nonnegative('Valore contrassegno non valido')
  }).optional(),
  notes: z.string().optional(),
  provider: z.enum(['spediscionline', 'poste_native', 'gls_native', 'brt_native']).default('spediscionline'),
  carrier: z.enum(['GLS', 'POSTE', 'BRT', 'UPS', 'DHL', 'SDA', 'TNT', 'FEDEX']),
  contract_id: z.string().optional(),  // Se user ha più contratti stesso corriere
  configId: z.string().optional()  // ID configurazione API specifica (per multi-config)
})

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>

