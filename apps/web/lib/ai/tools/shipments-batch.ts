/**
 * Anne AI Tool: Batch Shipments Creation
 *
 * Permette ad Anne di:
 * - Analizzare file Excel/CSV con lista spedizioni
 * - Calcolare preventivi per tutti i corrieri
 * - Confrontare listini personalizzati
 * - Suggerire corriere ottimale
 * - Creare spedizioni in batch
 */

import { supabaseAdmin } from '@/lib/db/client';
import { assertValidUserId } from '@/lib/validators';

interface ShipmentRow {
  // Mittente
  sender_name?: string;
  sender_company?: string;
  sender_address?: string;
  sender_city?: string;
  sender_zip?: string;
  sender_province?: string;
  sender_phone?: string;
  sender_email?: string;

  // Destinatario
  recipient_name: string;
  recipient_company?: string;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_province?: string;
  recipient_phone?: string;
  recipient_email?: string;

  // Spedizione
  packages: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  value?: number;
  notes?: string;

  // Preferenze
  preferred_courier?: string;
  service_type?: 'standard' | 'express';
}

interface QuoteComparison {
  courier: string;
  service: string;
  price: number;
  deliveryDays: number;
  isRecommended: boolean;
  reason?: string;
}

interface BatchShipmentResult {
  success: boolean;
  totalShipments: number;
  created: number;
  failed: number;
  totalCost: number;
  totalSavings: number;
  shipments: Array<{
    row: number;
    recipient: string;
    status: 'created' | 'failed';
    shipmentId?: string;
    trackingNumber?: string;
    courier?: string;
    price?: number;
    error?: string;
  }>;
  summary: {
    byCourer: Record<string, { count: number; totalCost: number }>;
    averageSavings: number;
  };
}

/**
 * Parse CSV/TSV data to ShipmentRow[]
 */
export function parseShipmentsData(csvData: string): ShipmentRow[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('File vuoto o formato non valido');
  }

  // Detect delimiter (comma or tab)
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  // Parse header
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  // Parse rows
  const shipments: ShipmentRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map((v) => v.trim());
    const row: any = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';

      // Map common column names to ShipmentRow fields
      switch (header) {
        // Destinatario (obbligatori)
        case 'nome':
        case 'destinatario':
        case 'recipient_name':
          row.recipient_name = value;
          break;
        case 'indirizzo':
        case 'via':
        case 'recipient_address':
          row.recipient_address = value;
          break;
        case 'città':
        case 'citta':
        case 'city':
        case 'recipient_city':
          row.recipient_city = value;
          break;
        case 'cap':
        case 'zip':
        case 'recipient_zip':
          row.recipient_zip = value;
          break;
        case 'provincia':
        case 'prov':
        case 'recipient_province':
          row.recipient_province = value;
          break;
        case 'telefono':
        case 'tel':
        case 'phone':
        case 'recipient_phone':
          row.recipient_phone = value;
          break;
        case 'email':
        case 'recipient_email':
          row.recipient_email = value;
          break;
        case 'azienda':
        case 'company':
        case 'recipient_company':
          row.recipient_company = value;
          break;

        // Mittente (opzionali)
        case 'mittente_nome':
        case 'sender_name':
          row.sender_name = value;
          break;
        case 'mittente_indirizzo':
        case 'sender_address':
          row.sender_address = value;
          break;
        case 'mittente_citta':
        case 'sender_city':
          row.sender_city = value;
          break;
        case 'mittente_cap':
        case 'sender_zip':
          row.sender_zip = value;
          break;

        // Spedizione
        case 'colli':
        case 'packages':
          row.packages = parseInt(value) || 1;
          break;
        case 'peso':
        case 'weight':
        case 'kg':
          row.weight = parseFloat(value) || 0;
          break;
        case 'lunghezza':
        case 'length':
        case 'l':
          row.length = parseFloat(value);
          break;
        case 'larghezza':
        case 'width':
        case 'w':
          row.width = parseFloat(value);
          break;
        case 'altezza':
        case 'height':
        case 'h':
          row.height = parseFloat(value);
          break;
        case 'valore':
        case 'value':
          row.value = parseFloat(value);
          break;
        case 'note':
        case 'notes':
          row.notes = value;
          break;
        case 'corriere':
        case 'courier':
        case 'preferred_courier':
          row.preferred_courier = value;
          break;
      }
    });

    // Validate required fields
    if (row.recipient_name && row.recipient_address && row.recipient_city && row.recipient_zip) {
      shipments.push(row as ShipmentRow);
    }
  }

  return shipments;
}

/**
 * Calcola preventivi per tutti i corrieri e suggerisce il migliore
 */
export async function calculateQuotesComparison(
  shipment: ShipmentRow,
  userId: string
): Promise<QuoteComparison[]> {
  const quotes: QuoteComparison[] = [];

  // Simula chiamate a tutti i corrieri disponibili
  // TODO: Implementare chiamate reali API corrieri

  const couriers = [
    { name: 'GLS', basePrice: 8.5, deliveryDays: 2, express: 12.0 },
    { name: 'BRT', basePrice: 7.8, deliveryDays: 3, express: 11.5 },
    { name: 'SDA', basePrice: 9.2, deliveryDays: 2, express: 13.0 },
    { name: 'Poste', basePrice: 6.5, deliveryDays: 4, express: 10.0 },
    { name: 'TNT', basePrice: 10.5, deliveryDays: 1, express: 15.0 },
  ];

  // Calcola peso volumetrico
  const weight = shipment.weight || 1;
  const volumetricWeight =
    shipment.length && shipment.width && shipment.height
      ? (shipment.length * shipment.width * shipment.height) / 5000
      : weight;

  const effectiveWeight = Math.max(weight, volumetricWeight);

  // Carica listini personalizzati utente
  const { data: userPriceLists } = await supabaseAdmin
    .from('price_rules_advanced')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  for (const courier of couriers) {
    const serviceType = shipment.service_type || 'standard';
    const basePrice = serviceType === 'express' ? courier.express : courier.basePrice;

    // Applica listino personalizzato se esiste
    let finalPrice = basePrice * effectiveWeight;

    if (userPriceLists && userPriceLists.length > 0) {
      for (const priceList of userPriceLists) {
        if (priceList.courier_name?.toLowerCase() === courier.name.toLowerCase()) {
          // Applica sconto o markup
          if (priceList.discount_percent) {
            finalPrice *= 1 - priceList.discount_percent / 100;
          }
          if (priceList.markup_percent) {
            finalPrice *= 1 + priceList.markup_percent / 100;
          }
        }
      }
    }

    quotes.push({
      courier: courier.name,
      service: serviceType,
      price: Math.round(finalPrice * 100) / 100,
      deliveryDays: courier.deliveryDays,
      isRecommended: false,
    });
  }

  // Ordina per prezzo
  quotes.sort((a, b) => a.price - b.price);

  // Marca il più economico come raccomandato
  if (quotes.length > 0) {
    quotes[0].isRecommended = true;
    quotes[0].reason = 'Prezzo più conveniente';
  }

  // Se express richiesto, raccomanda il più veloce tra quelli economici
  if (shipment.service_type === 'express') {
    const fastestExpressIndex = quotes.findIndex((q) => q.deliveryDays === 1);
    if (fastestExpressIndex !== -1) {
      quotes.forEach((q) => (q.isRecommended = false));
      quotes[fastestExpressIndex].isRecommended = true;
      quotes[fastestExpressIndex].reason = 'Più veloce (express)';
    }
  }

  return quotes;
}

/**
 * Crea spedizioni in batch
 */
export async function createBatchShipments(
  shipments: ShipmentRow[],
  userId: string,
  defaultSender?: any
): Promise<BatchShipmentResult> {
  // ⚠️ SICUREZZA: Valida userId prima di inserire
  assertValidUserId(userId);

  const result: BatchShipmentResult = {
    success: true,
    totalShipments: shipments.length,
    created: 0,
    failed: 0,
    totalCost: 0,
    totalSavings: 0,
    shipments: [],
    summary: {
      byCourer: {},
      averageSavings: 0,
    },
  };

  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i];

    try {
      // Calcola quote
      const quotes = await calculateQuotesComparison(shipment, userId);
      const recommended = quotes.find((q) => q.isRecommended) || quotes[0];

      if (!recommended) {
        throw new Error('Nessun preventivo disponibile');
      }

      // Usa mittente di default o quello specificato
      const sender = {
        name: shipment.sender_name || defaultSender?.name || 'Mittente',
        company: shipment.sender_company || defaultSender?.company,
        address: shipment.sender_address || defaultSender?.address,
        city: shipment.sender_city || defaultSender?.city,
        zip: shipment.sender_zip || defaultSender?.zip,
        province: shipment.sender_province || defaultSender?.province,
        phone: shipment.sender_phone || defaultSender?.phone,
        email: shipment.sender_email || defaultSender?.email,
      };

      // Crea spedizione
      const { data: newShipment, error } = await supabaseAdmin
        .from('shipments')
        .insert({
          user_id: userId,

          // Mittente
          sender_name: sender.name,
          sender_company: sender.company,
          sender_address: sender.address,
          sender_city: sender.city,
          sender_zip: sender.zip,
          sender_province: sender.province,
          sender_phone: sender.phone,
          sender_email: sender.email,

          // Destinatario
          recipient_name: shipment.recipient_name,
          recipient_company: shipment.recipient_company,
          recipient_address: shipment.recipient_address,
          recipient_city: shipment.recipient_city,
          recipient_zip: shipment.recipient_zip,
          recipient_province: shipment.recipient_province,
          recipient_phone: shipment.recipient_phone,
          recipient_email: shipment.recipient_email,

          // Dettagli spedizione
          packages: shipment.packages || 1,
          weight: shipment.weight || 1,
          length: shipment.length,
          width: shipment.width,
          height: shipment.height,
          declared_value: shipment.value,
          notes: shipment.notes,

          // Corriere e prezzo
          courier: recommended.courier,
          service_type: recommended.service,
          quoted_price: recommended.price,

          // Status
          status: 'pending',
          payment_status: 'pending',

          // Metadata
          created_via: 'anne_batch',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Calcola risparmio (differenza tra prezzo più alto e quello scelto)
      const maxPrice = Math.max(...quotes.map((q) => q.price));
      const savings = maxPrice - recommended.price;

      result.created++;
      result.totalCost += recommended.price;
      result.totalSavings += savings;

      // Aggiorna summary per corriere
      if (!result.summary.byCourer[recommended.courier]) {
        result.summary.byCourer[recommended.courier] = { count: 0, totalCost: 0 };
      }
      result.summary.byCourer[recommended.courier].count++;
      result.summary.byCourer[recommended.courier].totalCost += recommended.price;

      result.shipments.push({
        row: i + 1,
        recipient: shipment.recipient_name,
        status: 'created',
        shipmentId: newShipment.id,
        trackingNumber: newShipment.tracking_number,
        courier: recommended.courier,
        price: recommended.price,
      });
    } catch (error: any) {
      result.failed++;
      result.shipments.push({
        row: i + 1,
        recipient: shipment.recipient_name,
        status: 'failed',
        error: error.message || 'Errore sconosciuto',
      });
    }
  }

  result.summary.averageSavings =
    result.created > 0 ? Math.round((result.totalSavings / result.created) * 100) / 100 : 0;

  result.success = result.failed === 0;

  return result;
}
