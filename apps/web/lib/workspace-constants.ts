/**
 * Workspace Constants
 *
 * Costanti condivise tra client e server per workspace management.
 * Questo file NON importa next/headers quindi è safe per uso client-side.
 *
 * @module lib/workspace-constants
 */

/** Header iniettato dal middleware per workspace ID */
export const WORKSPACE_HEADER = 'x-sec-workspace-id';

/**
 * Cookie per workspace ID
 * SECURITY: HttpOnly cookie impostato da /api/workspaces/switch
 * @sync Must match middleware.ts WORKSPACE_COOKIE_NAME
 */
export const WORKSPACE_COOKIE = 'sec-workspace-id';

/** Session storage key per workspace (localStorage) - client-side only */
export const WORKSPACE_STORAGE_KEY = 'spediresicuro_workspace_id';

/**
 * UUID v4 regex per validazione STRICT
 * Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * - 4 indica versione 4
 * - y deve essere 8, 9, a, o b (variant bits)
 * @sync Must match middleware.ts UUID validation
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @deprecated Use UUID_V4_REGEX for strict validation */
export const UUID_REGEX = UUID_V4_REGEX;

/**
 * Valida formato UUID v4 (strict)
 * @security Prevents malformed UUIDs from being used
 */
export function isValidUUID(value: string | null | undefined): value is string {
  if (!value) return false;
  return UUID_V4_REGEX.test(value);
}
