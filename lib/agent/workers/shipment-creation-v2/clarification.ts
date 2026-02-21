/**
 * Genera il messaggio di richiesta integrazioni a partire da missingFields.
 * Usato dall'orchestratore quando la catena creazione spedizione ha campi mancanti.
 */

const FIELD_LABELS: Record<string, string> = {
  'sender.name': 'nome mittente',
  'sender.phone': 'telefono mittente',
  'recipient.fullName': 'nome destinatario',
  'recipient.addressLine1': 'indirizzo destinatario (via e numero civico)',
  'recipient.city': 'città destinatario',
  'recipient.postalCode': 'CAP destinatario',
  'recipient.province': 'provincia destinatario (2 lettere)',
  'recipient.phone': 'telefono destinatario',
  'parcel.weightKg': 'peso del pacco in kg',
};

/**
 * Costruisce un prompt chiaro per l'utente con l'elenco dei dati mancanti.
 * Es.: "Mi servono: nome destinatario, CAP mittente, peso in kg"
 */
export function generateClarificationFromMissingFields(missingFields: string[]): string {
  const labels = missingFields.map((f) => FIELD_LABELS[f] || f).filter(Boolean);
  if (labels.length === 0) {
    return 'Per procedere con la spedizione ho bisogno di qualche dato in più.';
  }
  if (labels.length === 1) {
    return `Per creare la spedizione mi serve ancora: **${labels[0]}**.`;
  }
  if (labels.length === 2) {
    return `Per la spedizione mi servono: **${labels[0]}** e **${labels[1]}**.`;
  }
  const last = labels.pop();
  return `Per procedere mi servono: **${labels.join(', ')}** e **${last}**.`;
}
