/**
 * Feature Flags - Centralized Configuration
 *
 * Gestione feature flags per rollout graduale di nuove funzionalità.
 * Permette di abilitare/disabilitare features senza deploy.
 */

export const featureFlags = {
  /**
   * VAT Semantics (ADR-001)
   * Mostra badge VAT nei componenti UI (comparator, dashboard)
   * Default: false (rollout graduale)
   */
  showVATSemantics: process.env.NEXT_PUBLIC_SHOW_VAT_SEMANTICS === "true",
} as const;
