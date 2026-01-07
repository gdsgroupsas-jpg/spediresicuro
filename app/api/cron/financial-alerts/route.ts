/**
 * API Route: Financial Alerts Cron
 * 
 * Endpoint per trigger automatico alert finanziari.
 * Da chiamare via cron job (Vercel Cron, GitHub Actions, etc.)
 * 
 * @route GET /api/cron/financial-alerts
 * @since Sprint 3 - Monitoring & Alerting
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/client'
import { createFinancialAlertsService } from '@/lib/services/financial'

// Vercel Cron: Bearer token per sicurezza
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  try {
    // Verifica autorizzazione
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[CRON] Starting financial alerts check...')
    
    const alertsService = createFinancialAlertsService(supabaseAdmin)
    const alerts = await alertsService.runAllChecks()
    
    console.log(`[CRON] Found ${alerts.length} alerts`)
    
    // Invia a Slack e logga
    const results = await Promise.all(
      alerts.map(async (alert) => {
        const slackSent = await alertsService.sendToSlack(alert)
        await alertsService.logAlert(alert)
        return { type: alert.type, severity: alert.severity, slackSent }
      })
    )
    
    return NextResponse.json({
      success: true,
      alertsGenerated: alerts.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[CRON] Financial alerts error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Vercel Cron config
export const runtime = 'nodejs'
export const maxDuration = 30
