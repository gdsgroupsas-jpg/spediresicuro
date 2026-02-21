/**
 * Gemini function declarations and execution bridge to tRPC / REST.
 */

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface VoiceToolExecutionContext {
  api?: any; // tRPC proxy (e.g., api from @/lib/trpc/react)
  fetcher?: typeof fetch;
  userId?: string;
  role?: 'admin' | 'user';
}

export interface VoiceToolResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export const voiceFunctionDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'createShipment',
    description: 'Crea una nuova spedizione con mittente, destinatario, peso e servizio richiesto.',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string' },
            province: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'address', 'city', 'zip', 'province'],
        },
        destination: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string' },
            province: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'address', 'city', 'zip', 'province'],
        },
        weight: { type: 'number', description: 'Peso in kg' },
        service: { type: 'string', description: 'Servizio richiesto (standard, express, economy)' },
        notes: { type: 'string' },
      },
      required: ['origin', 'destination', 'weight'],
    },
  },
  {
    name: 'trackShipment',
    description: 'Traccia una spedizione per tracking number o nome destinatario.',
    parameters: {
      type: 'object',
      properties: {
        trackingNumber: { type: 'string' },
        recipientName: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'listShipments',
    description: 'Elenca spedizioni con filtro opzionale per stato.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Stato spedizione (pending, in_transit, delivered, etc.)',
        },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'calculatePrice',
    description: 'Calcola un preventivo di spedizione.',
    parameters: {
      type: 'object',
      properties: {
        originZip: { type: 'string' },
        destinationZip: { type: 'string' },
        destinationProvince: { type: 'string' },
        weight: { type: 'number' },
        service: { type: 'string' },
        cashOnDelivery: { type: 'number' },
        declaredValue: { type: 'number' },
      },
      required: ['destinationZip', 'weight'],
    },
  },
  {
    name: 'createReturn',
    description: 'Avvia un reso a partire da una spedizione o tracking number.',
    parameters: {
      type: 'object',
      properties: {
        trackingNumber: { type: 'string' },
        reason: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['trackingNumber'],
    },
  },
  {
    name: 'openTicket',
    description: 'Apre un ticket di assistenza.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['subject', 'description'],
    },
  },
  {
    name: 'getStatistics',
    description: 'Recupera metriche dashboard: consegne oggi, in transito, ecc.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'] },
      },
    },
  },
];

/**
 * Execute a voice tool against tRPC when available, falling back to REST APIs.
 */
export async function executeVoiceTool(
  toolName: string,
  args: Record<string, any>,
  ctx: VoiceToolExecutionContext = {}
): Promise<VoiceToolResult> {
  const fetcher = ctx.fetcher || (typeof fetch !== 'undefined' ? fetch : undefined);

  try {
    switch (toolName) {
      case 'createShipment': {
        if (ctx.api?.shipments?.create?.mutate) {
          const data = await ctx.api.shipments.create.mutate(args);
          return { success: true, data, message: 'Spedizione creata' };
        }

        if (!fetcher) return { success: false, error: 'Nessun trasporto disponibile' };

        const res = await fetcher('/api/spedizioni', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mittenteNome: args.origin?.name,
            mittenteIndirizzo: args.origin?.address,
            mittenteCitta: args.origin?.city,
            mittenteCap: args.origin?.zip,
            mittenteProvincia: args.origin?.province,
            mittenteTelefono: args.origin?.phone,
            mittenteEmail: args.origin?.email,
            destinatarioNome: args.destination?.name,
            destinatarioIndirizzo: args.destination?.address,
            destinatarioCitta: args.destination?.city,
            destinatarioCap: args.destination?.zip,
            destinatarioProvincia: args.destination?.province,
            destinatarioTelefono: args.destination?.phone,
            destinatarioEmail: args.destination?.email,
            peso: args.weight,
            tipoSpedizione: args.service || 'standard',
            note: args.notes,
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          return { success: false, error: error?.message || 'Errore creazione spedizione' };
        }

        const data = await res.json();
        return { success: true, data, message: 'Spedizione creata' };
      }

      case 'trackShipment': {
        if (ctx.api?.shipments?.track?.query) {
          const data = await ctx.api.shipments.track.query({
            trackingNumber: args.trackingNumber,
            recipientName: args.recipientName,
          });
          return { success: true, data, message: 'Tracking recuperato' };
        }

        if (!fetcher) return { success: false, error: 'Nessun trasporto disponibile' };

        // Fallback: fetch list and filter client-side
        const listRes = await fetcher('/api/spedizioni');
        const listJson = await listRes.json().catch(() => ({ data: [] }));
        const shipments: any[] = listJson.data || [];

        const found =
          shipments.find(
            (s) => s.tracking === args.trackingNumber || s.tracking_number === args.trackingNumber
          ) ||
          shipments.find(
            (s) =>
              args.recipientName &&
              (s.destinatario?.nome || s.recipient_name || '')
                .toLowerCase()
                .includes(args.recipientName.toLowerCase())
          );

        if (!found) {
          return { success: false, error: 'Spedizione non trovata' };
        }

        return { success: true, data: found, message: 'Tracking recuperato' };
      }

      case 'listShipments': {
        if (ctx.api?.shipments?.list?.query) {
          const data = await ctx.api.shipments.list.query({
            status: args.status,
            limit: args.limit || 20,
          });
          return { success: true, data, message: 'Elenco spedizioni' };
        }

        if (!fetcher) return { success: false, error: 'Nessun trasporto disponibile' };
        const res = await fetcher('/api/spedizioni');
        const json = await res.json().catch(() => ({ data: [] }));
        const shipments: any[] = json.data || [];
        const filtered = args.status
          ? shipments.filter((s) => (s.status || '').toLowerCase() === args.status.toLowerCase())
          : shipments;
        return {
          success: true,
          data: filtered.slice(0, args.limit || 20),
          message: 'Elenco spedizioni',
        };
      }

      case 'calculatePrice': {
        if (ctx.api?.shipments?.calculatePrice?.mutate) {
          const data = await ctx.api.shipments.calculatePrice.mutate(args);
          return { success: true, data, message: 'Preventivo calcolato' };
        }

        // Lightweight fallback estimate
        const weight = Number(args.weight || 0);
        const base = 10;
        const perKg = 2;
        const expressMultiplier = args.service === 'express' ? 1.5 : 1;
        const cod = Number(args.cashOnDelivery || 0) > 0 ? 3 : 0;
        const insurance =
          Number(args.declaredValue || 0) > 0 ? Number(args.declaredValue) * 0.02 : 0;
        const estimate = (base + weight * perKg) * expressMultiplier + cod + insurance;

        return {
          success: true,
          data: {
            estimate,
            currency: 'EUR',
            breakdown: {
              base,
              weight: weight * perKg,
              cod,
              insurance,
              expressMultiplier,
            },
          },
          message: `Preventivo stimato €${estimate.toFixed(2)}`,
        };
      }

      case 'createReturn': {
        if (ctx.api?.returns?.create?.mutate) {
          const data = await ctx.api.returns.create.mutate(args);
          return { success: true, data, message: 'Reso creato' };
        }
        return { success: false, error: 'Endpoint resi non configurato' };
      }

      case 'openTicket': {
        if (ctx.api?.support?.open?.mutate) {
          const data = await ctx.api.support.open.mutate(args);
          return { success: true, data, message: 'Ticket aperto' };
        }
        return { success: false, error: 'Endpoint ticket non configurato' };
      }

      case 'getStatistics': {
        if (ctx.api?.dashboard?.getStatistics?.query) {
          const data = await ctx.api.dashboard.getStatistics.query({
            period: args.period || 'all',
          });
          return { success: true, data, message: 'Statistiche recuperate' };
        }

        if (!fetcher) return { success: false, error: 'Nessun trasporto disponibile' };
        const res = await fetcher('/api/spedizioni');
        const json = await res.json().catch(() => ({ data: [] }));
        const shipments: any[] = json.data || [];

        const stats = {
          total: shipments.length,
          delivered: shipments.filter((s) => s.status === 'delivered').length,
          in_transit: shipments.filter((s) => s.status === 'in_transit' || s.status === 'shipped')
            .length,
          pending: shipments.filter((s) => s.status === 'pending' || s.status === 'draft').length,
          today: shipments.filter((s) => {
            if (!s.created_at) return false;
            const created = new Date(s.created_at);
            const now = new Date();
            return (
              created.getDate() === now.getDate() &&
              created.getMonth() === now.getMonth() &&
              created.getFullYear() === now.getFullYear()
            );
          }).length,
        };

        return { success: true, data: stats, message: 'Statistiche calcolate' };
      }

      default:
        return { success: false, error: `Tool sconosciuto: ${toolName}` };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Errore esecuzione tool',
    };
  }
}
