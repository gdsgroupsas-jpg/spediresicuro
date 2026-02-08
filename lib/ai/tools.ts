/**
 * Tools per Anne
 *
 * Funzioni che Anne può chiamare per eseguire azioni concrete:
 * - fill_shipment_form: Compila form spedizione
 * - calculate_price: Calcola prezzo spedizione
 * - track_shipment: Traccia spedizione
 * - analyze_business_health: Analizza salute business (solo admin)
 * - check_error_logs: Controlla errori sistema (solo admin)
 *
 * PRICING TOOLS (accesso atomizzato ai listini):
 * - get_price_list_details: Dettagli listino specifico
 * - get_supplier_cost: Costo fornitore puro per una spedizione
 * - list_user_price_lists: Listini assegnati a utente
 * - compare_supplier_vs_selling: Confronto costo/vendita
 */

import { calculateOptimalPrice, PricingRequest } from './pricing-engine';
import { supabaseAdmin } from '@/lib/db/client';
import { getPriceListById, calculatePriceWithRules } from '@/lib/db/price-lists';
import { calculatePriceFromList } from '@/lib/pricing/calculator';
import { SUPPORT_TOOL_DEFINITIONS, executeSupportTool } from './tools/support-tools';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * Definizioni tools disponibili per Anne
 */
export const ANNE_TOOLS: ToolDefinition[] = [
  {
    name: 'fill_shipment_form',
    description:
      "Compila automaticamente il form di creazione spedizione con i dati estratti dalla conversazione. Restituisce i dati strutturati pronti per l'inserimento.",
    parameters: {
      type: 'object',
      properties: {
        recipient_name: {
          type: 'string',
          description: 'Nome completo destinatario',
        },
        recipient_address: {
          type: 'string',
          description: 'Indirizzo completo destinatario',
        },
        recipient_city: {
          type: 'string',
          description: 'Città destinatario',
        },
        recipient_postal_code: {
          type: 'string',
          description: 'CAP destinatario (5 cifre)',
        },
        recipient_province: {
          type: 'string',
          description: 'Provincia destinatario (2 lettere, es. "RM")',
        },
        recipient_phone: {
          type: 'string',
          description: 'Telefono destinatario',
        },
        recipient_email: {
          type: 'string',
          description: 'Email destinatario (opzionale)',
        },
        weight: {
          type: 'number',
          description: 'Peso pacco in kg',
        },
        packages: {
          type: 'number',
          description: 'Numero colli (default: 1)',
        },
        cashOnDelivery: {
          type: 'number',
          description: 'Importo contrassegno (0 = no contrassegno)',
        },
        declaredValue: {
          type: 'number',
          description: 'Valore dichiarato per assicurazione',
        },
        notes: {
          type: 'string',
          description: 'Note aggiuntive spedizione',
        },
      },
      required: [
        'recipient_name',
        'recipient_address',
        'recipient_city',
        'recipient_postal_code',
        'recipient_province',
        'weight',
      ],
    },
  },
  {
    name: 'calculate_price',
    description:
      'Calcola il prezzo ottimale per una spedizione. Restituisce i migliori corrieri disponibili con prezzi e tempi di consegna.',
    parameters: {
      type: 'object',
      properties: {
        weight: {
          type: 'number',
          description: 'Peso pacco in kg',
        },
        destinationZip: {
          type: 'string',
          description: 'CAP destinazione (5 cifre)',
        },
        destinationProvince: {
          type: 'string',
          description: 'Provincia destinazione (2 lettere)',
        },
        serviceType: {
          type: 'string',
          enum: ['standard', 'express', 'economy'],
          description: 'Tipo servizio richiesto',
        },
        cashOnDelivery: {
          type: 'number',
          description: 'Importo contrassegno (0 = no contrassegno)',
        },
        declaredValue: {
          type: 'number',
          description: 'Valore dichiarato per assicurazione',
        },
      },
      required: ['weight', 'destinationZip', 'destinationProvince'],
    },
  },
  {
    name: 'track_shipment',
    description:
      'Traccia una spedizione tramite tracking number. Restituisce lo stato attuale e la cronologia eventi.',
    parameters: {
      type: 'object',
      properties: {
        trackingNumber: {
          type: 'string',
          description: 'Numero di tracking della spedizione',
        },
      },
      required: ['trackingNumber'],
    },
  },
  {
    name: 'analyze_business_health',
    description:
      'Analizza la salute del business: margini, trend, performance corrieri, confronto periodi. Disponibile solo per admin.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter'],
          description: 'Periodo da analizzare',
        },
        compareWithPrevious: {
          type: 'boolean',
          description: 'Confronta con periodo precedente',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_error_logs',
    description: 'Controlla gli ultimi errori di sistema. Disponibile solo per admin.',
    parameters: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['error', 'critical', 'warning'],
          description: 'Filtra per severità',
        },
        hours: {
          type: 'number',
          description: 'Ore da controllare (default: 24)',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_batch_shipments',
    description:
      'Crea spedizioni multiple da file Excel/CSV. Analizza il file, calcola preventivi per tutti i corrieri, suggerisce il migliore per ogni spedizione e crea tutto in batch. COMPLETO end-to-end.',
    parameters: {
      type: 'object',
      properties: {
        csvData: {
          type: 'string',
          description:
            'Contenuto del file CSV/Excel (formato testo, righe separate da \\n, colonne separate da , o tab). Prima riga = intestazioni. Colonne supportate: nome, destinatario, indirizzo, città, cap, provincia, telefono, email, colli, peso, note, corriere (preferito)',
        },
        defaultSender: {
          type: 'object',
          description:
            'Dati mittente di default da usare per tutte le spedizioni (se non specificato nel CSV)',
          properties: {
            name: { type: 'string' },
            company: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string' },
            province: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
        },
        autoSelectBestCourier: {
          type: 'boolean',
          description:
            'Se true, Anne seleziona automaticamente il corriere più conveniente per ogni spedizione. Se false, usa quello indicato nel CSV o chiede conferma (default: true)',
        },
      },
      required: ['csvData'],
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // PRICING TOOLS - Accesso atomizzato ai listini
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'get_price_list_details',
    description:
      'Ottiene i dettagli completi di un listino prezzi specifico: margine configurato, listino fornitore collegato, regole, stato. Usa questo tool per rispondere a domande come "che margine ho su GLS?" o "qual è il mio listino attivo?"',
    parameters: {
      type: 'object',
      properties: {
        priceListId: {
          type: 'string',
          description: 'ID del listino da interrogare (opzionale se si vuole il listino attivo)',
        },
        courierId: {
          type: 'string',
          description: 'ID del corriere per trovare il listino attivo (es. "gls", "brt")',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_supplier_cost',
    description:
      'Calcola il COSTO FORNITORE puro per una spedizione, senza margine applicato. Questo è quanto paghiamo al corriere. Usa per domande come "quanto mi costa GLS per 5kg a Roma?"',
    parameters: {
      type: 'object',
      properties: {
        weight: {
          type: 'number',
          description: 'Peso pacco in kg',
        },
        destinationZip: {
          type: 'string',
          description: 'CAP destinazione',
        },
        destinationProvince: {
          type: 'string',
          description: 'Provincia destinazione (2 lettere)',
        },
        courierId: {
          type: 'string',
          description: 'ID del corriere specifico (opzionale)',
        },
        serviceType: {
          type: 'string',
          enum: ['standard', 'express', 'economy'],
          description: 'Tipo servizio',
        },
      },
      required: ['weight', 'destinationZip', 'destinationProvince'],
    },
  },
  {
    name: 'list_user_price_lists',
    description:
      'Lista tutti i listini prezzi assegnati a un utente/reseller. Mostra quali corrieri sono attivi, margini configurati, stato. Usa per "quali listini ho?" o "che corrieri posso usare?"',
    parameters: {
      type: 'object',
      properties: {
        targetUserId: {
          type: 'string',
          description: 'ID utente da interrogare (default: utente corrente)',
        },
        includeInactive: {
          type: 'boolean',
          description: 'Includi anche listini non attivi (default: false)',
        },
      },
      required: [],
    },
  },
  {
    name: 'compare_supplier_vs_selling',
    description:
      'Confronta COSTO FORNITORE vs PREZZO VENDITA per una spedizione specifica. Mostra margine in € e %. Usa per "quanto margino su questa spedizione?" o "confronta costo e vendita per 5kg Roma"',
    parameters: {
      type: 'object',
      properties: {
        weight: {
          type: 'number',
          description: 'Peso pacco in kg',
        },
        destinationZip: {
          type: 'string',
          description: 'CAP destinazione',
        },
        destinationProvince: {
          type: 'string',
          description: 'Provincia destinazione (2 lettere)',
        },
        courierId: {
          type: 'string',
          description: 'ID corriere specifico (opzionale, altrimenti mostra tutti)',
        },
        priceListId: {
          type: 'string',
          description: 'ID listino specifico (opzionale, altrimenti usa listino attivo)',
        },
      },
      required: ['weight', 'destinationZip', 'destinationProvince'],
    },
  },
  // ═══════════════════════════════════════════════════════════════════════
  // SUPPORT TOOLS - Assistenza AI-native con Anne
  // ═══════════════════════════════════════════════════════════════════════
  ...SUPPORT_TOOL_DEFINITIONS,

  // ═══════════════════════════════════════════════════════════════════════
  // CRM TOOLS - Intelligence pipeline (Sprint S1, read-only)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'get_pipeline_summary',
    description:
      'Panoramica pipeline CRM: conteggi per stato, score medio, valore pipeline, tasso conversione. Admin vede lead, reseller vede prospect.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['all', 'month', 'quarter'],
          description: 'Periodo di riferimento (default: all)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_entity_details',
    description:
      'Dettagli lead/prospect per ID o ricerca per nome. Include timeline eventi, score, preventivi collegati.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'UUID entita (opzionale se si usa search_name)',
        },
        search_name: {
          type: 'string',
          description: 'Nome azienda da cercare (ricerca parziale)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_crm_health_alerts',
    description:
      'Alert salute CRM: prospect stale, lead caldi non contattati, candidati win-back, quote in scadenza.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_today_actions',
    description:
      'Lista prioritizzata di azioni da fare oggi: chi contattare, follow-up, quote in scadenza, lead caldi.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_crm_entities',
    description:
      'Cerca lead/prospect per nome, email, settore o stato. Utile per "trova tutti i prospect ecommerce" o "lead in negoziazione".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Testo da cercare (nome azienda)',
        },
        status: {
          type: 'string',
          description:
            'Filtro stato (new, contacted, qualified, negotiation, won, lost, quote_sent, negotiating)',
        },
        sector: {
          type: 'string',
          description:
            'Filtro settore (ecommerce, food, pharma, artigianato, industria, logistica)',
        },
      },
      required: [],
    },
  },
  // ═══════════════════════════════════════════════════════════════════
  // CRM TOOLS — Write (Sprint S2)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'update_crm_status',
    description:
      'Aggiorna lo stato di un lead/prospect nella pipeline CRM. Valida le transizioni ammesse.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'ID del lead/prospect (se noto)',
        },
        entity_name: {
          type: 'string',
          description: 'Nome azienda del lead/prospect (cercato se entity_id non fornito)',
        },
        new_status: {
          type: 'string',
          description:
            'Nuovo stato: contacted, qualified, negotiation, won, lost, quote_sent, negotiating',
        },
        lost_reason: {
          type: 'string',
          description: 'Motivazione perdita (solo se new_status=lost)',
        },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'add_crm_note',
    description:
      'Aggiunge una nota testuale a un lead/prospect. La nota viene salvata con timestamp.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'ID del lead/prospect (se noto)',
        },
        entity_name: {
          type: 'string',
          description: 'Nome azienda del lead/prospect (cercato se entity_id non fornito)',
        },
        note: {
          type: 'string',
          description: 'Testo della nota da aggiungere',
        },
      },
      required: ['note'],
    },
  },
  {
    name: 'record_crm_contact',
    description:
      'Registra un contatto avvenuto con un lead/prospect. Aggiorna data ultimo contatto e auto-avanza lo stato se new.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'ID del lead/prospect (se noto)',
        },
        entity_name: {
          type: 'string',
          description: 'Nome azienda del lead/prospect (cercato se entity_id non fornito)',
        },
        contact_note: {
          type: 'string',
          description: 'Nota opzionale sul contatto avvenuto',
        },
      },
      required: [],
    },
  },
];

/**
 * Esegue un tool call
 *
 * ✨ M3: Aggiunto workspaceId per isolamento multi-tenant nel pricing
 */
export async function executeTool(
  toolCall: ToolCall,
  userId: string,
  userRole: 'admin' | 'user',
  workspaceId?: string
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    switch (toolCall.name) {
      case 'fill_shipment_form': {
        // Valida dati
        const errors: string[] = [];

        if (!toolCall.arguments.recipient_name) {
          errors.push('Nome destinatario obbligatorio');
        }
        if (
          !toolCall.arguments.recipient_postal_code ||
          !/^\d{5}$/.test(toolCall.arguments.recipient_postal_code)
        ) {
          errors.push('CAP deve essere di 5 cifre');
        }
        if (
          !toolCall.arguments.recipient_province ||
          !/^[A-Z]{2}$/i.test(toolCall.arguments.recipient_province)
        ) {
          errors.push('Provincia deve essere di 2 lettere (es. "RM")');
        }
        if (
          !toolCall.arguments.weight ||
          toolCall.arguments.weight <= 0 ||
          toolCall.arguments.weight > 200
        ) {
          errors.push('Peso deve essere tra 0.1 e 200 kg');
        }

        if (errors.length > 0) {
          return {
            success: false,
            result: null,
            error: `Errori validazione: ${errors.join(', ')}`,
          };
        }

        // Restituisci dati strutturati
        return {
          success: true,
          result: {
            formData: {
              recipient_name: toolCall.arguments.recipient_name,
              recipient_address: toolCall.arguments.recipient_address || '',
              recipient_city: toolCall.arguments.recipient_city,
              recipient_postal_code: toolCall.arguments.recipient_postal_code,
              recipient_province: toolCall.arguments.recipient_province.toUpperCase(),
              recipient_phone: toolCall.arguments.recipient_phone || '',
              recipient_email: toolCall.arguments.recipient_email || '',
              weight: toolCall.arguments.weight,
              packages: toolCall.arguments.packages || 1,
              cashOnDelivery: toolCall.arguments.cashOnDelivery || 0,
              declaredValue: toolCall.arguments.declaredValue || 0,
              notes: toolCall.arguments.notes || '',
            },
            message: 'Form compilato correttamente. Dati pronti per creazione spedizione.',
          },
        };
      }

      case 'calculate_price': {
        const pricingRequest: PricingRequest = {
          weight: toolCall.arguments.weight,
          destinationZip: toolCall.arguments.destinationZip,
          destinationProvince: toolCall.arguments.destinationProvince,
          serviceType: toolCall.arguments.serviceType,
          cashOnDelivery: toolCall.arguments.cashOnDelivery,
          declaredValue: toolCall.arguments.declaredValue,
        };

        const results = await calculateOptimalPrice(pricingRequest);

        if (results.length === 0) {
          return {
            success: false,
            result: null,
            error: 'Nessun corriere disponibile per questa destinazione',
          };
        }

        return {
          success: true,
          result: {
            options: results.slice(0, 3), // Top 3 opzioni
            bestOption: results[0],
            message: `Trovate ${results.length} opzioni. Migliore: ${results[0].courier} a €${results[0].finalPrice.toFixed(2)}`,
          },
        };
      }

      case 'track_shipment': {
        const trackingNumber = toolCall.arguments.trackingNumber;

        const { data: shipment, error } = await supabaseAdmin
          .from('shipments')
          .select('*, shipment_events(*)')
          .eq('tracking_number', trackingNumber)
          .single();

        if (error || !shipment) {
          return {
            success: false,
            result: null,
            error: 'Spedizione non trovata',
          };
        }

        // Verifica che l'utente abbia accesso (se non admin, solo proprie spedizioni)
        if (userRole !== 'admin' && shipment.user_id !== userId) {
          return {
            success: false,
            result: null,
            error: 'Non autorizzato a visualizzare questa spedizione',
          };
        }

        return {
          success: true,
          result: {
            tracking: shipment.tracking_number,
            status: shipment.status,
            recipient: shipment.recipient_name,
            city: shipment.recipient_city,
            events: shipment.shipment_events || [],
            createdAt: shipment.created_at,
            updatedAt: shipment.updated_at,
          },
        };
      }

      case 'analyze_business_health': {
        if (userRole !== 'admin') {
          return {
            success: false,
            result: null,
            error: 'Funzione disponibile solo per admin',
          };
        }

        const period = toolCall.arguments.period || 'month';
        const compareWithPrevious = toolCall.arguments.compareWithPrevious || false;

        const now = new Date();
        let periodStart: Date;

        switch (period) {
          case 'today':
            periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            break;
          default:
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const { data: shipments, error } = await supabaseAdmin
          .from('shipments')
          .select('final_price, base_price, created_at, carrier')
          .gte('created_at', periodStart.toISOString());

        if (error) {
          return {
            success: false,
            result: null,
            error: `Errore recupero dati: ${error.message}`,
          };
        }

        const totalRevenue =
          shipments?.reduce((sum, s) => sum + (parseFloat(s.final_price) || 0), 0) || 0;
        const totalCost =
          shipments?.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0) || 0;
        const totalMargin = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

        const analysis = {
          period,
          totalShipments: shipments?.length || 0,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          marginPercent: Math.round(marginPercent * 100) / 100,
          avgMarginPerShipment:
            shipments && shipments.length > 0
              ? Math.round((totalMargin / shipments.length) * 100) / 100
              : 0,
        };

        // Confronto con periodo precedente se richiesto
        if (compareWithPrevious && shipments) {
          const previousPeriodStart = new Date(
            periodStart.getTime() - (now.getTime() - periodStart.getTime())
          );
          const { data: previousShipments } = await supabaseAdmin
            .from('shipments')
            .select('final_price, base_price')
            .gte('created_at', previousPeriodStart.toISOString())
            .lt('created_at', periodStart.toISOString());

          if (previousShipments) {
            const prevRevenue = previousShipments.reduce(
              (sum, s) => sum + (parseFloat(s.final_price) || 0),
              0
            );
            const prevMargin =
              prevRevenue -
              previousShipments.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0);

            (analysis as any).comparison = {
              revenueChange: Math.round((totalRevenue - prevRevenue) * 100) / 100,
              revenueChangePercent:
                prevRevenue > 0
                  ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100 * 100) / 100
                  : 0,
              marginChange: Math.round((totalMargin - prevMargin) * 100) / 100,
              marginChangePercent:
                prevMargin > 0
                  ? Math.round(((totalMargin - prevMargin) / prevMargin) * 100 * 100) / 100
                  : 0,
            };
          }
        }

        return {
          success: true,
          result: analysis,
        };
      }

      case 'check_error_logs': {
        if (userRole !== 'admin') {
          return {
            success: false,
            result: null,
            error: 'Funzione disponibile solo per admin',
          };
        }

        const severity = toolCall.arguments.severity;
        const hours = toolCall.arguments.hours || 24;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        let query = supabaseAdmin
          .from('audit_logs')
          .select('*')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        if (severity) {
          query = query.eq('severity', severity);
        }

        const { data: errors, error } = await query;

        if (error) {
          return {
            success: false,
            result: null,
            error: `Errore recupero log: ${error.message}`,
          };
        }

        const criticalCount = errors?.filter((e: any) => e.severity === 'critical').length || 0;
        const errorCount = errors?.filter((e: any) => e.severity === 'error').length || 0;

        return {
          success: true,
          result: {
            total: errors?.length || 0,
            critical: criticalCount,
            errors: errorCount,
            warnings: (errors?.length || 0) - criticalCount - errorCount,
            logs:
              errors?.slice(0, 10).map((e: any) => ({
                severity: e.severity,
                message: e.message,
                timestamp: e.created_at,
                endpoint: e.endpoint,
              })) || [],
            health: criticalCount > 0 ? 'critical' : errorCount > 5 ? 'degraded' : 'healthy',
          },
        };
      }

      case 'create_batch_shipments': {
        const { parseShipmentsData, createBatchShipments } =
          await import('./tools/shipments-batch');

        try {
          // Parse CSV data
          const shipmentsData = parseShipmentsData(toolCall.arguments.csvData);

          if (shipmentsData.length === 0) {
            return {
              success: false,
              result: null,
              error:
                'Nessuna spedizione valida trovata nel file. Verifica che contenga le colonne obbligatorie: nome, indirizzo, città, cap, peso',
            };
          }

          console.log(`📦 [ANNE BATCH] Trovate ${shipmentsData.length} spedizioni da creare`);

          // Crea spedizioni in batch
          const result = await createBatchShipments(
            shipmentsData,
            userId,
            toolCall.arguments.defaultSender
          );

          return {
            success: true,
            result: {
              summary: `✅ Batch completato: ${result.created} spedizioni create su ${result.totalShipments} totali`,
              statistics: {
                total: result.totalShipments,
                created: result.created,
                failed: result.failed,
                totalCost: `€${result.totalCost.toFixed(2)}`,
                totalSavings: `€${result.totalSavings.toFixed(2)}`,
                averageSavings: `€${result.summary.averageSavings.toFixed(2)} per spedizione`,
              },
              byCourer: result.summary.byCourer,
              shipments: result.shipments,
              successRate: `${Math.round((result.created / result.totalShipments) * 100)}%`,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            result: null,
            error: `Errore creazione batch: ${error.message}`,
          };
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PRICING TOOLS - Accesso atomizzato ai listini
      // ═══════════════════════════════════════════════════════════════════════

      case 'get_price_list_details': {
        const { priceListId, courierId } = toolCall.arguments;

        let priceList = null;

        if (priceListId) {
          // Cerca per ID specifico
          priceList = await getPriceListById(priceListId);
        } else {
          // Cerca listino attivo per utente (e opzionalmente corriere)
          const { data: lists } = await supabaseAdmin
            .from('price_lists')
            .select('*')
            .eq('status', 'active')
            .or(`assigned_to_user_id.eq.${userId},list_type.eq.global`)
            .order('created_at', { ascending: false });

          if (lists && lists.length > 0) {
            // Se specificato corriere, filtra
            if (courierId) {
              priceList = lists.find((l: any) => l.courier_id === courierId) || lists[0];
            } else {
              priceList = lists[0];
            }
          }
        }

        if (!priceList) {
          return {
            success: false,
            result: null,
            error: 'Nessun listino trovato',
          };
        }

        // Se è un listino custom, recupera anche il master (fornitore)
        let masterList = null;
        if (priceList.master_list_id) {
          masterList = await getPriceListById(priceList.master_list_id);
        }

        // Recupera info corriere
        let courierInfo = null;
        if (priceList.courier_id) {
          const { data: courier } = await supabaseAdmin
            .from('couriers')
            .select('id, name, code')
            .eq('id', priceList.courier_id)
            .single();
          courierInfo = courier;
        }

        return {
          success: true,
          result: {
            listino: {
              id: priceList.id,
              nome: priceList.name,
              tipo: priceList.list_type,
              stato: priceList.status,
              corriere: courierInfo?.name || 'N/A',
              corriereId: priceList.courier_id,
            },
            margine: {
              percentuale: priceList.default_margin_percent ?? 0,
              fisso: priceList.default_margin_fixed ?? 0,
              tipo: priceList.default_margin_percent
                ? 'percentuale'
                : priceList.default_margin_fixed
                  ? 'fisso'
                  : 'nessuno',
            },
            listinoFornitore: masterList
              ? {
                  id: masterList.id,
                  nome: masterList.name,
                  collegato: true,
                }
              : { collegato: false },
            regole: (priceList.rules as any[])?.length || 0,
            validita: {
              da: priceList.valid_from || 'sempre',
              a: priceList.valid_until || 'sempre',
            },
            vatMode: priceList.vat_mode || 'excluded',
          },
        };
      }

      case 'get_supplier_cost': {
        const { weight, destinationZip, destinationProvince, courierId, serviceType } =
          toolCall.arguments;

        // Trova listini fornitore (master/supplier)
        let query = supabaseAdmin
          .from('price_lists')
          .select('*, entries:price_list_entries(*)')
          .eq('status', 'active')
          .in('list_type', ['supplier', 'master']);

        if (courierId) {
          query = query.eq('courier_id', courierId);
        }

        const { data: supplierLists, error } = await query;

        if (error || !supplierLists || supplierLists.length === 0) {
          return {
            success: false,
            result: null,
            error: 'Nessun listino fornitore trovato',
          };
        }

        const results: any[] = [];

        for (const list of supplierLists) {
          // Recupera info corriere
          const { data: courier } = await supabaseAdmin
            .from('couriers')
            .select('id, name, code')
            .eq('id', list.courier_id)
            .single();

          const priceResult = calculatePriceFromList(
            list,
            weight,
            destinationZip,
            serviceType || 'standard'
          );

          if (priceResult) {
            results.push({
              corriere: courier?.name || list.name,
              corriereId: list.courier_id,
              costoFornitore: {
                base: Math.round(priceResult.basePrice * 100) / 100,
                supplementi: Math.round(priceResult.surcharges * 100) / 100,
                totale: Math.round(priceResult.totalCost * 100) / 100,
              },
              tempiConsegna: priceResult.details?.estimatedDeliveryDays || null,
              listinoId: list.id,
              listinoNome: list.name,
            });
          }
        }

        if (results.length === 0) {
          return {
            success: false,
            result: null,
            error: 'Nessun prezzo trovato per questa tratta',
          };
        }

        // Ordina per costo
        results.sort((a, b) => a.costoFornitore.totale - b.costoFornitore.totale);

        return {
          success: true,
          result: {
            parametri: {
              peso: weight,
              destinazione: `${destinationZip} ${destinationProvince}`,
              servizio: serviceType || 'standard',
            },
            costiFornitore: results,
            piuEconomico: results[0],
            message: `Costo fornitore più basso: ${results[0].corriere} a €${results[0].costoFornitore.totale.toFixed(2)}`,
          },
        };
      }

      case 'list_user_price_lists': {
        const targetUserId = toolCall.arguments.targetUserId || userId;
        const includeInactive = toolCall.arguments.includeInactive || false;

        // Verifica permessi: solo admin può vedere listini altri utenti
        if (targetUserId !== userId && userRole !== 'admin') {
          return {
            success: false,
            result: null,
            error: 'Non autorizzato a visualizzare listini di altri utenti',
          };
        }

        // Query listini assegnati
        let query = supabaseAdmin
          .from('price_lists')
          .select('*, courier:couriers(id, name, code)')
          .or(`assigned_to_user_id.eq.${targetUserId},list_type.eq.global`);

        if (!includeInactive) {
          query = query.eq('status', 'active');
        }

        const { data: priceLists, error } = await query.order('created_at', { ascending: false });

        if (error) {
          return {
            success: false,
            result: null,
            error: `Errore recupero listini: ${error.message}`,
          };
        }

        // Cerca anche assegnazioni tramite price_list_assignments
        const { data: assignments } = await supabaseAdmin
          .from('price_list_assignments')
          .select('price_list_id')
          .eq('user_id', targetUserId)
          .is('revoked_at', null);

        // Recupera listini da assignments
        let assignedLists: any[] = [];
        if (assignments && assignments.length > 0) {
          const assignedIds = assignments.map((a) => a.price_list_id);
          const { data: additionalLists } = await supabaseAdmin
            .from('price_lists')
            .select('*, courier:couriers(id, name, code)')
            .in('id', assignedIds);

          if (additionalLists) {
            assignedLists = additionalLists;
          }
        }

        // Combina e deduplica
        const allLists = [...(priceLists || []), ...assignedLists];
        const uniqueLists = allLists.filter(
          (list, index, self) => index === self.findIndex((l) => l.id === list.id)
        );

        const listini = uniqueLists.map((list: any) => ({
          id: list.id,
          nome: list.name,
          tipo: list.list_type,
          stato: list.status,
          corriere: list.courier?.name || 'N/A',
          corriereId: list.courier_id,
          marginePercentuale: list.default_margin_percent ?? 0,
          margineFisso: list.default_margin_fixed ?? 0,
          hasMaster: !!list.master_list_id,
          validoDa: list.valid_from,
          validoA: list.valid_until,
        }));

        // Raggruppa per corriere
        const perCorriere: Record<string, any[]> = {};
        listini.forEach((l) => {
          const key = l.corriere || 'Altro';
          if (!perCorriere[key]) perCorriere[key] = [];
          perCorriere[key].push(l);
        });

        return {
          success: true,
          result: {
            totaleListini: listini.length,
            listini,
            perCorriere,
            corrieriAttivi: Object.keys(perCorriere),
            message: `Trovati ${listini.length} listini attivi per ${Object.keys(perCorriere).length} corrieri`,
          },
        };
      }

      case 'compare_supplier_vs_selling': {
        const { weight, destinationZip, destinationProvince, courierId, priceListId } =
          toolCall.arguments;

        const results: any[] = [];

        // 1. Trova listino/i personalizzato/i dell'utente
        let customListsQuery = supabaseAdmin
          .from('price_lists')
          .select('*, courier:couriers(id, name, code)')
          .eq('status', 'active')
          .eq('list_type', 'custom')
          .or(`assigned_to_user_id.eq.${userId},list_type.eq.global`);

        if (priceListId) {
          customListsQuery = supabaseAdmin
            .from('price_lists')
            .select('*, courier:couriers(id, name, code)')
            .eq('id', priceListId);
        } else if (courierId) {
          customListsQuery = customListsQuery.eq('courier_id', courierId);
        }

        const { data: customLists } = await customListsQuery;

        if (!customLists || customLists.length === 0) {
          return {
            success: false,
            result: null,
            error: 'Nessun listino personalizzato trovato',
          };
        }

        for (const customList of customLists) {
          // Calcola prezzo con regole (include margine)
          // ✨ M3: Passa workspaceId (usa fallback empty string se non disponibile)
          const sellingPrice = await calculatePriceWithRules(userId, workspaceId || '', {
            weight,
            destination: {
              zip: destinationZip,
              province: destinationProvince,
              country: 'IT',
            },
          });

          if (!sellingPrice) continue;

          // Il supplierPrice viene dal calcolo
          const supplierCost = sellingPrice.supplierPrice || sellingPrice.totalCost;
          const finalPrice = sellingPrice.finalPrice;
          const marginAmount = finalPrice - supplierCost;
          const marginPercent = supplierCost > 0 ? (marginAmount / supplierCost) * 100 : 0;

          results.push({
            corriere: customList.courier?.name || customList.name,
            corriereId: customList.courier_id,
            listino: {
              id: customList.id,
              nome: customList.name,
              margineConfigurato: customList.default_margin_percent ?? 0,
            },
            costoFornitore: Math.round(supplierCost * 100) / 100,
            prezzoVendita: Math.round(finalPrice * 100) / 100,
            margine: {
              euro: Math.round(marginAmount * 100) / 100,
              percentuale: Math.round(marginPercent * 100) / 100,
            },
            dettagli: {
              basePrice: sellingPrice.basePrice,
              surcharges: sellingPrice.surcharges,
            },
          });
        }

        if (results.length === 0) {
          return {
            success: false,
            result: null,
            error: 'Impossibile calcolare confronto per questa tratta',
          };
        }

        // Ordina per margine
        results.sort((a, b) => b.margine.euro - a.margine.euro);

        const totaleFornitore = results.reduce((sum, r) => sum + r.costoFornitore, 0);
        const totaleVendita = results.reduce((sum, r) => sum + r.prezzoVendita, 0);
        const totaleMargine = totaleVendita - totaleFornitore;

        return {
          success: true,
          result: {
            parametri: {
              peso: weight,
              destinazione: `${destinationZip} ${destinationProvince}`,
            },
            confronti: results,
            riepilogo: {
              corrieriAnalizzati: results.length,
              margineMedio: {
                euro: Math.round((totaleMargine / results.length) * 100) / 100,
                percentuale: Math.round((totaleMargine / totaleFornitore) * 100 * 100) / 100 || 0,
              },
              migliorePerMargine: results[0],
            },
            message: `Margine medio: €${(totaleMargine / results.length).toFixed(2)} (${((totaleMargine / totaleFornitore) * 100).toFixed(1)}%)`,
          },
        };
      }

      // ═══════════════════════════════════════════════════════════════════
      // SUPPORT TOOLS - Delegati a support-tools.ts
      // ═══════════════════════════════════════════════════════════════════
      case 'get_shipment_status':
      case 'manage_hold':
      case 'cancel_shipment':
      case 'process_refund':
      case 'force_refresh_tracking':
      case 'check_wallet_status':
      case 'diagnose_shipment_issue':
      case 'escalate_to_human': {
        return await executeSupportTool(toolCall, userId, userRole);
      }

      // ═══════════════════════════════════════════════════════════
      // CRM TOOLS — Read-only (Sprint S1)
      // ═══════════════════════════════════════════════════════════
      case 'get_pipeline_summary': {
        const { getPipelineSummary, getConversionMetrics } =
          await import('@/lib/crm/crm-data-service');
        const [summary, metrics] = await Promise.all([
          getPipelineSummary(userRole, workspaceId),
          getConversionMetrics(userRole, workspaceId),
        ]);
        return { success: true, result: { summary, metrics } };
      }

      case 'get_entity_details': {
        const { getEntityDetail } = await import('@/lib/crm/crm-data-service');
        const detail = await getEntityDetail(
          userRole,
          toolCall.arguments.entity_id,
          toolCall.arguments.search_name,
          workspaceId
        );
        if (!detail) {
          return { success: false, result: null, error: 'Entita non trovata' };
        }
        return { success: true, result: detail };
      }

      case 'get_crm_health_alerts': {
        const { getHealthAlerts } = await import('@/lib/crm/crm-data-service');
        const alerts = await getHealthAlerts(userRole, workspaceId);
        return { success: true, result: { alerts, count: alerts.length } };
      }

      case 'get_today_actions': {
        const { getTodayActions } = await import('@/lib/crm/crm-data-service');
        const actions = await getTodayActions(userRole, workspaceId);
        return { success: true, result: { actions, count: actions.length } };
      }

      case 'search_crm_entities': {
        const { searchEntities } = await import('@/lib/crm/crm-data-service');
        const results = await searchEntities(
          userRole,
          toolCall.arguments.query || '',
          {
            status: toolCall.arguments.status,
            sector: toolCall.arguments.sector,
          },
          workspaceId
        );
        return { success: true, result: { results, count: results.length } };
      }

      // ═══════════════════════════════════════════════════════════
      // CRM TOOLS — Write (Sprint S2)
      // ═══════════════════════════════════════════════════════════
      case 'update_crm_status': {
        const writeService = await import('@/lib/crm/crm-write-service');
        // Risolvi entity_id da nome se necessario
        let entityId = toolCall.arguments.entity_id;
        if (!entityId && toolCall.arguments.entity_name) {
          const { getEntityDetail } = await import('@/lib/crm/crm-data-service');
          const detail = await getEntityDetail(
            userRole,
            undefined,
            toolCall.arguments.entity_name,
            workspaceId
          );
          if (!detail) {
            return {
              success: false,
              result: null,
              error: `Lead/prospect "${toolCall.arguments.entity_name}" non trovato`,
            };
          }
          entityId = detail.id;
        }
        if (!entityId) {
          return { success: false, result: null, error: 'Specificare entity_id o entity_name' };
        }
        const statusResult = await writeService.updateEntityStatus({
          role: userRole,
          entityId,
          newStatus: toolCall.arguments.new_status,
          actorId: userId,
          workspaceId,
          lostReason: toolCall.arguments.lost_reason,
        });
        return { success: statusResult.success, result: statusResult, error: statusResult.error };
      }

      case 'add_crm_note': {
        const writeService = await import('@/lib/crm/crm-write-service');
        let entityId = toolCall.arguments.entity_id;
        if (!entityId && toolCall.arguments.entity_name) {
          const { getEntityDetail } = await import('@/lib/crm/crm-data-service');
          const detail = await getEntityDetail(
            userRole,
            undefined,
            toolCall.arguments.entity_name,
            workspaceId
          );
          if (!detail) {
            return {
              success: false,
              result: null,
              error: `Lead/prospect "${toolCall.arguments.entity_name}" non trovato`,
            };
          }
          entityId = detail.id;
        }
        if (!entityId) {
          return { success: false, result: null, error: 'Specificare entity_id o entity_name' };
        }
        const noteResult = await writeService.addEntityNote({
          role: userRole,
          entityId,
          note: toolCall.arguments.note,
          actorId: userId,
          workspaceId,
        });
        return { success: noteResult.success, result: noteResult, error: noteResult.error };
      }

      case 'record_crm_contact': {
        const writeService = await import('@/lib/crm/crm-write-service');
        let entityId = toolCall.arguments.entity_id;
        if (!entityId && toolCall.arguments.entity_name) {
          const { getEntityDetail } = await import('@/lib/crm/crm-data-service');
          const detail = await getEntityDetail(
            userRole,
            undefined,
            toolCall.arguments.entity_name,
            workspaceId
          );
          if (!detail) {
            return {
              success: false,
              result: null,
              error: `Lead/prospect "${toolCall.arguments.entity_name}" non trovato`,
            };
          }
          entityId = detail.id;
        }
        if (!entityId) {
          return { success: false, result: null, error: 'Specificare entity_id o entity_name' };
        }
        const contactResult = await writeService.recordEntityContact({
          role: userRole,
          entityId,
          contactNote: toolCall.arguments.contact_note,
          actorId: userId,
          workspaceId,
        });
        return {
          success: contactResult.success,
          result: contactResult,
          error: contactResult.error,
        };
      }

      default:
        return {
          success: false,
          result: null,
          error: `Tool sconosciuto: ${toolCall.name}`,
        };
    }
  } catch (error: any) {
    console.error(`Errore esecuzione tool ${toolCall.name}:`, error);
    return {
      success: false,
      result: null,
      error: error.message || 'Errore sconosciuto',
    };
  }
}
