/**
 * Database Adapter — Barrel Export
 *
 * Re-esporta tutti i moduli per backward compatibility.
 * Tutti i file che importano da '@/lib/database' continuano a funzionare.
 *
 * Moduli:
 * - types.ts: Interfacce e tipi (User, DatiCliente, DefaultSender, Integrazione, EmailNotConfirmedError)
 * - json-store.ts: Operazioni legacy JSON (readDatabase, writeDatabase, addPreventivo, ecc.)
 * - users.ts: Gestione utenti Supabase (createUser, updateUser, findUserByEmail, ecc.)
 * - shipments.ts: Operazioni spedizioni Supabase (addSpedizione, getSpedizioni)
 */

export * from './types';
export * from './json-store';
export * from './users';
export * from './shipments';
