/**
 * Pricing Services
 * 
 * Servizi per gestione pricing e fee di piattaforma.
 * 
 * @since Sprint 3 - Refactoring: Aggiunto PricingService centralizzato
 */

export {
  // Costanti
  DEFAULT_PLATFORM_FEE,
  
  // Tipi
  type PlatformFeeResult,
  type PlatformFeeHistoryEntry,
  type UpdatePlatformFeeInput,
  type UpdatePlatformFeeResult,
  
  // Funzioni
  getPlatformFee,
  getPlatformFeeSafe,
  updatePlatformFee,
  getPlatformFeeHistory,
  listUsersWithCustomFees,
} from './platform-fee';

// Sprint 3: PricingService centralizzato
export {
  PricingService,
  getPricingService,
  createPricingService,
  type QuoteParams,
  type QuoteResult,
  type PricingServiceOptions,
} from './pricing-service';

