/**
 * Social Trend Adapter Base Interface
 *
 * Interfaccia comune per integrazioni social media insights
 */

export interface SocialCredentials {
  access_token?: string;
  app_id?: string;
  app_secret?: string;
  [key: string]: any;
}

export interface TrendMetric {
  platform: string;
  metric_type: string; // 'engagement', 'reach', 'impressions', 'trend_score'
  value: number;
  period_start: Date;
  period_end: Date;
  product_category?: string;
  geographic_zone?: string;
  raw_data?: any;
}

export interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  roi: number;
}

export abstract class SocialAdapter {
  protected credentials: SocialCredentials;
  protected platform: string;

  constructor(credentials: SocialCredentials, platform: string) {
    this.credentials = credentials;
    this.platform = platform;
  }

  /**
   * Test connessione
   */
  abstract connect(): Promise<boolean>;

  /**
   * Ottieni metriche trend
   */
  abstract getTrendMetrics(
    dateFrom: Date,
    dateTo: Date,
    filters?: {
      category?: string;
      zone?: string;
    }
  ): Promise<TrendMetric[]>;

  /**
   * Ottieni performance campagne
   */
  abstract getCampaignPerformance(dateFrom: Date, dateTo: Date): Promise<CampaignPerformance[]>;

  /**
   * Calcola trend score (0-100)
   */
  abstract calculateTrendScore(category: string, zone?: string): Promise<number>;
}

/**
 * Mock Social Adapter (per testing)
 */
export class MockSocialAdapter extends SocialAdapter {
  constructor() {
    super({}, 'mock');
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async getTrendMetrics(dateFrom: Date, dateTo: Date, filters?: any): Promise<TrendMetric[]> {
    return [
      {
        platform: this.platform,
        metric_type: 'trend_score',
        value: 75 + Math.random() * 25,
        period_start: dateFrom,
        period_end: dateTo,
        product_category: filters?.category,
        geographic_zone: filters?.zone,
      },
    ];
  }

  async getCampaignPerformance(dateFrom: Date, dateTo: Date): Promise<CampaignPerformance[]> {
    return [];
  }

  async calculateTrendScore(category: string, zone?: string): Promise<number> {
    return 65 + Math.random() * 30;
  }
}
