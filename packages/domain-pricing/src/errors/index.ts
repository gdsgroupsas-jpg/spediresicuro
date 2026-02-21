export class PricingPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingPolicyError';
  }
}
