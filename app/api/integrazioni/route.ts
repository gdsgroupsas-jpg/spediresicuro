/**
 * API Route per Gestione Integrazioni
 * 
 * GET: Recupera tutte le integrazioni dell'utente
 * POST: Salva/aggiorna un'integrazione
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { findUserByEmail, updateUser } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const user = await findUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Recupera integrazioni dall'utente (da implementare nel database)
    const integrations = user.integrazioni || []

    return NextResponse.json({
      integrations,
    })
  } catch (error: any) {
    console.error('Errore recupero integrazioni:', error)
    return NextResponse.json(
      { error: 'Errore durante il recupero delle integrazioni' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const user = await findUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { platform, credentials } = body

    if (!platform || !credentials) {
      return NextResponse.json(
        { error: 'Platform e credentials sono obbligatori' },
        { status: 400 }
      )
    }

    // Salva integrazione (da implementare nel database)
    const integrations = user.integrazioni || []
    const existingIndex = integrations.findIndex((i: any) => i.platform === platform)

    const integration = {
      platform,
      credentials,
      connectedAt: new Date().toISOString(),
      status: 'active' as const,
    }

    if (existingIndex >= 0) {
      integrations[existingIndex] = integration
    } else {
      integrations.push(integration)
    }

    // Aggiorna utente (da estendere il database per supportare integrazioni)
    updateUser(user.id, {
      integrazioni: integrations,
    })

    return NextResponse.json({
      success: true,
      message: 'Integrazione salvata con successo',
      integration,
    })
  } catch (error: any) {
    console.error('Errore salvataggio integrazione:', error)
    return NextResponse.json(
      { error: 'Errore durante il salvataggio dell\'integrazione' },
      { status: 500 }
    )
  }
}

