import type {
  CreatePriceListPolicyInput,
  PricingActor,
  PricingPolicyResult,
  UpdatePriceListPolicyInput,
} from '../types';

function accountType(actor: PricingActor): string {
  return String(actor.account_type || '').toLowerCase();
}

export function isAdminOrAboveActor(actor: PricingActor): boolean {
  const at = accountType(actor);
  return at === 'admin' || at === 'superadmin';
}

export function isByocActor(actor: PricingActor): boolean {
  return accountType(actor) === 'byoc';
}

export function isResellerActor(actor: PricingActor): boolean {
  return actor.is_reseller === true;
}

export function resolveCreateListType(input: CreatePriceListPolicyInput): PricingPolicyResult {
  const nextType = input.listType;
  if (nextType) return { valid: true, listType: nextType };

  if (isAdminOrAboveActor(input.actor) && input.isGlobal) {
    return { valid: true, listType: 'global' };
  }

  if (isResellerActor(input.actor) || isByocActor(input.actor)) {
    return { valid: true, listType: 'supplier' };
  }

  return { valid: true };
}

export function validateCreateListType(input: CreatePriceListPolicyInput): PricingPolicyResult {
  const resolved = resolveCreateListType(input);
  if (!resolved.valid) return resolved;

  const listType = resolved.listType;
  const actor = input.actor;
  const isAdmin = isAdminOrAboveActor(actor);
  const isReseller = isResellerActor(actor);
  const isByoc = isByocActor(actor);

  if (isByoc && listType !== 'supplier') {
    return {
      valid: false,
      error: 'BYOC puo creare solo listini fornitore (list_type = supplier)',
    };
  }

  if (isReseller && listType === 'global') {
    return {
      valid: false,
      error: 'Reseller non puo creare listini globali',
    };
  }

  if (input.isGlobal && !isAdmin) {
    return {
      valid: false,
      error: 'Solo gli admin possono creare listini globali',
    };
  }

  if (!isAdmin && !isReseller && !isByoc) {
    return {
      valid: false,
      error: 'Solo admin, reseller e BYOC possono creare listini',
    };
  }

  return { valid: true, listType };
}

export function validateUpdateListType(input: UpdatePriceListPolicyInput): PricingPolicyResult {
  const actor = input.actor;
  const requestedListType = input.requestedListType;

  if (isByocActor(actor) && requestedListType && requestedListType !== 'supplier') {
    return {
      valid: false,
      error: 'BYOC puo modificare solo listini fornitore',
    };
  }

  if (isResellerActor(actor) && requestedListType === 'global') {
    return {
      valid: false,
      error: 'Reseller non puo creare listini globali',
    };
  }

  return { valid: true, listType: requestedListType };
}
