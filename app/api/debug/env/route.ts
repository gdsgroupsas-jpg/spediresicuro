/**
 * API Route: Debug Environment Variables
 * 
 * GET /api/debug/env
 * Mostra stato variabili d'ambiente (SOLO PER DEBUG)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  try {
    // Verifica che sia admin
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Lista variabili ambiente (senza valori sensibili completi)
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      
      // Anthropic
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY 
        ? `${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...${process.env.ANTHROPIC_API_KEY.substring(process.env.ANTHROPIC_API_KEY.length - 4)} (length: ${process.env.ANTHROPIC_API_KEY.length})`
        : '❌ NON CONFIGURATA',
      
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` 
        : '❌ NON CONFIGURATA',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY 
        ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}... (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})`
        : '❌ NON CONFIGURATA',
      
      // NextAuth
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET 
        ? `${process.env.NEXTAUTH_SECRET.substring(0, 10)}... (length: ${process.env.NEXTAUTH_SECRET.length})`
        : '❌ NON CONFIGURATA',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      
      // Google OAuth
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID 
        ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` 
        : '❌ NON CONFIGURATA',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET 
        ? `${process.env.GOOGLE_CLIENT_SECRET.substring(0, 10)}... (length: ${process.env.GOOGLE_CLIENT_SECRET.length})`
        : '❌ NON CONFIGURATA',
      
      // Tutte le chiavi che contengono "ANTHROPIC" o "CLAUDE"
      allAnthropicKeys: Object.keys(process.env).filter(k => 
        k.toUpperCase().includes('ANTHROPIC') || k.toUpperCase().includes('CLAUDE')
      ),
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      userEmail: session.user.email,
      environment: envVars,
      message: 'Environment variables status (valori parziali per sicurezza)'
    });

  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Errore verifica environment',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
