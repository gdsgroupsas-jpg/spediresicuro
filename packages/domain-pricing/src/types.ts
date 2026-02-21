export type PriceListType = 'global' | 'supplier' | 'custom';

export interface PricingActor {
  id: string;
  account_type?: string | null;
  is_reseller?: boolean | null;
}

export interface CreatePriceListPolicyInput {
  actor: PricingActor;
  listType?: PriceListType;
  isGlobal?: boolean;
}

export interface UpdatePriceListPolicyInput {
  actor: PricingActor;
  requestedListType?: PriceListType;
}

export type PricingPolicyResult =
  | {
      valid: true;
      listType?: PriceListType;
    }
  | {
      valid: false;
      error: string;
    };
