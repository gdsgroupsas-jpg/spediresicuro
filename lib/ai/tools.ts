/**
 * Tools per Anne
 * 
 * Funzioni che Anne può chiamare per eseguire azioni concrete:
 * - fill_shipment_form: Compila form spedizione
 * - calculate_price: Calcola prezzo spedizione
 * - track_shipment: Traccia spedizione
 * - analyze_business_health: Analizza salute business (solo admin)
 * - check_error_logs: Controlla errori sistema (solo admin)
 */

import { calculateOptimalPrice, PricingRequest } from './pricing-engine';
import { supabaseAdmin } from '@/lib/db/client';
import { buildContext, formatContextForPrompt } from './context-builder';

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
    description: 'Compila automaticamente il form di creazione spedizione con i dati estratti dalla conversazione. Restituisce i dati strutturati pronti per l\'inserimento.',
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
      required: ['recipient_name', 'recipient_address', 'recipient_city', 'recipient_postal_code', 'recipient_province', 'weight'],
    },
  },
  {
    name: 'calculate_price',
    description: 'Calcola il prezzo ottimale per una spedizione. Restituisce i migliori corrieri disponibili con prezzi e tempi di consegna.',
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
    description: 'Traccia una spedizione tramite tracking number. Restituisce lo stato attuale e la cronologia eventi.',
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
    description: 'Analizza la salute del business: margini, trend, performance corrieri, confronto periodi. Disponibile solo per admin.',
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
];

/**
 * Esegue un tool call
 */
export async function executeTool(
  toolCall: ToolCall,
  userId: string,
  userRole: 'admin' | 'user'
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    switch (toolCall.name) {
      case 'fill_shipment_form': {
        // Valida dati
        const errors: string[] = [];
        
        if (!toolCall.arguments.recipient_name) {
          errors.push('Nome destinatario obbligatorio');
        }
        if (!toolCall.arguments.recipient_postal_code || !/^\d{5}$/.test(toolCall.arguments.recipient_postal_code)) {
          errors.push('CAP deve essere di 5 cifre');
        }
        if (!toolCall.arguments.recipient_province || !/^[A-Z]{2}$/i.test(toolCall.arguments.recipient_province)) {
          errors.push('Provincia deve essere di 2 lettere (es. "RM")');
        }
        if (!toolCall.arguments.weight || toolCall.arguments.weight <= 0 || toolCall.arguments.weight > 200) {
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
        
        const totalRevenue = shipments?.reduce((sum, s) => sum + (parseFloat(s.final_price) || 0), 0) || 0;
        const totalCost = shipments?.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0) || 0;
        const totalMargin = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
        
        const analysis = {
          period,
          totalShipments: shipments?.length || 0,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          marginPercent: Math.round(marginPercent * 100) / 100,
          avgMarginPerShipment: shipments && shipments.length > 0 
            ? Math.round((totalMargin / shipments.length) * 100) / 100 
            : 0,
        };
        
        // Confronto con periodo precedente se richiesto
        if (compareWithPrevious && shipments) {
          const previousPeriodStart = new Date(periodStart.getTime() - (now.getTime() - periodStart.getTime()));
          const { data: previousShipments } = await supabaseAdmin
            .from('shipments')
            .select('final_price, base_price')
            .gte('created_at', previousPeriodStart.toISOString())
            .lt('created_at', periodStart.toISOString());
          
          if (previousShipments) {
            const prevRevenue = previousShipments.reduce((sum, s) => sum + (parseFloat(s.final_price) || 0), 0);
            const prevMargin = prevRevenue - previousShipments.reduce((sum, s) => sum + (parseFloat(s.base_price) || 0), 0);
            
            (analysis as any).comparison = {
              revenueChange: Math.round((totalRevenue - prevRevenue) * 100) / 100,
              revenueChangePercent: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100 * 100) / 100 : 0,
              marginChange: Math.round((totalMargin - prevMargin) * 100) / 100,
              marginChangePercent: prevMargin > 0 ? Math.round(((totalMargin - prevMargin) / prevMargin) * 100 * 100) / 100 : 0,
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
            logs: errors?.slice(0, 10).map((e: any) => ({
              severity: e.severity,
              message: e.message,
              timestamp: e.created_at,
              endpoint: e.endpoint,
            })) || [],
            health: criticalCount > 0 ? 'critical' : errorCount > 5 ? 'degraded' : 'healthy',
          },
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


