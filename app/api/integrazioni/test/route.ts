/**
 * API Route per Test Connessione Integrazione
 * 
 * POST: Testa la connessione a una piattaforma e-commerce
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { createEcommerceAdapter } from '@/lib/adapters/ecommerce/base'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
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

    // Crea adapter e testa connessione
    try {
      const adapter = createEcommerceAdapter(platform, credentials)
      const isConnected = await adapter.connect()

      if (isConnected) {
        return NextResponse.json({
          success: true,
          message: 'Connessione riuscita!',
        })
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: 'Connessione fallita. Verifica le credenziali.' 
          },
          { status: 400 }
        )
      }
    } catch (error: any) {
      return NextResponse.json(
        { 
          success: false,
          error: error.message || 'Errore durante il test di connessione' 
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Errore test integrazione:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Errore durante il test di connessione' 
      },
      { status: 500 }
    )
  }
}

