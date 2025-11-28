/**
 * Database Functions: Analytics
 *
 * Geo-analytics, performance corrieri, social insights
 */

import { supabase } from './client';
import type { GeoAnalytics, CourierZonePerformance, SocialInsight } from '@/types/analytics';

/**
 * Aggiorna geo-analytics per periodo
 */
export async function updateGeoAnalytics(
  zipCode: string,
  periodStart: Date,
  periodEnd: Date,
  data: Partial<GeoAnalytics>
): Promise<void> {
  const { error } = await supabase
    .from('geo_analytics')
    .upsert({
      zip_code: zipCode,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      ...data,
    }, {
      onConflict: 'zip_code,period_start,period_end',
    });

  if (error) {
    console.error('Error updating geo analytics:', error);
  }
}

/**
 * Ottieni geo-analytics per zona e periodo
 */
export async function getGeoAnalytics(
  zipCode?: string,
  province?: string,
  periodStart?: Date,
  periodEnd?: Date
) {
  let query = supabase.from('geo_analytics').select('*');

  if (zipCode) {
    query = query.eq('zip_code', zipCode);
  }

  if (province) {
    query = query.eq('province', province);
  }

  if (periodStart) {
    query = query.gte('period_start', periodStart.toISOString().split('T')[0]);
  }

  if (periodEnd) {
    query = query.lte('period_end', periodEnd.toISOString().split('T')[0]);
  }

  query = query.order('period_start', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching geo analytics:', error);
    return [];
  }

  return data as GeoAnalytics[];
}

/**
 * Calcola analytics da spedizioni
 * (Funzione da eseguire periodicamente via cron)
 */
export async function calculateAnalyticsFromShipments(
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  // Query spedizioni nel periodo
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('recipient_zip, recipient_city, recipient_province, final_price, courier_id, status, delivered_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  if (error || !shipments) {
    console.error('Error fetching shipments for analytics:', error);
    return;
  }

  // Raggruppa per CAP
  const byZip: Record<string, any[]> = {};

  shipments.forEach(s => {
    if (!byZip[s.recipient_zip]) {
      byZip[s.recipient_zip] = [];
    }
    byZip[s.recipient_zip].push(s);
  });

  // Calcola metriche per ogni CAP
  for (const [zip, shipmentList] of Object.entries(byZip)) {
    const totalShipments = shipmentList.length;
    const totalRevenue = shipmentList.reduce((sum, s) => sum + (parseFloat(s.final_price as any) || 0), 0);
    const averageValue = totalRevenue / totalShipments;

    // Performance corrieri
    const courierPerformance: Record<string, any> = {};

    shipmentList.forEach(s => {
      if (!s.courier_id) return;

      if (!courierPerformance[s.courier_id]) {
        courierPerformance[s.courier_id] = {
          total: 0,
          delivered: 0,
          avgDays: [],
        };
      }

      courierPerformance[s.courier_id].total++;

      if (s.status === 'delivered' && s.delivered_at) {
        courierPerformance[s.courier_id].delivered++;
        // Calcola giorni consegna (semplificato)
        const createdAt = new Date(s.created_at);
        const deliveredAt = new Date(s.delivered_at);
        const days = Math.floor((deliveredAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        courierPerformance[s.courier_id].avgDays.push(days);
      }
    });

    // Aggrega performance corrieri
    const courierStats: Record<string, any> = {};
    for (const [courierId, perf] of Object.entries(courierPerformance)) {
      const successRate = (perf.delivered / perf.total) * 100;
      const avgDays = perf.avgDays.length > 0
        ? perf.avgDays.reduce((a: number, b: number) => a + b, 0) / perf.avgDays.length
        : null;

      courierStats[courierId] = {
        deliveries: perf.total,
        success_rate: successRate,
        avg_days: avgDays,
      };
    }

    // Salva analytics
    await updateGeoAnalytics(zip, periodStart, periodEnd, {
      city: shipmentList[0]?.recipient_city,
      province: shipmentList[0]?.recipient_province,
      total_shipments: totalShipments,
      total_revenue: totalRevenue,
      average_shipment_value: averageValue,
      courier_performance: courierStats,
    });
  }
}

/**
 * Aggiorna performance corriere per zona
 */
export async function updateCourierZonePerformance(
  courierId: string,
  zipCode: string,
  periodStart: Date,
  periodEnd: Date,
  metrics: {
    total_deliveries: number;
    successful_deliveries: number;
    average_delivery_days: number;
    on_time_deliveries: number;
  }
): Promise<void> {
  const successRate = (metrics.successful_deliveries / metrics.total_deliveries) * 100;
  const onTimeRate = (metrics.on_time_deliveries / metrics.total_deliveries) * 100;

  // Calcola quality score (0-10)
  const qualityScore =
    (successRate / 100) * 5 +  // Max 5 punti per success rate
    (onTimeRate / 100) * 3 +    // Max 3 punti per on-time rate
    Math.max(0, 2 - (metrics.average_delivery_days / 5)); // Max 2 punti per velocità

  const { error } = await supabase
    .from('courier_zone_performance')
    .upsert({
      courier_id: courierId,
      zip_code: zipCode,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      total_deliveries: metrics.total_deliveries,
      successful_deliveries: metrics.successful_deliveries,
      success_rate: successRate,
      average_delivery_days: metrics.average_delivery_days,
      on_time_deliveries: metrics.on_time_deliveries,
      on_time_rate: onTimeRate,
      quality_score: qualityScore,
    }, {
      onConflict: 'courier_id,zip_code,period_start',
    });

  if (error) {
    console.error('Error updating courier zone performance:', error);
  }
}

/**
 * Ottieni performance corriere per zona
 */
export async function getCourierPerformance(
  courierId: string,
  zipCode?: string,
  province?: string
) {
  let query = supabase
    .from('courier_zone_performance')
    .select('*')
    .eq('courier_id', courierId);

  if (zipCode) {
    query = query.eq('zip_code', zipCode);
  }

  if (province) {
    query = query.eq('province', province);
  }

  query = query.order('quality_score', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching courier performance:', error);
    return [];
  }

  return data as CourierZonePerformance[];
}

/**
 * Ottieni migliore corriere per zona
 */
export async function getBestCourierForZone(
  zipCode: string,
  serviceType: string = 'standard'
): Promise<{ courierId: string; score: number } | null> {
  const { data, error } = await supabase
    .from('courier_zone_performance')
    .select('courier_id, quality_score')
    .eq('zip_code', zipCode)
    .order('quality_score', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    courierId: data.courier_id,
    score: data.quality_score,
  };
}

/**
 * Salva social insight
 */
export async function saveSocialInsight(insight: Partial<SocialInsight>): Promise<void> {
  const { error } = await supabase
    .from('social_insights')
    .insert(insight);

  if (error) {
    console.error('Error saving social insight:', error);
  }
}

/**
 * Ottieni social insights
 */
export async function getSocialInsights(
  platform?: string,
  category?: string,
  zone?: string,
  periodStart?: Date,
  periodEnd?: Date
) {
  let query = supabase.from('social_insights').select('*');

  if (platform) {
    query = query.eq('platform', platform);
  }

  if (category) {
    query = query.eq('product_category', category);
  }

  if (zone) {
    query = query.eq('geographic_zone', zone);
  }

  if (periodStart) {
    query = query.gte('period_start', periodStart.toISOString().split('T')[0]);
  }

  if (periodEnd) {
    query = query.lte('period_end', periodEnd.toISOString().split('T')[0]);
  }

  query = query.order('collected_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching social insights:', error);
    return [];
  }

  return data as SocialInsight[];
}

/**
 * Calcola trend score per categoria e zona
 */
export async function calculateTrendScore(
  category: string,
  zone: string,
  platforms: string[] = ['facebook', 'instagram', 'tiktok']
): Promise<number> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const insights = await getSocialInsights(undefined, category, zone, weekAgo, now);

  if (insights.length === 0) {
    return 0;
  }

  // Media ponderata dei metric_value per piattaforma
  const weights: Record<string, number> = {
    'tiktok': 1.5,      // TikTok ha peso maggiore per trend
    'instagram': 1.2,
    'facebook': 1.0,
    'google_trends': 1.3,
  };

  let totalScore = 0;
  let totalWeight = 0;

  insights.forEach(insight => {
    const weight = weights[insight.platform] || 1.0;
    totalScore += parseFloat(insight.metric_value as any) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}
