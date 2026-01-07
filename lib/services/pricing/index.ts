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
  // Funzioni
  getPlatformFee,
  getPlatformFeeHistory,
  getPlatformFeeSafe,
  listUsersWithCustomFees,
  updatePlatformFee,
  type PlatformFeeHistoryEntry,
  // Tipi
  type PlatformFeeResult,
  type UpdatePlatformFeeInput,
  type UpdatePlatformFeeResult,
} from "./platform-fee";

// Sprint 3: PricingService centralizzato
export {
  PricingService,
  createPricingService,
  getPricingService,
  type PricingServiceOptions,
  type QuoteParams,
  type QuoteResult,
} from "./pricing-service";
