/**
 * Supabase Server Client per Server Actions
 * 
 * Crea un client Supabase sicuro per uso in Server Actions
 * con supporto per cookie e autenticazione
 */

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL o Anon Key non configurati')
}

/**
 * Crea un client Supabase per Server Actions
 * Usa i cookie per mantenere la sessione autenticata
 */
export function createServerActionClient() {
  const cookieStore = cookies()
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options)
        } catch (error) {
          // Cookie setting può fallire in Server Actions, ignoriamo
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        } catch (error) {
          // Cookie removal può fallire in Server Actions, ignoriamo
        }
      },
    },
  })
}

