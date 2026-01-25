/**
 * Tracking Service
 *
 * Handles fetching and caching tracking data from Spedisci.Online API
 * and other carrier APIs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/db/database.types';

// Type aliases from generated database types
type TrackingEventInsert = Database['public']['Tables']['tracking_events']['Insert'];

// Types - aligned with database schema
export interface TrackingEvent {
  id?: string;
  shipment_id: string;
  tracking_number: string;
  event_date: string;
  status: string;
  status_normalized: string | null;
  location: string | null;
  description?: string | null;
  carrier?: string | null;
  provider?: string | null;
  raw_data?: Json | null;
  created_at?: string | null;
  fetched_at?: string | null;
}

export interface TrackingResponse {
  success: boolean;
  tracking_number: string;
  carrier?: string;
  current_status: string;
  current_status_normalized: string;
  last_update: string | null;
  events: TrackingEvent[];
  is_delivered: boolean;
  estimated_delivery?: string | null;
  error?: string;
}

interface SpedisciOnlineTrackingResponse {
  TrackingDettaglio: Array<{
    Data: string;
    Stato: string;
    Luogo: string;
  }>;
}

// Status normalization mapping
const STATUS_MAP: Record<string, string> = {
  // Delivered
  consegnata: 'delivered',
  delivered: 'delivered',
  recapitata: 'delivered',

  // In transit
  'in transito': 'in_transit',
  transit: 'in_transit',
  partita: 'in_transit',

  // Out for delivery
  'in consegna': 'out_for_delivery',
  'consegna prevista': 'out_for_delivery',

  // At destination
  'arrivata in sede': 'at_destination',

  // Exceptions
  eccezione: 'exception',
  problema: 'exception',
  'destinatario assente': 'exception',

  // Created/Pending
  'spedizione generata': 'created',
  'in attesa di ritiro': 'pending_pickup',

  // Returned
  reso: 'returned',
  respinta: 'returned',
};

function normalizeStatus(rawStatus: string): string {
  const lower = rawStatus.toLowerCase();

  // Check exact matches first
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  // Pattern matching
  if (lower.includes('consegnat')) return 'delivered';
  if (lower.includes('transit')) return 'in_transit';
  if (lower.includes('partita') || lower.includes('partenza')) return 'in_transit';
  if (lower.includes('consegna prevista') || lower.includes('in consegna'))
    return 'out_for_delivery';
  if (lower.includes('destinatar') || lower.includes('arrivata')) return 'at_destination';
  if (lower.includes('eccezione') || lower.includes('problem') || lower.includes('assente'))
    return 'exception';
  if (lower.includes('generata') || lower.includes('registrata')) return 'created';
  if (lower.includes('ritiro')) return 'pending_pickup';
  if (lower.includes('reso') || lower.includes('return')) return 'returned';
  if (lower.includes('annullat')) return 'cancelled';

  return 'unknown';
}

function parseItalianDate(dateStr: string): Date {
  // Format: "22/09/2016 15:22" or "22/09/2016"
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('/');

  if (dateParts.length !== 3) {
    return new Date(dateStr);
  }

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
  const year = parseInt(dateParts[2], 10);

  if (parts[1]) {
    const timeParts = parts[1].split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    return new Date(year, month, day, hours, minutes);
  }

  return new Date(year, month, day);
}

// Configuration constants with env var overrides
const TRACKING_CONFIG = {
  // Cache TTL: how long before we consider cached tracking data stale (default: 30 minutes)
  CACHE_TTL_MS: parseInt(process.env.TRACKING_CACHE_TTL_MINUTES || '30', 10) * 60 * 1000,
  // Sync max age: only sync shipments with tracking data older than this (default: 4 hours)
  SYNC_MAX_AGE_MS: parseInt(process.env.TRACKING_SYNC_MAX_AGE_HOURS || '4', 10) * 60 * 60 * 1000,
  // Sync batch limit: max shipments to sync per cron run (default: 100)
  SYNC_BATCH_LIMIT: parseInt(process.env.TRACKING_SYNC_BATCH_LIMIT || '100', 10),
  // Sync delay: delay between API calls for rate limiting (default: 500ms)
  SYNC_DELAY_MS: parseInt(process.env.TRACKING_SYNC_DELAY_MS || '500', 10),
  // Sync lookback: only sync shipments created within this period (default: 14 days)
  SYNC_LOOKBACK_DAYS: parseInt(process.env.TRACKING_SYNC_LOOKBACK_DAYS || '14', 10),
};

export class TrackingService {
  private supabaseAdmin: SupabaseClient<Database>;
  private spedisciOnlineBaseUrl: string;
  private spedisciOnlineApiKey: string;

  constructor() {
    // Initialize admin client for service operations
    this.supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Spedisci.Online config
    this.spedisciOnlineBaseUrl =
      process.env.SPEDISCI_ONLINE_BASE_URL || 'https://demo1.spedisci.online/api/v2';
    this.spedisciOnlineApiKey = process.env.SPEDISCI_ONLINE_API_KEY || '';
  }

  /**
   * Get tracking info for a shipment
   * First checks cache (DB), then fetches from API if stale
   */
  async getTracking(shipmentId: string, forceRefresh = false): Promise<TrackingResponse> {
    try {
      // Get shipment info
      const { data: shipmentData, error: shipmentError } = await this.supabaseAdmin
        .from('shipments')
        .select('id, tracking_number, carrier, tracking_status, tracking_last_update')
        .eq('id', shipmentId)
        .single();

      if (shipmentError || !shipmentData) {
        return {
          success: false,
          tracking_number: '',
          current_status: 'unknown',
          current_status_normalized: 'unknown',
          last_update: null,
          events: [],
          is_delivered: false,
          error: 'Shipment not found',
        };
      }

      if (!shipmentData.tracking_number) {
        return {
          success: false,
          tracking_number: '',
          current_status: 'unknown',
          current_status_normalized: 'unknown',
          last_update: null,
          events: [],
          is_delivered: false,
          error: 'No tracking number available',
        };
      }

      // Check if we need to refresh from API
      const shouldRefresh = forceRefresh || this.shouldRefreshTracking(shipmentData);

      if (shouldRefresh) {
        // Fetch from Spedisci.Online API
        await this.fetchAndCacheTracking(
          shipmentData.id,
          shipmentData.tracking_number,
          shipmentData.carrier
        );
      }

      // Get cached events from DB
      const { data: eventsData, error: eventsError } = await this.supabaseAdmin
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('event_date', { ascending: false });

      // Type is correctly inferred from Database types
      const trackingEvents = eventsData || [];

      if (eventsError) {
        console.error('Error fetching tracking events:', eventsError);
      }

      const latestEvent = trackingEvents[0];

      return {
        success: true,
        tracking_number: shipmentData.tracking_number,
        carrier: shipmentData.carrier || undefined,
        current_status: latestEvent?.status || 'unknown',
        current_status_normalized: latestEvent?.status_normalized || 'unknown',
        last_update: latestEvent?.fetched_at || null,
        events: trackingEvents,
        is_delivered: latestEvent?.status_normalized === 'delivered',
      };
    } catch (error) {
      console.error('TrackingService.getTracking error:', error);
      return {
        success: false,
        tracking_number: '',
        current_status: 'error',
        current_status_normalized: 'error',
        last_update: null,
        events: [],
        is_delivered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if we should refresh tracking from API
   * Rules:
   * - If never fetched: yes
   * - If delivered: no (final state)
   * - If last fetch > 30 minutes ago: yes
   */
  private shouldRefreshTracking(shipment: {
    tracking_status?: string | null;
    tracking_last_update?: string | null;
  }): boolean {
    // Never fetched
    if (!shipment.tracking_last_update) {
      return true;
    }

    // Already delivered - no need to refresh
    if (shipment.tracking_status === 'delivered') {
      return false;
    }

    // Check cache age (configurable, default 30 minutes)
    const lastUpdate = new Date(shipment.tracking_last_update);
    const cacheAge = Date.now() - lastUpdate.getTime();

    return cacheAge > TRACKING_CONFIG.CACHE_TTL_MS;
  }

  /**
   * Fetch tracking from Spedisci.Online API and cache in DB
   */
  async fetchAndCacheTracking(
    shipmentId: string,
    trackingNumber: string,
    carrier?: string | null
  ): Promise<void> {
    try {
      // Call Spedisci.Online API
      const response = await fetch(
        `${this.spedisciOnlineBaseUrl}/tracking/${encodeURIComponent(trackingNumber)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.spedisciOnlineApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(
          `Spedisci.Online tracking API error: ${response.status} ${response.statusText}`
        );
        return;
      }

      const data: SpedisciOnlineTrackingResponse = await response.json();

      if (!data.TrackingDettaglio || !Array.isArray(data.TrackingDettaglio)) {
        console.error('Invalid tracking response format');
        return;
      }

      // Transform and insert events
      const now = new Date().toISOString();
      const events: TrackingEventInsert[] = data.TrackingDettaglio.map((event) => {
        const eventDate = parseItalianDate(event.Data);
        const statusNormalized = normalizeStatus(event.Stato);

        return {
          shipment_id: shipmentId,
          tracking_number: trackingNumber,
          event_date: eventDate.toISOString(),
          status: event.Stato,
          status_normalized: statusNormalized,
          location: event.Luogo || null,
          carrier: carrier || 'unknown',
          provider: 'spediscionline',
          raw_data: event as Json,
          fetched_at: now,
        };
      });

      // Upsert events using properly typed client
      let upsertErrors = 0;
      for (const event of events) {
        const { error: upsertError } = await this.supabaseAdmin
          .from('tracking_events')
          .upsert(event, {
            onConflict: 'shipment_id,event_date,status',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          upsertErrors++;
          console.error(
            `[TrackingService] Error upserting tracking event for shipment ${shipmentId}:`,
            upsertError.message
          );
        }
      }

      if (upsertErrors > 0) {
        console.warn(
          `[TrackingService] ${upsertErrors}/${events.length} events failed to upsert for shipment ${shipmentId}`
        );
      }

      // The trigger will automatically update shipment tracking_status
      console.log(`Cached ${events.length} tracking events for shipment ${shipmentId}`);
    } catch (error) {
      console.error('Error fetching tracking from Spedisci.Online:', error);
    }
  }

  /**
   * Batch sync tracking for multiple shipments
   * Used by cron job
   */
  async syncActiveShipments(
    options: {
      maxAge?: number; // Only sync if last update older than this (ms)
      limit?: number; // Max shipments to sync
      delayBetween?: number; // Delay between API calls (ms)
    } = {}
  ): Promise<{ synced: number; errors: number }> {
    const {
      maxAge = TRACKING_CONFIG.SYNC_MAX_AGE_MS,
      limit = TRACKING_CONFIG.SYNC_BATCH_LIMIT,
      delayBetween = TRACKING_CONFIG.SYNC_DELAY_MS,
    } = options;

    let synced = 0;
    let errors = 0;

    try {
      // Get active shipments that need tracking update
      const cutoffDate = new Date(Date.now() - maxAge).toISOString();
      const lookbackDate = new Date(
        Date.now() - TRACKING_CONFIG.SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: shipmentsData, error } = await this.supabaseAdmin
        .from('shipments')
        .select('id, tracking_number, carrier, tracking_status, tracking_last_update, created_at')
        .not('tracking_number', 'is', null)
        .not('tracking_status', 'eq', 'delivered')
        .not('tracking_status', 'eq', 'cancelled')
        .or(`tracking_last_update.is.null,tracking_last_update.lt.${cutoffDate}`)
        .gte('created_at', lookbackDate)
        .order('tracking_last_update', { ascending: true, nullsFirst: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching shipments for tracking sync:', error);
        return { synced: 0, errors: 1 };
      }

      const shipments = shipmentsData || [];
      console.log(`Syncing tracking for ${shipments.length} shipments`);

      for (const shipment of shipments) {
        try {
          // tracking_number is guaranteed non-null by the query filter
          await this.fetchAndCacheTracking(
            shipment.id,
            shipment.tracking_number!,
            shipment.carrier
          );
          synced++;

          // Rate limiting delay
          if (delayBetween > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayBetween));
          }
        } catch (err) {
          console.error(`Error syncing tracking for shipment ${shipment.id}:`, err);
          errors++;
        }
      }
    } catch (error) {
      console.error('Error in syncActiveShipments:', error);
      errors++;
    }

    return { synced, errors };
  }

  /**
   * Get tracking by tracking number (for external lookup)
   */
  async getTrackingByNumber(trackingNumber: string): Promise<TrackingResponse> {
    // Find shipment by tracking number
    const { data: shipmentData, error } = await this.supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (error || !shipmentData) {
      return {
        success: false,
        tracking_number: trackingNumber,
        current_status: 'unknown',
        current_status_normalized: 'unknown',
        last_update: null,
        events: [],
        is_delivered: false,
        error: 'Shipment not found',
      };
    }

    return this.getTracking(shipmentData.id);
  }
}

// Singleton instance
let trackingServiceInstance: TrackingService | null = null;

export function getTrackingService(): TrackingService {
  if (!trackingServiceInstance) {
    trackingServiceInstance = new TrackingService();
  }
  return trackingServiceInstance;
}

export default TrackingService;
