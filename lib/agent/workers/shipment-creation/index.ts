/**
 * Catena "Creazione spedizione": 7 worker di validazione + orchestratore.
 * Esporta runShipmentCreationChain e generateClarificationFromMissingFields per il Supervisor.
 */

export { runShipmentCreationChain } from './chain';
export type { RunShipmentCreationChainInput } from './chain';
export { generateClarificationFromMissingFields } from './clarification';
export {
  runAllValidationWorkers,
  workerNames,
  workerLocalita,
  workerCap,
  workerIndirizzi,
  workerTelefoni,
  workerProvince,
  workerPesoMisure,
  SHIPMENT_CREATION_REQUIRED_FIELDS,
} from './validation-workers';
export type { ShipmentChainResult, ShipmentChainInput, WorkerFieldResult } from './types';
