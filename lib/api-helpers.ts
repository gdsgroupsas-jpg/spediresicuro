/**
 * API Helpers
 * 
 * Utility per estrarre requestId e userId dalle richieste API
 * e creare logger strutturato
 */

import { NextRequest } from 'next/server';
import { auth } from './auth-config';
import { createLogger, generateRequestId } from './logger';

/**
 * Estrae requestId da header o genera nuovo
 * 
 * @param request - NextRequest
 * @returns RequestId
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get('X-Request-ID') || generateRequestId();
}

/**
 * Estrae userId da sessione
 * 
 * @returns userId o undefined
 */
export async function getUserId(): Promise<string | undefined> {
  try {
    const session = await auth();
    return session?.user?.id;
  } catch {
    return undefined;
  }
}

/**
 * Crea logger strutturato per API route
 * 
 * @param request - NextRequest
 * @param userId - ID utente (opzionale, se già disponibile)
 * @returns Logger con requestId e userId
 */
export async function createApiLogger(
  request: NextRequest,
  userId?: string
) {
  const requestId = getRequestId(request);
  const finalUserId = userId || await getUserId();
  return createLogger(requestId, finalUserId);
}
