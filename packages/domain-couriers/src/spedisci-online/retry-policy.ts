export interface RetryPolicyInput {
  attempt: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function computeExponentialBackoffMs(input: RetryPolicyInput): number {
  const baseDelayMs = input.baseDelayMs ?? 250;
  const maxDelayMs = input.maxDelayMs ?? 5000;
  const exp = Math.max(0, input.attempt);
  return Math.min(baseDelayMs * 2 ** exp, maxDelayMs);
}
