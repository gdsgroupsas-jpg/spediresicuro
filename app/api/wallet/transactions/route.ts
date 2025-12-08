import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'

// Forza rendering dinamico (usa headers())
export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/transactions
 * Ottiene le transazioni wallet dell'utente corrente
 */
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    // Ottieni ID utente
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Carica transazioni
    const { data: transactions, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select(`
        id,
        amount,
        type,
        description,
        created_at,
        created_by,
        users!wallet_transactions_created_by_fkey(name, email)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Errore caricamento transazioni:', error)
      return NextResponse.json(
        { error: 'Errore durante il caricamento delle transazioni' },
        { status: 500 }
      )
    }

    // Formatta transazioni
    const formattedTransactions = (transactions || []).map((tx: any) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      description: tx.description || '',
      created_at: tx.created_at,
      created_by: tx.users?.name || 'Sistema',
      balance_after: null, // Calcolato lato client se necessario
    }))

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
    })
  } catch (error: any) {
    console.error('Errore API transazioni wallet:', error)
    return NextResponse.json(
      { error: error.message || 'Errore del server' },
      { status: 500 }
    )
  }
}
