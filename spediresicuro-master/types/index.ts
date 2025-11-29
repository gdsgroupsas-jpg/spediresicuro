// Definizioni TypeScript per il progetto

// Tipo per una spedizione
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

// Tipo per un preventivo
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

// Tipo per configurazione margine
export interface ConfigurazioneMargine {
  margineDefault: number
  margineMinimo: number
  margineMassimo: number
}

