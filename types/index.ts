/**
 * Types - Central Export
 *
 * Export centralizzato di tutti i tipi TypeScript del progetto
 */

// Legacy types (mantenuti per retrocompatibilità)
export interface Spedizione {
  id: string
  mittente: string
  destinatario: string
  peso: number
  dimensioni: {
    lunghezza: number
    larghezza: number
    altezza: number
  }
  prezzoBase: number
  margine: number
  prezzoFinale: number
  dataCreazione: string
}

export interface Preventivo {
  id: string
  peso: number
  dimensioni: {
    lunghezza: number
    larghezza: number
    altezza: number
  }
  destinazione: string
  prezzoBase: number
  marginePercentuale: number
  prezzoFinale: number
}

export interface ConfigurazioneMargine {
  margineDefault: number
  margineMinimo: number
  margineMassimo: number
}

// New types (production-ready)
export * from './shipments';
export * from './listini';
export * from './products';
export * from './warehouse';
export * from './ecommerce';
export * from './analytics';
export * from './diagnostics';

