/**
 * Route API per verificare lo stato dell'applicazione
 * Utile per monitoring e health checks
 * 
 * Endpoint: GET /api/health
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
    { status: 200 }
  );
}

