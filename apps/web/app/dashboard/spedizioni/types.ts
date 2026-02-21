export interface Spedizione {
  id: string;
  mittente: {
    nome: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  destinatario: {
    nome: string;
    indirizzo?: string;
    numeroCivico?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  peso: number;
  dimensioni?: {
    lunghezza: number;
    larghezza: number;
    altezza: number;
  };
  tipoSpedizione: string;
  prezzoFinale: number;
  createdAt: string;
  tracking?: string;
  status?: 'in_preparazione' | 'in_transito' | 'consegnata' | 'eccezione' | 'annullata';
  corriere?: string;
  imported?: boolean;
  importSource?: string;
  importPlatform?: string;
  verified?: boolean;
  order_id?: string;
  contrassegno?: number | string;
  assicurazione?: number | string;
  contenuto?: string;
  note?: string;
  totale_ordine?: number | string;
  rif_mittente?: string;
  rif_destinatario?: string;
  colli?: number;
  vat_mode?: 'included' | 'excluded' | null;
  vat_rate?: number;
  platform_fee?: number;
  workspaces?: {
    id: string;
    name: string;
    type: 'platform' | 'reseller' | 'client';
  } | null;
}
