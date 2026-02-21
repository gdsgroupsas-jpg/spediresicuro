/**
 * Prompt di sistema per i 7 worker di validazione (catena creazione spedizione).
 * Usati per documentazione e per eventuale estensione LLM; l'estrazione attuale è rule-based.
 */

export const WORKER_NAMES_PROMPT = `Il tuo compito è solo stabilire se nel messaggio e nello stato sono presenti nome e cognome del mittente e nome e cognome del destinatario. Rispondi solo con presente/assente e eventuale valore estratto.`;

export const WORKER_LOCALITA_PROMPT = `Il tuo compito è stabilire se sono presenti le località (città) mittente e destinatario. Per la creazione spedizione usiamo solo la città destinatario. Rispondi con presente/assente e valore estratto.`;

export const WORKER_CAP_PROMPT = `Il tuo compito è stabilire se è presente il CAP (5 cifre) del destinatario. Rispondi con presente/assente e valore estratto.`;

export const WORKER_INDIRIZZI_PROMPT = `Il tuo compito è stabilire se è presente l'indirizzo (via, civico) del destinatario. Rispondi con presente/assente e valore estratto.`;

export const WORKER_TELEFONI_PROMPT = `Il tuo compito è stabilire se sono presenti i numeri di telefono mittente e destinatario. Rispondi con presente/assente e valori estratti.`;

export const WORKER_PROVINCE_PROMPT = `Il tuo compito è stabilire se è presente la provincia (2 lettere, es. MI, RM) del destinatario. Rispondi con presente/assente e valore estratto.`;

export const WORKER_PESO_MISURE_PROMPT = `Il tuo compito è stabilire se sono presenti peso (in kg) e eventualmente dimensioni (lunghezza, larghezza, altezza in cm) del pacco. Rispondi con presente/assente e valori estratti.`;
