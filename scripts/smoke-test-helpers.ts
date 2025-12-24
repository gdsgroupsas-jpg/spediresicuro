import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function loadEnvFromLocal() {
  config({ path: resolve(process.cwd(), '.env.local') })
}

export function getSupabaseAdminClient(): SupabaseClient {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      'Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export interface SmokeTestUser {
  id: string
  email: string
  wallet_balance: number
}

export async function createSmokeTestUser(args: {
  supabase: SupabaseClient
  initialBalance: number
  label: string
}): Promise<SmokeTestUser> {
  const testEmail = `smoke-${args.label}-${Date.now()}-${Math.random().toString(36).slice(2)}@smoke-test.local`

  const { data: user, error } = await args.supabase
    .from('users')
    .insert({
      email: testEmail,
      name: `Smoke Test ${args.label}`,
      wallet_balance: args.initialBalance,
      account_type: 'user',
      role: 'user',
    } as any)
    .select()
    .single()

  if (error || !user) throw new Error(`Failed to create test user: ${error?.message || 'Unknown error'}`)

  return user as SmokeTestUser
}

export async function getWalletBalance(args: { supabase: SupabaseClient; userId: string }): Promise<number> {
  const { data, error } = await args.supabase.from('users').select('wallet_balance').eq('id', args.userId).single()
  if (error || !data) throw new Error(`Failed to read wallet_balance: ${error?.message || 'Unknown error'}`)
  return parseFloat((data as any).wallet_balance) || 0
}

export async function countRows(args: {
  supabase: SupabaseClient
  table: string
  filter: Record<string, any>
}): Promise<number> {
  let q = args.supabase.from(args.table).select('id', { count: 'exact', head: true }) as any
  for (const [k, v] of Object.entries(args.filter)) {
    q = q.eq(k, v)
  }
  const { count, error } = await q
  if (error) throw new Error(`Count failed on ${args.table}: ${error.message}`)
  return count || 0
}

export async function fetchRows(args: {
  supabase: SupabaseClient
  table: string
  filter: Record<string, any>
  columns?: string
}): Promise<any[]> {
  const columns = args.columns || '*'
  let q = args.supabase.from(args.table).select(columns) as any
  for (const [k, v] of Object.entries(args.filter)) {
    q = q.eq(k, v)
  }
  const { data, error } = await q
  if (error) throw new Error(`Fetch failed on ${args.table}: ${error.message}`)
  return (data as any[]) || []
}

export async function cleanupSmokeTestUser(args: { supabase: SupabaseClient; userId: string }) {
  // Best-effort cleanup; ignore errors to avoid hiding test results
  const s = args.supabase

  try {
    await s.from('wallet_transactions').delete().eq('user_id', args.userId)
  } catch {}

  try {
    await s.from('shipments').delete().eq('user_id', args.userId)
  } catch {}

  try {
    await s.from('idempotency_locks').delete().eq('user_id', args.userId)
  } catch {}

  try {
    await s.from('compensation_queue').delete().eq('user_id', args.userId)
  } catch {}

  try {
    await s.from('users').delete().eq('id', args.userId)
  } catch {}
}


