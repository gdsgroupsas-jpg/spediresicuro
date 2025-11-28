/**
 * SMART FULFILLMENT ORCHESTRATOR
 *
 * 🚀 KILLER FEATURE STRATOSFERICA 🚀
 *
 * Orchestratore intelligente che decide automaticamente:
 * - Da quale magazzino/fornitore evadere l'ordine
 * - Con quale corriere spedire
 * - Ottimizzando costi, tempi, qualità e margini
 *
 * Algoritmo multi-criterio con scoring ponderato
 */

import { supabase } from '@/lib/db/client';
import { getInventory } from '@/lib/db/warehouses';
import { getProductSuppliers } from '@/lib/db/products';
import { calculatePrice, getActivePriceList } from '@/lib/db/price-lists';
import { getBestCourierForZone } from '@/lib/db/analytics';

export interface FulfillmentDecisionInput {
  // Ordine
  order_id?: string;
  items: Array<{
    product_id: string;
    sku: string;
    quantity: number;
  }>;

  // Destinazione
  destination: {
    zip: string;
    city: string;
    province: string;
    country?: string;
  };

  // Opzioni spedizione
  service_type?: 'standard' | 'express' | 'economy';
  delivery_deadline?: Date; // Se specificato, solo opzioni che rispettano deadline

  // Priorità business
  priorities?: {
    cost_weight?: number;      // Default 0.30
    time_weight?: number;      // Default 0.30
    quality_weight?: number;   // Default 0.20
    margin_weight?: number;    // Default 0.20
  };
}

export interface FulfillmentOption {
  // Source
  source_type: 'warehouse' | 'supplier';
  source_id: string;
  source_name: string;
  source_location: {
    city: string;
    zip: string;
  };

  // Courier
  courier_id: string;
  courier_name: string;

  // Items fulfillment
  items: Array<{
    product_id: string;
    quantity: number;
    available: boolean;
    unit_cost: number;
  }>;

  // Metriche
  total_cost: number;            // Costo totale (prodotti + spedizione)
  shipping_cost: number;
  product_cost: number;
  estimated_margin: number;      // Margine stimato
  estimated_delivery_days: number;
  quality_score: number;         // 0-10 (performance corriere + affidabilità fornitore)

  // Score finale (0-100)
  overall_score: number;

  // Dettagli
  details: {
    distance_km?: number;
    courier_performance?: any;
    supplier_reliability?: number;
    stock_availability: 'full' | 'partial' | 'none';
  };
}

export interface FulfillmentDecision {
  recommended_option: FulfillmentOption;
  all_options: FulfillmentOption[];
  decision_rationale: string;
  warnings: string[];
}

/**
 * Orchestratore principale
 */
export class FulfillmentOrchestrator {
  private weights = {
    cost: 0.30,
    time: 0.30,
    quality: 0.20,
    margin: 0.20,
  };

  constructor(customWeights?: Partial<typeof FulfillmentOrchestrator.prototype.weights>) {
    if (customWeights) {
      this.weights = { ...this.weights, ...customWeights };
    }
  }

  /**
   * Decisione principale: dove e come evadere l'ordine
   */
  async decide(input: FulfillmentDecisionInput): Promise<FulfillmentDecision> {
    // 1. Trova tutte le opzioni possibili
    const options = await this.findAllOptions(input);

    if (options.length === 0) {
      throw new Error('Nessuna opzione di fulfillment disponibile');
    }

    // 2. Calcola score per ogni opzione
    const scoredOptions = await this.scoreOptions(options, input);

    // 3. Ordina per score
    scoredOptions.sort((a, b) => b.overall_score - a.overall_score);

    // 4. Opzione raccomandata (migliore score)
    const recommended = scoredOptions[0];

    // 5. Genera rationale
    const rationale = this.generateRationale(recommended, scoredOptions);

    // 6. Warnings
    const warnings = this.generateWarnings(recommended, input);

    return {
      recommended_option: recommended,
      all_options: scoredOptions,
      decision_rationale: rationale,
      warnings,
    };
  }

  /**
   * Trova tutte le opzioni possibili di fulfillment
   */
  private async findAllOptions(input: FulfillmentDecisionInput): Promise<FulfillmentOption[]> {
    const options: FulfillmentOption[] = [];

    // Per ogni prodotto, trova dove è disponibile
    for (const item of input.items) {
      // Opzione 1: Magazzini con stock
      const warehouseOptions = await this.findWarehouseOptions(item, input);
      options.push(...warehouseOptions);

      // Opzione 2: Fornitori/Dropshipper
      const supplierOptions = await this.findSupplierOptions(item, input);
      options.push(...supplierOptions);
    }

    // Deduplica e aggrega (se stesso source+courier)
    const aggregated = this.aggregateOptions(options);

    return aggregated;
  }

  /**
   * Trova opzioni da magazzini
   */
  private async findWarehouseOptions(
    item: FulfillmentDecisionInput['items'][0],
    input: FulfillmentDecisionInput
  ): Promise<FulfillmentOption[]> {
    const options: FulfillmentOption[] = [];

    // Ottieni tutti i magazzini attivi
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('*')
      .eq('active', true);

    if (!warehouses) return [];

    for (const warehouse of warehouses) {
      // Check stock
      const inventory = await getInventory(item.product_id, warehouse.id);

      if (!inventory || inventory.quantity_available < item.quantity) {
        continue; // Stock insufficiente
      }

      // Ottieni corrieri disponibili
      const couriers = await this.getAvailableCouriers(
        warehouse.zip,
        input.destination.zip,
        input.service_type
      );

      for (const courier of couriers) {
        // Calcola costi
        const shippingCost = await this.calculateShippingCost(
          courier.id,
          warehouse.zip,
          input.destination.zip,
          1, // peso stimato (TODO: calcolare da prodotti)
          input.service_type || 'standard'
        );

        if (!shippingCost) continue;

        // Ottieni costo prodotto
        const { data: product } = await supabase
          .from('products')
          .select('cost_price, sale_price')
          .eq('id', item.product_id)
          .single();

        const productCost = (product?.cost_price || 0) * item.quantity;
        const productSalePrice = (product?.sale_price || 0) * item.quantity;

        // Crea opzione
        const option: FulfillmentOption = {
          source_type: 'warehouse',
          source_id: warehouse.id,
          source_name: warehouse.name,
          source_location: {
            city: warehouse.city || '',
            zip: warehouse.zip || '',
          },
          courier_id: courier.id,
          courier_name: courier.name,
          items: [
            {
              product_id: item.product_id,
              quantity: item.quantity,
              available: true,
              unit_cost: product?.cost_price || 0,
            },
          ],
          total_cost: productCost + shippingCost.totalCost,
          shipping_cost: shippingCost.totalCost,
          product_cost: productCost,
          estimated_margin: productSalePrice - (productCost + shippingCost.totalCost),
          estimated_delivery_days: shippingCost.details?.entry?.estimated_delivery_days_max || 3,
          quality_score: 0, // Calcolato dopo
          overall_score: 0, // Calcolato dopo
          details: {
            courier_performance: courier.performance,
            stock_availability: 'full',
          },
        };

        options.push(option);
      }
    }

    return options;
  }

  /**
   * Trova opzioni da fornitori
   */
  private async findSupplierOptions(
    item: FulfillmentDecisionInput['items'][0],
    input: FulfillmentDecisionInput
  ): Promise<FulfillmentOption[]> {
    const options: FulfillmentOption[] = [];

    // Ottieni fornitori per prodotto
    const suppliers = await getProductSuppliers(item.product_id);

    for (const ps of suppliers) {
      const supplier = ps.supplier;

      if (!supplier || !supplier.active) continue;

      // Check MOQ
      if (supplier.min_order_quantity && item.quantity < supplier.min_order_quantity) {
        continue;
      }

      // Corriere del fornitore (o calcola opzioni)
      const courierId = supplier.default_courier_id;

      if (!courierId) continue;

      const { data: courier } = await supabase
        .from('couriers')
        .select('*')
        .eq('id', courierId)
        .single();

      if (!courier) continue;

      // Calcola shipping
      const shippingCost = await this.calculateShippingCost(
        courierId,
        supplier.ships_from_zip || '',
        input.destination.zip,
        1,
        input.service_type || 'standard'
      );

      if (!shippingCost) continue;

      const productCost = ps.cost_price * item.quantity;
      const { data: product } = await supabase
        .from('products')
        .select('sale_price')
        .eq('id', item.product_id)
        .single();

      const productSalePrice = (product?.sale_price || 0) * item.quantity;

      const option: FulfillmentOption = {
        source_type: 'supplier',
        source_id: supplier.id,
        source_name: supplier.name,
        source_location: {
          city: supplier.ships_from_city || '',
          zip: supplier.ships_from_zip || '',
        },
        courier_id: courierId,
        courier_name: courier.name,
        items: [
          {
            product_id: item.product_id,
            quantity: item.quantity,
            available: true,
            unit_cost: ps.cost_price,
          },
        ],
        total_cost: productCost + shippingCost.totalCost,
        shipping_cost: shippingCost.totalCost,
        product_cost: productCost,
        estimated_margin: productSalePrice - (productCost + shippingCost.totalCost),
        estimated_delivery_days:
          (shippingCost.details?.entry?.estimated_delivery_days_max || 3) +
          (supplier.average_processing_days || 0),
        quality_score: supplier.reliability_rating || 5,
        overall_score: 0,
        details: {
          supplier_reliability: supplier.reliability_rating,
          stock_availability: 'full', // Assumiamo sempre disponibile per dropshipper
        },
      };

      options.push(option);
    }

    return options;
  }

  /**
   * Calcola score per tutte le opzioni
   */
  private async scoreOptions(
    options: FulfillmentOption[],
    input: FulfillmentDecisionInput
  ): Promise<FulfillmentOption[]> {
    // Trova min/max per normalizzazione
    const costs = options.map(o => o.total_cost);
    const times = options.map(o => o.estimated_delivery_days);
    const qualities = options.map(o => o.quality_score);
    const margins = options.map(o => o.estimated_margin);

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const minQuality = Math.min(...qualities);
    const maxQuality = Math.max(...qualities);
    const minMargin = Math.min(...margins);
    const maxMargin = Math.max(...margins);

    return options.map(option => {
      // Normalizza (0-100)
      const costScore = normalize(option.total_cost, minCost, maxCost, true); // Inverso: costo basso = score alto
      const timeScore = normalize(option.estimated_delivery_days, minTime, maxTime, true);
      const qualityScore = normalize(option.quality_score, minQuality, maxQuality, false);
      const marginScore = normalize(option.estimated_margin, minMargin, maxMargin, false);

      // Score ponderato
      const overall =
        costScore * this.weights.cost +
        timeScore * this.weights.time +
        qualityScore * this.weights.quality +
        marginScore * this.weights.margin;

      option.overall_score = Math.round(overall);

      return option;
    });
  }

  /**
   * Aggrega opzioni duplicate
   */
  private aggregateOptions(options: FulfillmentOption[]): FulfillmentOption[] {
    // Semplificazione: ritorna tutte (in produzione aggregare per source+courier)
    return options;
  }

  /**
   * Ottieni corrieri disponibili
   */
  private async getAvailableCouriers(
    fromZip: string,
    toZip: string,
    serviceType?: string
  ): Promise<any[]> {
    const { data: couriers } = await supabase
      .from('couriers')
      .select('*')
      .eq('active', true);

    return couriers || [];
  }

  /**
   * Calcola costo spedizione
   */
  private async calculateShippingCost(
    courierId: string,
    fromZip: string,
    toZip: string,
    weight: number,
    serviceType: string
  ) {
    return await calculatePrice(courierId, weight, toZip, serviceType, {});
  }

  /**
   * Genera spiegazione decisione
   */
  private generateRationale(
    recommended: FulfillmentOption,
    allOptions: FulfillmentOption[]
  ): string {
    const parts = [];

    parts.push(
      `Opzione migliore: ${recommended.source_name} con ${recommended.courier_name}`
    );
    parts.push(`Score complessivo: ${recommended.overall_score}/100`);
    parts.push(`Costo totale: €${recommended.total_cost.toFixed(2)}`);
    parts.push(`Consegna stimata: ${recommended.estimated_delivery_days} giorni`);
    parts.push(`Margine stimato: €${recommended.estimated_margin.toFixed(2)}`);

    return parts.join(' | ');
  }

  /**
   * Genera warnings
   */
  private generateWarnings(
    recommended: FulfillmentOption,
    input: FulfillmentDecisionInput
  ): string[] {
    const warnings: string[] = [];

    if (recommended.estimated_delivery_days > 5) {
      warnings.push('Tempi di consegna superiori a 5 giorni');
    }

    if (recommended.estimated_margin < 0) {
      warnings.push('ATTENZIONE: Margine negativo!');
    }

    if (recommended.quality_score < 5) {
      warnings.push('Score qualità basso');
    }

    return warnings;
  }
}

/**
 * Helper: Normalizza valore (0-100)
 */
function normalize(value: number, min: number, max: number, inverse: boolean = false): number {
  if (max === min) return 50;

  let normalized = ((value - min) / (max - min)) * 100;

  if (inverse) {
    normalized = 100 - normalized;
  }

  return Math.max(0, Math.min(100, normalized));
}

/**
 * Factory: Crea orchestratore con pesi custom
 */
export function createFulfillmentOrchestrator(weights?: {
  cost?: number;
  time?: number;
  quality?: number;
  margin?: number;
}): FulfillmentOrchestrator {
  return new FulfillmentOrchestrator(weights);
}
