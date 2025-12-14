'use server';

import { supabaseAdmin } from '@/lib/db/client';
import { auth } from '@/lib/auth-config';

/**
 * Verifica se l'utente corrente √® Admin o Super Admin
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
<<<<<<< HEAD
 
 / * *  
   *   S e r v e r   A c t i o n :   A p p r o v a   u n a   r i c h i e s t a   t o p _ u p _ r e q u e s t s   e   a c c r e d i t a   w a l l e t  
   *    
   *   @ p a r a m   r e q u e s t I d   -   I D   d e l l a   r i c h i e s t a   d a   a p p r o v a r e  
   *   @ p a r a m   a p p r o v e d A m o u n t   -   I m p o r t o   d a   a c c r e d i t a r e   ( o p z i o n a l e ,   d e f a u l t   =   a m o u n t   d e l l a   r i c h i e s t a )  
   *   @ r e t u r n s   R i s u l t a t o   o p e r a z i o n e  
   * /  
 e x p o r t   a s y n c   f u n c t i o n   a p p r o v e T o p U p R e q u e s t (  
     r e q u e s t I d :   s t r i n g ,  
     a p p r o v e d A m o u n t ? :   n u m b e r  
 ) :   P r o m i s e < {  
     s u c c e s s :   b o o l e a n  
     m e s s a g e ? :   s t r i n g  
     e r r o r ? :   s t r i n g  
     t r a n s a c t i o n I d ? :   s t r i n g  
 } >   {  
      
     c o n s t   l o g   =   ( m s g :   s t r i n g ,   d a t a ? :   a n y )   = >   {  
         c o n s o l e . l o g ( ` [ T O P U P _ A P P R O V E ]   $ { m s g } ` ,   d a t a   ?   J S O N . s t r i n g i f y ( d a t a )   :   ' ' ) ;  
     } ;  
  
     l o g ( ' S T A R T   a p p r o v e T o p U p R e q u e s t ' ,   {   r e q u e s t I d ,   a p p r o v e d A m o u n t   } ) ;  
    
     t r y   {  
         / /   1 .   V e r i f i c a   a d m i n  
         c o n s t   a d m i n C h e c k   =   a w a i t   v e r i f y A d m i n A c c e s s ( )  
         l o g ( ' A d m i n   C h e c k   r e s u l t ' ,   a d m i n C h e c k ) ;  
         i f   ( ! a d m i n C h e c k . i s A d m i n   | |   ! a d m i n C h e c k . u s e r I d )   {  
             l o g ( ' A d m i n   A c c e s s   D e n i e d ' ) ;  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' S o l o   g l i   A d m i n   p o s s o n o   a p p r o v a r e   r i c h i e s t e   d i   r i c a r i c a . ' ,  
             }  
         }  
  
         / /   2 .   V a l i d a   i m p o r t o   s e   f o r n i t o  
         i f   ( a p p r o v e d A m o u n t   ! = =   u n d e f i n e d )   {  
             i f   ( a p p r o v e d A m o u n t   < =   0   | |   a p p r o v e d A m o u n t   >   1 0 0 0 0 )   {  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' I m p o r t o   n o n   v a l i d o .   D e v e   e s s e r e   t r a   ‚  ¨ 0 . 0 1   e   ‚  ¨ 1 0 . 0 0 0 ' ,  
                 }  
             }  
         }  
  
         / /   3 .   R e c u p e r a   r i c h i e s t a   p e r   o t t e n e r e   a m o u n t   s e   a p p r o v e d A m o u n t   n o n   √ ®   s p e c i f i c a t o  
         / /   ( N e c e s s a r i o   p e r   i m p o s t a r e   a p p r o v e d _ a m o u n t   n e l l ' U P D A T E   a t o m i c o )  
         l e t   a m o u n t T o C r e d i t :   n u m b e r  
         i f   ( a p p r o v e d A m o u n t   = = =   u n d e f i n e d )   {  
             c o n s t   {   d a t a :   r e q u e s t ,   e r r o r :   r e q u e s t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
                 . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
                 . s e l e c t ( ' a m o u n t ' )  
                 . e q ( ' i d ' ,   r e q u e s t I d )  
                 . m a y b e S i n g l e ( )  
  
             i f   ( r e q u e s t E r r o r   | |   ! r e q u e s t )   {  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' R i c h i e s t a   n o n   t r o v a t a . ' ,  
                 }  
             }  
  
             a m o u n t T o C r e d i t   =   r e q u e s t . a m o u n t  
             i f   ( a m o u n t T o C r e d i t   < =   0   | |   a m o u n t T o C r e d i t   >   1 0 0 0 0 )   {  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' I m p o r t o   n o n   v a l i d o .   D e v e   e s s e r e   t r a   ‚  ¨ 0 . 0 1   e   ‚  ¨ 1 0 . 0 0 0 ' ,  
                 }  
             }  
         }   e l s e   {  
             a m o u n t T o C r e d i t   =   a p p r o v e d A m o u n t  
         }  
  
         / /   4 .   U P D A T E   a t o m i c o   e   i d e m p o t e n t e :   a g g i o r n a   s o l o   s e   s t a t u s   √ ®   p e n d i n g / m a n u a l _ r e v i e w  
         / /   Q u e s t o   p a t t e r n   p r e v i e n e   r a c e   c o n d i t i o n s :   s o l o   i l   p r i m o   U P D A T E   r i e s c e  
         / /   N o t a :   s u p a b a s e A d m i n   u s a   s e r v i c e   r o l e   k e y   c h e   d o v r e b b e   b y p a s s a r e   R L S  
         c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   A t t e m p t i n g   U P D A T E ' ,   {  
             r e q u e s t I d ,  
             a d m i n U s e r I d :   a d m i n C h e c k . u s e r I d ,  
             a m o u n t T o C r e d i t ,  
             u s i n g S e r v i c e R o l e :   ! ! p r o c e s s . e n v . S U P A B A S E _ S E R V I C E _ R O L E _ K E Y ,  
         } )  
          
         / /   P r o v a   U P D A T E   c o n   s u p a b a s e A d m i n   ( s e r v i c e   r o l e   k e y   b y p a s s a   R L S )  
         / /   S e   f a l l i s c e ,   p o t r e b b e   e s s e r e   u n   p r o b l e m a   d i   c o n f i g u r a z i o n e   s e r v i c e   r o l e   k e y  
         c o n s t   u p d a t e P a y l o a d   =   {  
             s t a t u s :   ' a p p r o v e d ' ,  
             a p p r o v e d _ b y :   a d m i n C h e c k . u s e r I d ,  
             a p p r o v e d _ a t :   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,  
             a p p r o v e d _ a m o u n t :   a m o u n t T o C r e d i t ,  
             u p d a t e d _ a t :   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,  
         }  
          
         c o n s t   {   d a t a :   u p d a t e d R e q u e s t ,   e r r o r :   u p d a t e E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
             . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
             . u p d a t e ( u p d a t e P a y l o a d )  
             . e q ( ' i d ' ,   r e q u e s t I d )  
             . i n ( ' s t a t u s ' ,   [ ' p e n d i n g ' ,   ' m a n u a l _ r e v i e w ' ] )  
             . s e l e c t ( ' i d ,   u s e r _ i d ,   a p p r o v e d _ a m o u n t ,   s t a t u s ' )  
             . m a y b e S i n g l e ( )  
          
         / /   L o g   d e t t a g l i a t o   p e r   d e b u g  
         i f   ( u p d a t e E r r o r )   {  
             c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   U P D A T E   e r r o r   d e t a i l s ' ,   {  
                 r e q u e s t I d ,  
                 u p d a t e P a y l o a d ,  
                 e r r o r M e s s a g e :   u p d a t e E r r o r . m e s s a g e ,  
                 e r r o r C o d e :   u p d a t e E r r o r . c o d e ,  
                 e r r o r D e t a i l s :   u p d a t e E r r o r . d e t a i l s ,  
                 e r r o r H i n t :   u p d a t e E r r o r . h i n t ,  
             } )  
         }  
  
         / /   5 .   S e   U P D A T E   n o n   h a   a g g i o r n a t o   r i g h e ,   d i a g n o s t i c a   i l   p r o b l e m a  
         i f   ( u p d a t e E r r o r   | |   ! u p d a t e d R e q u e s t )   {  
             c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   U P D A T E   f a i l e d ' ,   {  
                 r e q u e s t I d ,  
                 u p d a t e E r r o r :   u p d a t e E r r o r ? . m e s s a g e   | |   ' N o   e r r o r   b u t   n o   r o w s   u p d a t e d ' ,  
                 u p d a t e E r r o r C o d e :   u p d a t e E r r o r ? . c o d e ,  
                 u p d a t e E r r o r D e t a i l s :   u p d a t e E r r o r ? . d e t a i l s ,  
             } )  
  
             / /   V e r i f i c a   s t a t o   r e a l e   d e l l a   r i c h i e s t a   p e r   c a p i r e   i l   m o t i v o  
             c o n s t   {   d a t a :   e x i s t i n g R e q u e s t ,   e r r o r :   s e l e c t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
                 . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
                 . s e l e c t ( ' i d ,   s t a t u s ,   a p p r o v e d _ b y ,   a p p r o v e d _ a t ,   a p p r o v e d _ a m o u n t ,   u p d a t e d _ a t ' )  
                 . e q ( ' i d ' ,   r e q u e s t I d )  
                 . m a y b e S i n g l e ( )  
  
             i f   ( s e l e c t E r r o r )   {  
                 c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   S E L E C T   f a i l e d   a f t e r   U P D A T E   f a i l u r e ' ,   {  
                     r e q u e s t I d ,  
                     s e l e c t E r r o r :   s e l e c t E r r o r . m e s s a g e ,  
                     s e l e c t E r r o r C o d e :   s e l e c t E r r o r . c o d e ,  
                 } )  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' E r r o r e   d u r a n t e   l a   v e r i f i c a   d e l l a   r i c h i e s t a . ' ,  
                 }  
             }  
  
             / /   C a s o   1 :   R i c h i e s t a   n o n   e s i s t e  
             i f   ( ! e x i s t i n g R e q u e s t )   {  
                 c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   R e q u e s t   n o t   f o u n d ' ,   {   r e q u e s t I d   } )  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' R i c h i e s t a   n o n   t r o v a t a . ' ,  
                 }  
             }  
  
             / /   C a s o   2 :   R i c h i e s t a   e s i s t e   m a   s t a t u s   N O N   √ ®   p e n d i n g / m a n u a l _ r e v i e w   ‚      g i √ †   p r o c e s s a t a  
             i f   ( e x i s t i n g R e q u e s t . s t a t u s   ! = =   ' p e n d i n g '   & &   e x i s t i n g R e q u e s t . s t a t u s   ! = =   ' m a n u a l _ r e v i e w ' )   {  
                 c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   R e q u e s t   a l r e a d y   p r o c e s s e d ' ,   {  
                     r e q u e s t I d ,  
                     c u r r e n t S t a t u s :   e x i s t i n g R e q u e s t . s t a t u s ,  
                     a p p r o v e d B y :   e x i s t i n g R e q u e s t . a p p r o v e d _ b y ,  
                     a p p r o v e d A t :   e x i s t i n g R e q u e s t . a p p r o v e d _ a t ,  
                 } )  
                 r e t u r n   {  
                     s u c c e s s :   f a l s e ,  
                     e r r o r :   ' R i c h i e s t a   g i √ †   p r o c e s s a t a . ' ,  
                 }  
             }  
  
             / /   C a s o   3 :   R i c h i e s t a   e s i s t e   e   s t a t u s   √ ®   a n c o r a   p e n d i n g / m a n u a l _ r e v i e w   ‚      U P D A T E   f a l l i t o   p e r   a l t r i   m o t i v i  
             c o n s o l e . w a r n ( ' [ T O P U P _ A P P R O V E ]   U P D A T E   f a i l e d   b u t   s t a t u s   s t i l l   p e n d i n g / m a n u a l _ r e v i e w .   A t t e m p t i n g   R P C   f a l l b a c k . ' ,   {  
                 r e q u e s t I d ,  
                 u p d a t e E r r o r :   u p d a t e E r r o r ? . m e s s a g e  
             } )  
              
             / /   F A L L B A C K :   P r o v a   f u n z i o n e   R P C   ( S E C U R I T Y   D E F I N E R )  
             / /   Q u e s t o   b y p a s s a   R L S   s e   l a   p o l i c y   U P D A T E   f a l l i s c e   e   s e   l a   f u n z i o n e   e s i s t e  
             t r y   {  
                 l o g ( ' A t t e m p t i n g   R P C   f a l l b a c k ' ) ;  
                 c o n s t   {   d a t a :   r p c R e s u l t ,   e r r o r :   r p c E r r o r   }   =   a w a i t   s u p a b a s e A d m i n . r p c ( ' a p p r o v e _ t o p _ u p _ r e q u e s t ' ,   {  
                     p _ r e q u e s t _ i d :   r e q u e s t I d ,  
                     p _ a d m i n _ u s e r _ i d :   a d m i n C h e c k . u s e r I d ,  
                     p _ a p p r o v e d _ a m o u n t :   a m o u n t T o C r e d i t  
                 } )  
  
                 i f   ( r p c E r r o r )   {  
                           l o g ( ' R P C   E r r o r   t h r o w n ' ,   r p c E r r o r ) ;  
                           t h r o w   r p c E r r o r  
                 }  
  
                 / /   S e   R P C   r i t o r n a   a r r a y   ( p a t t e r n   c o m u n e   i n   P G   f u n c t i o n s )   o   o g g e t t o  
                 c o n s t   r e s u l t R o w   =   A r r a y . i s A r r a y ( r p c R e s u l t )   ?   r p c R e s u l t [ 0 ]   :   r p c R e s u l t  
                 l o g ( ' R P C   R e s u l t   R o w ' ,   r e s u l t R o w ) ;  
  
                 i f   ( ! r e s u l t R o w   | |   ! r e s u l t R o w . s u c c e s s )   {  
                         c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   R P C   f a l l b a c k   f a i l e d   l o g i c ' ,   r e s u l t R o w )  
                         l o g ( ' R P C   F a i l e d   L o g i c ' ,   r e s u l t R o w ) ;  
                         r e t u r n   {  
                                 s u c c e s s :   f a l s e ,    
                                 e r r o r :   r e s u l t R o w ? . e r r o r _ m e s s a g e   | |   ' I m p o s s i b i l e   a p p r o v a r e :   a n c h e   R P C   f a l l b a c k   f a l l i t o . '  
                         }  
                 }  
  
                 / /   S e   R P C   h a   s u c c e s s o ,   c o n s i d e r i a m o   l ' u p d a t e   f a t t o .  
                 / /   R e c u p e r i a m o   r e q u e s t   a g g i o r n a t a   p e r   s i c u r e z z a   e   p e r   a v e r e   u s e r _ i d  
                 c o n s t   {   d a t a :   r e f r e s h e d R e q u e s t ,   e r r o r :   r e f r e s h E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
                         . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
                         . s e l e c t ( ' i d ,   u s e r _ i d ,   a p p r o v e d _ a m o u n t ,   s t a t u s ' )  
                         . e q ( ' i d ' ,   r e q u e s t I d )  
                         . s i n g l e ( )  
                          
                 i f   ( r e f r e s h E r r o r   | |   ! r e f r e s h e d R e q u e s t )   {  
                         r e t u r n   {   s u c c e s s :   f a l s e ,   e r r o r :   ' E r r o r e   p o s t - R P C :   i m p o s s i b i l e   r i l e g g e r e   l a   r i c h i e s t a . '   }  
                 }  
                  
                   c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   R P C   f a l l b a c k   s u c c e s s f u l ' ,   {  
                     r e q u e s t I d ,  
                     u s e r I d :   r e f r e s h e d R e q u e s t . u s e r _ i d ,  
                     a p p r o v e d A m o u n t :   r e f r e s h e d R e q u e s t . a p p r o v e d _ a m o u n t ,  
                 } )  
                  
                 / /   7 .   A c c r e d i t a   w a l l e t   u s a n d o   R P C   ( n o   f a l l b a c k   m a n u a l e )  
                 c o n s t   {   d a t a :   t x I d ,   e r r o r :   c r e d i t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n . r p c ( ' a d d _ w a l l e t _ c r e d i t ' ,   {  
                     p _ u s e r _ i d :   r e f r e s h e d R e q u e s t . u s e r _ i d ,  
                     p _ a m o u n t :   r e f r e s h e d R e q u e s t . a p p r o v e d _ a m o u n t ,   / /   U s a   q u e l l o   s a l v a t o   n e l   D B  
                     p _ d e s c r i p t i o n :   ` A p p r o v a z i o n e   r i c h i e s t a   r i c a r i c a   # $ { r e q u e s t I d } ` ,  
                     p _ c r e a t e d _ b y :   a d m i n C h e c k . u s e r I d ,  
                 } )  
                  
                 i f   ( c r e d i t E r r o r )   {  
                           c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   R P C   a d d _ w a l l e t _ c r e d i t   f a i l e d   ( i n   f a l l b a c k ) ' ,   c r e d i t E r r o r )  
                           r e t u r n   {   s u c c e s s :   f a l s e ,   e r r o r :   ' S t a t u s   a g g i o r n a t o   m a   a c c r e d i t o   w a l l e t   f a l l i t o .   C o n t a t t a r e   s u p p o r t o . '   }  
                 }  
                  
                 / /   A u d i t   l o g   ( n o n   b l o c c a n t e )  
                 t r y   {  
                     c o n s t   s e s s i o n   =   a w a i t   a u t h ( )  
                     a w a i t   s u p a b a s e A d m i n . f r o m ( ' a u d i t _ l o g s ' ) . i n s e r t ( {  
                         a c t i o n :   ' t o p _ u p _ r e q u e s t _ a p p r o v e d _ r p c ' ,  
                         r e s o u r c e _ t y p e :   ' t o p _ u p _ r e q u e s t ' ,  
                         r e s o u r c e _ i d :   r e q u e s t I d ,  
                         u s e r _ e m a i l :   s e s s i o n ? . u s e r ? . e m a i l   | |   ' u n k n o w n ' ,  
                         u s e r _ i d :   a d m i n C h e c k . u s e r I d ,  
                         m e t a d a t a :   {  
                               m e t h o d :   ' r p c _ f a l l b a c k ' ,  
                               a m o u n t :   r e f r e s h e d R e q u e s t . a p p r o v e d _ a m o u n t ,  
                               t a r g e t :   r e f r e s h e d R e q u e s t . u s e r _ i d  
                         }  
                     } )  
                 }   c a t c h   ( e )   { }  
  
                 r e t u r n   {  
                         s u c c e s s :   t r u e ,  
                         m e s s a g e :   ` R i c h i e s t a   a p p r o v a t a   ( R P C ) .   C r e d i t o   d i   ‚  ¨ $ { r e f r e s h e d R e q u e s t . a p p r o v e d _ a m o u n t }   a c c r e d i t a t o . ` ,  
                         t r a n s a c t i o n I d :   t x I d  
                 }  
  
             }   c a t c h   ( r p c E r r :   a n y )   {  
                     c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   R P C   f a l l b a c k   e x c e p t i o n ' ,   r p c E r r )  
                     r e t u r n   {  
                         s u c c e s s :   f a l s e ,  
                         e r r o r :   ' I m p o s s i b i l e   a p p r o v a r e :   U P D A T E   f a l l i t o   e   R P C   e r r o r e :   '   +   r p c E r r . m e s s a g e ,  
                     }  
             }  
         }  
  
         / /   6 .   U P D A T E   r i u s c i t o :   l o g   e   p r o c e d i   c o n   a c c r e d i t o   w a l l e t  
         c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   U P D A T E   s u c c e s s f u l ' ,   {  
             r e q u e s t I d ,  
             u s e r I d :   u p d a t e d R e q u e s t . u s e r _ i d ,  
             a p p r o v e d A m o u n t :   a m o u n t T o C r e d i t ,  
             a d m i n U s e r I d :   a d m i n C h e c k . u s e r I d ,  
         } )  
  
         / /   7 .   A c c r e d i t a   w a l l e t   u s a n d o   R P C   ( n o   f a l l b a c k   m a n u a l e )  
         c o n s t   {   d a t a :   t x I d ,   e r r o r :   c r e d i t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n . r p c ( ' a d d _ w a l l e t _ c r e d i t ' ,   {  
             p _ u s e r _ i d :   u p d a t e d R e q u e s t . u s e r _ i d ,  
             p _ a m o u n t :   a m o u n t T o C r e d i t ,  
             p _ d e s c r i p t i o n :   ` A p p r o v a z i o n e   r i c h i e s t a   r i c a r i c a   # $ { r e q u e s t I d } ` ,  
             p _ c r e a t e d _ b y :   a d m i n C h e c k . u s e r I d ,  
         } )  
  
         i f   ( c r e d i t E r r o r )   {  
             c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   R P C   a d d _ w a l l e t _ c r e d i t   f a i l e d ' ,   {  
                 r e q u e s t I d ,  
                 u s e r I d :   u p d a t e d R e q u e s t . u s e r _ i d ,  
                 a m o u n t :   a m o u n t T o C r e d i t ,  
                 c r e d i t E r r o r :   c r e d i t E r r o r . m e s s a g e ,  
                 c r e d i t E r r o r C o d e :   c r e d i t E r r o r . c o d e ,  
                 c r e d i t E r r o r D e t a i l s :   c r e d i t E r r o r . d e t a i l s ,  
             } )  
              
             / /   R o l l b a c k :   r i p r i s t i n a   r i c h i e s t a   a   s t a t u s   p e n d i n g  
             c o n s t   {   e r r o r :   r o l l b a c k E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
                 . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
                 . u p d a t e ( {  
                     s t a t u s :   ' p e n d i n g ' ,  
                     a p p r o v e d _ b y :   n u l l ,  
                     a p p r o v e d _ a t :   n u l l ,  
                     a p p r o v e d _ a m o u n t :   n u l l ,  
                     u p d a t e d _ a t :   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,  
                 } )  
                 . e q ( ' i d ' ,   r e q u e s t I d )  
  
             i f   ( r o l l b a c k E r r o r )   {  
                 c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   R o l l b a c k   f a i l e d   -   C R I T I C A L :   r e q u e s t   i n   i n c o n s i s t e n t   s t a t e ' ,   {  
                     r e q u e s t I d ,  
                     r o l l b a c k E r r o r :   r o l l b a c k E r r o r . m e s s a g e ,  
                     r o l l b a c k E r r o r C o d e :   r o l l b a c k E r r o r . c o d e ,  
                     r o l l b a c k E r r o r D e t a i l s :   r o l l b a c k E r r o r . d e t a i l s ,  
                 } )  
                 / /   L o g   c r i t i c o :   r i c h i e s t a   i n   s t a t o   i n c o n s i s t e n t e  
             }   e l s e   {  
                 c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   R o l l b a c k   s u c c e s s f u l ' ,   {   r e q u e s t I d   } )  
             }  
  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' C r e d i t o   n o n   a c c r e d i t a t o ,   r i c h i e s t a   r i p r i s t i n a t a . ' ,  
             }  
         }  
  
         c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   W a l l e t   c r e d i t   s u c c e s s f u l ' ,   {  
             r e q u e s t I d ,  
             t r a n s a c t i o n I d :   t x I d ,  
             u s e r I d :   u p d a t e d R e q u e s t . u s e r _ i d ,  
             a m o u n t :   a m o u n t T o C r e d i t ,  
         } )  
  
         / /   8 .   A u d i t   l o g   ( n o n   b l o c c a n t e )  
         t r y   {  
             c o n s t   s e s s i o n   =   a w a i t   a u t h ( )  
             / /   R e c u p e r a   a m o u n t   o r i g i n a l e   p e r   a u d i t   ( s e   n o n   g i √ †   n o t o )  
             c o n s t   r e q u e s t A m o u n t   =   a p p r o v e d A m o u n t   = = =   u n d e f i n e d    
                 ?   a m o u n t T o C r e d i t    
                 :   ( a w a i t   s u p a b a s e A d m i n . f r o m ( ' t o p _ u p _ r e q u e s t s ' ) . s e l e c t ( ' a m o u n t ' ) . e q ( ' i d ' ,   r e q u e s t I d ) . m a y b e S i n g l e ( ) ) . d a t a ? . a m o u n t   | |   a m o u n t T o C r e d i t  
  
             a w a i t   s u p a b a s e A d m i n . f r o m ( ' a u d i t _ l o g s ' ) . i n s e r t ( {  
                 a c t i o n :   ' t o p _ u p _ r e q u e s t _ a p p r o v e d ' ,  
                 r e s o u r c e _ t y p e :   ' t o p _ u p _ r e q u e s t ' ,  
                 r e s o u r c e _ i d :   r e q u e s t I d ,  
                 u s e r _ e m a i l :   s e s s i o n ? . u s e r ? . e m a i l   | |   ' u n k n o w n ' ,  
                 u s e r _ i d :   a d m i n C h e c k . u s e r I d ,  
                 m e t a d a t a :   {  
                     r e q u e s t _ a m o u n t :   r e q u e s t A m o u n t ,  
                     a p p r o v e d _ a m o u n t :   a m o u n t T o C r e d i t ,  
                     t a r g e t _ u s e r _ i d :   u p d a t e d R e q u e s t . u s e r _ i d ,  
                     t r a n s a c t i o n _ i d :   t x I d ,  
                 }  
             } )  
             c o n s o l e . i n f o ( ' [ T O P U P _ A P P R O V E ]   A u d i t   l o g   i n s e r t e d ' ,   {   r e q u e s t I d   } )  
         }   c a t c h   ( a u d i t E r r o r )   {  
             c o n s o l e . w a r n ( ' [ T O P U P _ A P P R O V E ]   A u d i t   l o g   f a i l e d   ( n o n - b l o c k i n g ) ' ,   {  
                 r e q u e s t I d ,  
                 a u d i t E r r o r :   a u d i t E r r o r   i n s t a n c e o f   E r r o r   ?   a u d i t E r r o r . m e s s a g e   :   ' U n k n o w n   e r r o r ' ,  
             } )  
         }  
  
         r e t u r n   {  
             s u c c e s s :   t r u e ,  
             m e s s a g e :   ` R i c h i e s t a   a p p r o v a t a .   C r e d i t o   d i   ‚  ¨ $ { a m o u n t T o C r e d i t }   a c c r e d i t a t o . ` ,  
             t r a n s a c t i o n I d :   t x I d ,  
         }  
     }   c a t c h   ( e r r o r :   a n y )   {  
         c o n s o l e . e r r o r ( ' [ T O P U P _ A P P R O V E ]   U n e x p e c t e d   e r r o r ' ,   {  
             r e q u e s t I d ,  
             e r r o r :   e r r o r . m e s s a g e ,  
             e r r o r S t a c k :   e r r o r . s t a c k ,  
         } )  
         r e t u r n   {  
             s u c c e s s :   f a l s e ,  
             e r r o r :   e r r o r . m e s s a g e   | |   ' E r r o r e   d u r a n t e   l \ ' a p p r o v a z i o n e . ' ,  
         }  
     }  
 }  
  
 / * *  
   *   S e r v e r   A c t i o n :   R i f i u t a   u n a   r i c h i e s t a   t o p _ u p _ r e q u e s t s  
   *    
   *   @ p a r a m   r e q u e s t I d   -   I D   d e l l a   r i c h i e s t a   d a   r i f i u t a r e  
   *   @ p a r a m   r e a s o n   -   M o t i v o   d e l   r i f i u t o  
   *   @ r e t u r n s   R i s u l t a t o   o p e r a z i o n e  
   * /  
 e x p o r t   a s y n c   f u n c t i o n   r e j e c t T o p U p R e q u e s t (  
     r e q u e s t I d :   s t r i n g ,  
     r e a s o n :   s t r i n g  
 ) :   P r o m i s e < {  
     s u c c e s s :   b o o l e a n  
     m e s s a g e ? :   s t r i n g  
     e r r o r ? :   s t r i n g  
 } >   {  
     t r y   {  
         / /   1 .   V e r i f i c a   a d m i n  
         c o n s t   a d m i n C h e c k   =   a w a i t   v e r i f y A d m i n A c c e s s ( )  
         i f   ( ! a d m i n C h e c k . i s A d m i n   | |   ! a d m i n C h e c k . u s e r I d )   {  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' S o l o   g l i   A d m i n   p o s s o n o   r i f i u t a r e   r i c h i e s t e   d i   r i c a r i c a . ' ,  
             }  
         }  
  
         / /   2 .   R e c u p e r a   r i c h i e s t a  
         c o n s t   {   d a t a :   r e q u e s t ,   e r r o r :   r e q u e s t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
             . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
             . s e l e c t ( ' * ' )  
             . e q ( ' i d ' ,   r e q u e s t I d )  
             . s i n g l e ( )  
  
         i f   ( r e q u e s t E r r o r   | |   ! r e q u e s t )   {  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' R i c h i e s t a   n o n   t r o v a t a . ' ,  
             }  
         }  
  
         / /   3 .   V e r i f i c a   s t a t u s  
         i f   ( r e q u e s t . s t a t u s   ! = =   ' p e n d i n g '   & &   r e q u e s t . s t a t u s   ! = =   ' m a n u a l _ r e v i e w ' )   {  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ` R i c h i e s t a   g i √ †   p r o c e s s a t a .   S t a t u s   a t t u a l e :   $ { r e q u e s t . s t a t u s } ` ,  
             }  
         }  
  
         / /   4 .   A g g i o r n a   r i c h i e s t a :   s t a t u s = r e j e c t e d  
         c o n s t   {   e r r o r :   u p d a t e E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
             . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
             . u p d a t e ( {  
                 s t a t u s :   ' r e j e c t e d ' ,  
                 a p p r o v e d _ b y :   a d m i n C h e c k . u s e r I d ,  
                 a p p r o v e d _ a t :   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,  
                 a d m i n _ n o t e s :   r e a s o n   | |   ' R i f i u t a t a   d a   a d m i n ' ,  
                 u p d a t e d _ a t :   n e w   D a t e ( ) . t o I S O S t r i n g ( ) ,  
             } )  
             . e q ( ' i d ' ,   r e q u e s t I d )  
  
         i f   ( u p d a t e E r r o r )   {  
             c o n s o l e . e r r o r ( ' E r r o r e   a g g i o r n a m e n t o   r i c h i e s t a : ' ,   u p d a t e E r r o r )  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   u p d a t e E r r o r . m e s s a g e   | |   ' E r r o r e   d u r a n t e   i l   r i f i u t o   d e l l a   r i c h i e s t a . ' ,  
             }  
         }  
  
         / /   5 .   A u d i t   l o g  
         t r y   {  
             c o n s t   s e s s i o n   =   a w a i t   a u t h ( )  
             a w a i t   s u p a b a s e A d m i n . f r o m ( ' a u d i t _ l o g s ' ) . i n s e r t ( {  
                 a c t i o n :   ' t o p _ u p _ r e q u e s t _ r e j e c t e d ' ,  
                 r e s o u r c e _ t y p e :   ' t o p _ u p _ r e q u e s t ' ,  
                 r e s o u r c e _ i d :   r e q u e s t I d ,  
                 u s e r _ e m a i l :   s e s s i o n ? . u s e r ? . e m a i l   | |   ' u n k n o w n ' ,  
                 u s e r _ i d :   a d m i n C h e c k . u s e r I d ,  
                 m e t a d a t a :   {  
                     r e q u e s t _ a m o u n t :   r e q u e s t . a m o u n t ,  
                     r e a s o n :   r e a s o n   | |   ' N e s s u n   m o t i v o   s p e c i f i c a t o ' ,  
                     t a r g e t _ u s e r _ i d :   r e q u e s t . u s e r _ i d ,  
                 }  
             } )  
         }   c a t c h   ( a u d i t E r r o r )   {  
             c o n s o l e . w a r n ( ' E r r o r e   a u d i t   l o g : ' ,   a u d i t E r r o r )  
         }  
  
         r e t u r n   {  
             s u c c e s s :   t r u e ,  
             m e s s a g e :   ' R i c h i e s t a   r i f i u t a t a   c o n   s u c c e s s o . ' ,  
         }  
     }   c a t c h   ( e r r o r :   a n y )   {  
         c o n s o l e . e r r o r ( ' E r r o r e   i n   r e j e c t T o p U p R e q u e s t : ' ,   e r r o r )  
         r e t u r n   {  
             s u c c e s s :   f a l s e ,  
             e r r o r :   e r r o r . m e s s a g e   | |   ' E r r o r e   d u r a n t e   i l   r i f i u t o . ' ,  
         }  
     }  
 }  
  
 / * *  
   *   S e r v e r   A c t i o n :   E l i m i n a   u n a   r i c h i e s t a   t o p _ u p _ r e q u e s t s  
   *    
   *   ‚ a† Ô ∏ è   A T T E N Z I O N E :   S o l o   p e r   r i c h i e s t e   p e n d i n g / m a n u a l _ r e v i e w   n o n   a n c o r a   p r o c e s s a t e  
   *    
   *   @ p a r a m   r e q u e s t I d   -   I D   d e l l a   r i c h i e s t a   d a   e l i m i n a r e  
   *   @ r e t u r n s   R i s u l t a t o   o p e r a z i o n e  
   * /  
 e x p o r t   a s y n c   f u n c t i o n   d e l e t e T o p U p R e q u e s t (  
     r e q u e s t I d :   s t r i n g  
 ) :   P r o m i s e < {  
     s u c c e s s :   b o o l e a n  
     m e s s a g e ? :   s t r i n g  
     e r r o r ? :   s t r i n g  
 } >   {  
     t r y   {  
         / /   1 .   V e r i f i c a   a d m i n  
         c o n s t   a d m i n C h e c k   =   a w a i t   v e r i f y A d m i n A c c e s s ( )  
         i f   ( ! a d m i n C h e c k . i s A d m i n   | |   ! a d m i n C h e c k . u s e r I d )   {  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' S o l o   g l i   A d m i n   p o s s o n o   e l i m i n a r e   r i c h i e s t e . ' ,  
             }  
         }  
  
         / /   2 .   R e c u p e r a   r i c h i e s t a  
         c o n s t   {   d a t a :   r e q u e s t ,   e r r o r :   r e q u e s t E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
             . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
             . s e l e c t ( ' s t a t u s ,   f i l e _ u r l ,   f i l e _ h a s h ,   u s e r _ i d ,   a m o u n t ' )  
             . e q ( ' i d ' ,   r e q u e s t I d )  
             . s i n g l e ( )  
  
         i f   ( r e q u e s t E r r o r   | |   ! r e q u e s t )   {  
             / /   S e   n o n   e s i s t e ,   c o n s i d e r a   s u c c e s s o   ( g i √ †   e l i m i n a t a )  
             r e t u r n   {  
                 s u c c e s s :   t r u e ,  
                 m e s s a g e :   ' R i c h i e s t a   n o n   t r o v a t a   ( g i √ †   e l i m i n a t a ? ) . ' ,  
             }  
         }  
  
         / /   3 .   V e r i f i c a :   n o n   e l i m i n a r e   s e   g i √ †   a p p r o v e d   ( p e r   s t o r i c o )  
         i f   ( r e q u e s t . s t a t u s   = = =   ' a p p r o v e d ' )   {  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   ' I m p o s s i b i l e   e l i m i n a r e   u n a   r i c h i e s t a   g i √ †   a p p r o v a t a   ( m o t i v i   c o n t a b i l i ) . ' ,  
             }  
         }  
  
         / /   4 .   E l i m i n a   f i l e   d a   s t o r a g e   ( s e   e s i s t e )  
         i f   ( r e q u e s t . f i l e _ u r l )   {  
             t r y   {  
                 c o n s t   u r l P a r t s   =   r e q u e s t . f i l e _ u r l . s p l i t ( ' / r e c e i p t s / ' )  
                 i f   ( u r l P a r t s . l e n g t h   >   1 )   {  
                     c o n s t   f i l e P a t h   =   u r l P a r t s [ 1 ]  
                     a w a i t   s u p a b a s e A d m i n . s t o r a g e . f r o m ( ' r e c e i p t s ' ) . r e m o v e ( [ f i l e P a t h ] )  
                 }  
             }   c a t c h   ( s t o r a g e E r r o r )   {  
                 c o n s o l e . w a r n ( ' E r r o r e   e l i m i n a z i o n e   f i l e   s t o r a g e : ' ,   s t o r a g e E r r o r )  
             }  
         }  
  
         / /   5 .   E l i m i n a   r e c o r d   D B  
         c o n s t   {   e r r o r :   d e l e t e E r r o r   }   =   a w a i t   s u p a b a s e A d m i n  
             . f r o m ( ' t o p _ u p _ r e q u e s t s ' )  
             . d e l e t e ( )  
             . e q ( ' i d ' ,   r e q u e s t I d )  
  
         i f   ( d e l e t e E r r o r )   {  
             c o n s o l e . e r r o r ( ' E r r o r e   e l i m i n a z i o n e   r e c o r d : ' ,   d e l e t e E r r o r )  
             r e t u r n   {  
                 s u c c e s s :   f a l s e ,  
                 e r r o r :   d e l e t e E r r o r . m e s s a g e   | |   ' E r r o r e   d u r a n t e   l \ ' e l i m i n a z i o n e   d a t a b a s e . ' ,  
             }  
         }  
  
         / /   6 .   A u d i t   l o g  
         t r y   {  
             c o n s t   s e s s i o n   =   a w a i t   a u t h ( )  
             a w a i t   s u p a b a s e A d m i n . f r o m ( ' a u d i t _ l o g s ' ) . i n s e r t ( {  
                 a c t i o n :   ' t o p _ u p _ r e q u e s t _ d e l e t e d ' ,  
                 r e s o u r c e _ t y p e :   ' t o p _ u p _ r e q u e s t ' ,  
                 r e s o u r c e _ i d :   r e q u e s t I d ,  
                 u s e r _ e m a i l :   s e s s i o n ? . u s e r ? . e m a i l   | |   ' u n k n o w n ' ,  
                 u s e r _ i d :   a d m i n C h e c k . u s e r I d ,  
                 m e t a d a t a :   {  
                     r e q u e s t _ a m o u n t :   r e q u e s t . a m o u n t ,  
                     s t a t u s _ a t _ d e l e t i o n :   r e q u e s t . s t a t u s ,  
                     t a r g e t _ u s e r _ i d :   r e q u e s t . u s e r _ i d ,  
                 }  
             } )  
         }   c a t c h   ( a u d i t E r r o r )   {  
             c o n s o l e . w a r n ( ' E r r o r e   a u d i t   l o g : ' ,   a u d i t E r r o r )  
         }  
  
         r e t u r n   {  
             s u c c e s s :   t r u e ,  
             m e s s a g e :   ' R i c h i e s t a   e l i m i n a t a   c o n   s u c c e s s o . ' ,  
         }  
     }   c a t c h   ( e r r o r :   a n y )   {  
         c o n s o l e . e r r o r ( ' E r r o r e   i n   d e l e t e T o p U p R e q u e s t : ' ,   e r r o r )  
         r e t u r n   {  
             s u c c e s s :   f a l s e ,  
             e r r o r :   e r r o r . m e s s a g e   | |   ' E r r o r e   d u r a n t e   l a   c a n c e l l a z i o n e . ' ,  
         }  
     }  
 }  
 
=======

/**
 * Server Action: Approva una top_up_request
 * 
 * @param id - ID della richiesta
 * @param approvedAmount - Importo da approvare
 * @returns Risultato operazione
 */
export async function approveTopUpRequest(
  id: string,
  approvedAmount: number
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'Solo gli Admin possono approvare richieste.',
      }
    }

    // 2. Valida importo
    if (approvedAmount <= 0) {
      return {
        success: false,
        error: 'L\'importo approvato deve essere positivo.',
      }
    }

    // 3. Aggiorna status della richiesta
    const { data, error } = await supabaseAdmin
      .from('top_up_requests')
      .update({
        status: 'approved',
        approved_amount: approvedAmount,
        approved_by: adminCheck.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('user_id')
      .single()

    if (error || !data) {
      console.error('Errore aggiornamento status:', error)
      return {
        success: false,
        error: error?.message || 'Errore durante l\'approvazione della richiesta.',
      }
    }

    // 4. Aggiungi credito al wallet dell'utente
    const { error: creditError } = await supabaseAdmin.rpc('add_wallet_credit', {
      p_user_id: data.user_id,
      p_amount: approvedAmount,
      p_description: `Ricarica approvata da admin - Richiesta ${id.slice(0, 8)}...`,
      p_created_by: adminCheck.userId,
    })

    if (creditError) {
      console.error('Errore add_wallet_credit:', creditError)
      return {
        success: false,
        error: creditError.message || 'Errore durante l\'accredito del wallet.',
      }
    }

    // 5. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_approved',
        resource_type: 'top_up_request',
        resource_id: id,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {
          approved_amount: approvedAmount,
          target_user_id: data.user_id,
        },
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: `Richiesta approvata con successo. ‚Ç¨ ${approvedAmount} accreditati al wallet.`,
    }
  } catch (error: any) {
    console.error('Errore in approveTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante l\'approvazione della richiesta.',
    }
  }
}

/**
 * Server Action: Rifiuta una top_up_request
 * 
 * @param id - ID della richiesta
 * @param reason - Motivo del rifiuto
 * @returns Risultato operazione
 */
export async function rejectTopUpRequest(
  id: string,
  reason: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'Solo gli Admin possono rifiutare richieste.',
      }
    }

    // 2. Valida motivo
    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: 'Inserisci un motivo per il rifiuto.',
      }
    }

    // 3. Aggiorna status della richiesta
    const { error } = await supabaseAdmin
      .from('top_up_requests')
      .update({
        status: 'rejected',
        approved_by: adminCheck.userId,
        approved_at: new Date().toISOString(),
        admin_notes: reason,
      })
      .eq('id', id)

    if (error) {
      console.error('Errore aggiornamento status:', error)
      return {
        success: false,
        error: error.message || 'Errore durante il rifiuto della richiesta.',
      }
    }

    // 4. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_rejected',
        resource_type: 'top_up_request',
        resource_id: id,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {
          reason: reason,
        },
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: 'Richiesta rifiutata con successo.',
    }
  } catch (error: any) {
    console.error('Errore in rejectTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il rifiuto della richiesta.',
    }
  }
}

/**
 * Server Action: Elimina una top_up_request
 * 
 * @param id - ID della richiesta
 * @returns Risultato operazione
 */
export async function deleteTopUpRequest(
  id: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica admin
    const adminCheck = await verifyAdminAccess()
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'Solo gli Admin possono eliminare richieste.',
      }
    }

    // 2. Elimina la richiesta
    const { error } = await supabaseAdmin
      .from('top_up_requests')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Errore eliminazione:', error)
      return {
        success: false,
        error: error.message || 'Errore durante l\'eliminazione della richiesta.',
      }
    }

    // 3. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: 'top_up_request_deleted',
        resource_type: 'top_up_request',
        resource_id: id,
        user_email: session?.user?.email || 'unknown',
        user_id: adminCheck.userId,
        metadata: {},
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    return {
      success: true,
      message: 'Richiesta eliminata con successo.',
    }
  } catch (error: any) {
    console.error('Errore in deleteTopUpRequest:', error)
    return {
      success: false,
      error: error.message || 'Errore durante l\'eliminazione della richiesta.',
    }
  }
      }
>>>>>>> origin/master
