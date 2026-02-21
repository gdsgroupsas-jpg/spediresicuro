import { describe, it, expect } from 'vitest';

/**
 * Test unitari per l'aggregazione per-provider nella dashboard finanziaria.
 *
 * Questi test verificano la logica di aggregazione IN MEMORIA,
 * senza toccare DB, API o dati reali.
 * Tutti i dati sono mock fittizi (nomi inventati, UUID finti).
 */

// Estraiamo la logica di aggregazione per testarla indipendentemente dalla query Supabase
interface ShipmentRow {
  courier_config_id: string;
  base_price: number;
  final_price: number;
  courier_configs: {
    id: string;
    provider_id: string;
    carrier: string;
  } | null;
}

interface ProviderMarginData {
  config_id: string;
  provider_name: string;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

/**
 * Funzione di aggregazione pura (stessa logica di getMarginByProviderAction)
 * Estratta per testabilità senza dipendenze Supabase
 */
function aggregateByProvider(rows: ShipmentRow[]): ProviderMarginData[] {
  const configMap = new Map<
    string,
    {
      provider_name: string;
      total_shipments: number;
      total_revenue: number;
      total_cost: number;
      gross_margin: number;
    }
  >();

  rows.forEach((row) => {
    const configId = row.courier_config_id;
    if (!configId) return;

    const configInfo = Array.isArray(row.courier_configs)
      ? (row.courier_configs as any)[0]
      : row.courier_configs;

    const providerName = configInfo
      ? `${(configInfo.provider_id || '').replaceAll('_', ' ')} (${configInfo.carrier || 'N/A'})`
      : configId.substring(0, 8);

    const existing = configMap.get(configId) || {
      provider_name: providerName,
      total_shipments: 0,
      total_revenue: 0,
      total_cost: 0,
      gross_margin: 0,
    };

    const revenue = row.final_price || 0;
    const cost = row.base_price || 0;

    configMap.set(configId, {
      provider_name: existing.provider_name,
      total_shipments: existing.total_shipments + 1,
      total_revenue: existing.total_revenue + revenue,
      total_cost: existing.total_cost + cost,
      gross_margin: existing.gross_margin + (revenue - cost),
    });
  });

  return Array.from(configMap.entries())
    .map(([config_id, stats]) => ({
      config_id,
      provider_name: stats.provider_name,
      total_shipments: stats.total_shipments,
      total_revenue: Math.round(stats.total_revenue * 100) / 100,
      total_cost: Math.round(stats.total_cost * 100) / 100,
      gross_margin: Math.round(stats.gross_margin * 100) / 100,
      avg_margin_percent:
        stats.total_cost > 0
          ? Math.round((stats.gross_margin / stats.total_cost) * 100 * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.gross_margin - a.gross_margin);
}

// ============================================
// MOCK DATA (tutti nomi fittizi, nessun dato reale)
// ============================================

const FAKE_CONFIG_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAKE_CONFIG_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const mockConfigA = {
  id: FAKE_CONFIG_A,
  provider_id: 'test_provider_alpha',
  carrier: 'TESTCOURIER',
};
const mockConfigB = {
  id: FAKE_CONFIG_B,
  provider_id: 'test_provider_beta',
  carrier: 'MOCKCOURIER',
};

describe('Provider Analytics Aggregation', () => {
  it('should return empty array for zero rows', () => {
    const result = aggregateByProvider([]);
    expect(result).toEqual([]);
  });

  it('should aggregate single config correctly', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 8.0,
        courier_configs: mockConfigA,
      },
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 5.0,
        final_price: 10.0,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result).toHaveLength(1);
    expect(result[0].config_id).toBe(FAKE_CONFIG_A);
    expect(result[0].total_shipments).toBe(2);
    expect(result[0].total_revenue).toBe(18.0);
    expect(result[0].total_cost).toBe(9.0);
    expect(result[0].gross_margin).toBe(9.0);
    expect(result[0].avg_margin_percent).toBe(100.0); // 9/9 * 100
  });

  it('should aggregate multiple configs and sort by margin descending', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 6.0,
        courier_configs: mockConfigA,
      },
      {
        courier_config_id: FAKE_CONFIG_B,
        base_price: 5.0,
        final_price: 12.0,
        courier_configs: mockConfigB,
      },
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 6.0,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result).toHaveLength(2);
    // Config B ha margine più alto (7€) → primo
    expect(result[0].config_id).toBe(FAKE_CONFIG_B);
    expect(result[0].gross_margin).toBe(7.0);
    expect(result[0].total_shipments).toBe(1);
    // Config A secondo (margine 4€)
    expect(result[1].config_id).toBe(FAKE_CONFIG_A);
    expect(result[1].gross_margin).toBe(4.0);
    expect(result[1].total_shipments).toBe(2);
  });

  it('should handle negative margins correctly', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 10.0,
        final_price: 6.0,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].gross_margin).toBe(-4.0);
    expect(result[0].avg_margin_percent).toBe(-40.0); // -4/10 * 100
  });

  it('should build provider name from config info', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 8.0,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].provider_name).toBe('test provider alpha (TESTCOURIER)');
  });

  it('should fallback to config ID prefix when config info is null', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 8.0,
        courier_configs: null,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].provider_name).toBe('aaaaaaaa');
  });

  it('should handle Supabase array response for courier_configs', () => {
    // Supabase sometimes returns array instead of object for foreign key joins
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 4.0,
        final_price: 8.0,
        courier_configs: [mockConfigA] as any,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].provider_name).toBe('test provider alpha (TESTCOURIER)');
  });

  it('should round values to 2 decimal places', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 3.333,
        final_price: 7.777,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].total_revenue).toBe(7.78);
    expect(result[0].total_cost).toBe(3.33);
    expect(result[0].gross_margin).toBe(4.44);
  });

  it('should handle zero cost without division by zero', () => {
    const rows: ShipmentRow[] = [
      {
        courier_config_id: FAKE_CONFIG_A,
        base_price: 0,
        final_price: 5.0,
        courier_configs: mockConfigA,
      },
    ];

    const result = aggregateByProvider(rows);

    expect(result[0].avg_margin_percent).toBe(0); // No division by zero
    expect(result[0].gross_margin).toBe(5.0);
  });
});
