/**
 * Liveness probe
 *
 * Endpoint: GET /api/health/live
 * Deve rispondere 200 se l'istanza è viva.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
