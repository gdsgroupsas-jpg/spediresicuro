'use server';

import { supabaseAdmin } from '@/lib/db/client';
import { auth } from '@/lib/auth-config';

/**
 * Verifica se l'utente corrente è Admin o Super Admin
 */
async function verifyAdminAccess(): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return { isAdmin: false, error: 'Non autenticato' }
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type, role')
      .eq('email', session.user.email)
      .single()

    if (error || !user) {
      return { isAdmin: false, error: 'Utente non trovato' }
    }

    const isAdmin = user.account_type === 'superadmin' || 
                   user.account_type === 'admin' || 
                   user.role === 'admin'

    return { 
      isAdmin,
      userId: user.id 
    }
  } catch (error: any) {
    console.error('Errore verifica Admin:', error)
    return { isAdmin: false, error: error.message }
  }
}

export interface TopUpRequestAdmin {
  id: string
  user_id: string
  amount: number
  status: 'pending' | 'manual_review' | 'approved' | 'rejected'
  ai_confidence: number | null
  created_at: string
  file_url: string
  approved_amount: number | null
  approved_by: string | null
  approved_at: string | null
  user_email: string | null
  user_name: string | null
}

/**
 * Server Action: Recupera lista top_up_requests per admin
 * 
 * @param status - Filtro per status (opzionale)
 * @param search - Ricerca per email o nome utente (opzionale)
 * @param limit - Numero massimo di risultati (default: 50)
 * @param offset - Offset per paginazione (default: 0)
 * @returns Array di richieste con dati utente
 */
export async function getTopUpRequestsAdmin({
  status,
  search,
  limit = 50,
  offset = 0,
}: {
  status?: 'pending' | 'manual_review' | 'approved' | 'rejected'
  search?: string
  limit?: number
  offset?: number
}): Promise<{
  success: boolean
  data?: TopUpRequestAdmin[]
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'Solo gli Admin possono accedere a questa funzione.',
      }
    }

    // 2. Query base su top_up_requests
    let query = supabaseAdmin
      .from('top_up_requests')
      .select(`
        id,
        user_id,
        amount,
        status,
        ai_confidence,
        created_at,
        file_url,
        approved_amount,
        approved_by,
        approved_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 3. Filtro status
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Errore query top_up_requests:', error)
      return {
        success: false,
        error: error.message || 'Errore durante il recupero delle richieste.',
      }
    }

    // 4. Recupera user_id unici
    const userIds = [...new Set((data || []).map((req: any) => req.user_id))]

    // 5. Cache per evitare chiamate duplicate
    const cache = new Map<string, { email: string | null; name: string | null }>()

    // 6. Recupera dati utenti dalla tabella users pubblica
    const usersMap = new Map<string, { email: string | null; name: string | null }>()
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .in('id', userIds)

      if (!usersError && users) {
        users.forEach((user: any) => {
          const userData = {
            email: user.email || null,
            name: user.name || null,
          }
          usersMap.set(user.id, userData)
          cache.set(user.id, userData)
        })
      }
    }

    // 7. Per ogni richiesta, se email/nome mancano, recupera da auth.users
    const requests: TopUpRequestAdmin[] = await Promise.all(
      (data || []).map(async (req: any) => {
        let userEmail: string | null = null
        let userName: string | null = null

        // Controlla cache prima
        if (cache.has(req.user_id)) {
          const cached = cache.get(req.user_id)!
          userEmail = cached.email
          userName = cached.name
        } else {
          // Controlla usersMap (da public.users)
          const userFromPublic = usersMap.get(req.user_id)
          if (userFromPublic) {
            userEmail = userFromPublic.email
            userName = userFromPublic.name
            cache.set(req.user_id, { email: userEmail, name: userName })
          } else {
            // Fallback: recupera da auth.users
            try {
              const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(req.user_id)
              
              if (!authError && authUser?.user) {
                userEmail = authUser.user.email || null
                userName = authUser.user.user_metadata?.full_name || 
                          authUser.user.user_metadata?.name || 
                          null
                
                // Salva in cache
                cache.set(req.user_id, { email: userEmail, name: userName })
              }
            } catch (authErr: any) {
              // Se fallisce, lascia null (non rompere la pagina)
              console.warn(`Errore recupero auth user ${req.user_id}:`, authErr.message)
            }
          }
        }

        return {
          id: req.id,
          user_id: req.user_id,
          amount: parseFloat(req.amount || 0),
          status: req.status,
          ai_confidence: req.ai_confidence,
          created_at: req.created_at,
          file_url: req.file_url,
          approved_amount: req.approved_amount ? parseFloat(req.approved_amount) : null,
          approved_by: req.approved_by,
          approved_at: req.approved_at,
          user_email: userEmail,
          user_name: userName,
        }
      })
    )

    // 8. Filtro search (se specificato) - applicato dopo il fetch
    let filteredRequests = requests
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      filteredRequests = requests.filter(
        (req) =>
          req.user_email?.toLowerCase().includes(searchLower) ||
          req.user_name?.toLowerCase().includes(searchLower) ||
          req.user_id.toLowerCase().includes(searchLower)
      )
    }

    return {
      success: true,
      data: filteredRequests,
    }
  } catch (error: any) {
    console.error('Errore in getTopUpRequestsAdmin:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il recupero delle richieste.',
    }
  }
}

/**
 * Server Action: Recupera singola top_up_request per admin
 * 
 * @param id - ID della richiesta
 * @returns Richiesta con dati utente
 */
export async function getTopUpRequestAdmin(
  id: string
): Promise<{
  success: boolean
  data?: TopUpRequestAdmin
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'Solo gli Admin possono accedere a questa funzione.',
      }
    }

    // 2. Query su top_up_requests
    const { data, error } = await supabaseAdmin
      .from('top_up_requests')
      .select(`
        id,
        user_id,
        amount,
        status,
        ai_confidence,
        created_at,
        file_url,
        approved_amount,
        approved_by,
        approved_at,
        admin_notes
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return {
        success: false,
        error: 'Richiesta non trovata.',
      }
    }

    // 3. Recupera dati utente dalla tabella users pubblica
    let userEmail: string | null = null
    let userName: string | null = null

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', data.user_id)
      .single()

    if (!userError && user) {
      userEmail = user.email || null
      userName = user.name || null
    }

    // 4. Se email/nome mancano, recupera da auth.users
    if (!userEmail && !userName) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(data.user_id)
        
        if (!authError && authUser?.user) {
          userEmail = authUser.user.email || null
          userName = authUser.user.user_metadata?.full_name || 
                    authUser.user.user_metadata?.name || 
                    null
        }
      } catch (authErr: any) {
        // Se fallisce, lascia null (non rompere la pagina)
        console.warn(`Errore recupero auth user ${data.user_id}:`, authErr.message)
      }
    }

    // 5. Trasforma dati
    const request: TopUpRequestAdmin = {
      id: data.id,
      user_id: data.user_id,
      amount: parseFloat(data.amount || 0),
      status: data.status,
      ai_confidence: data.ai_confidence,
      created_at: data.created_at,
      file_url: data.file_url,
      approved_amount: data.approved_amount ? parseFloat(data.approved_amount) : null,
      approved_by: data.approved_by,
      approved_at: data.approved_at,
      user_email: userEmail,
      user_name: userName,
    }

    return {
      success: true,
      data: request,
    }
  } catch (error: any) {
    console.error('Errore in getTopUpRequestAdmin:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il recupero della richiesta.',
    }
  }
}
