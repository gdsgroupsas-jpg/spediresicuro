/**
 * Anne fixtures: Pricing / richiesta_preventivo test matrix
 */

export interface PricingTestCase {
  message: string;
  expectedFlowId: 'richiesta_preventivo' | 'support';
  shouldAskClarification: boolean;
  expectedStatus: number;
  description: string;
}

export const PRICING_TEST_MATRIX: PricingTestCase[] = [
  {
    message: 'Preventivo per 2 kg a 00100 Roma',
    expectedFlowId: 'richiesta_preventivo',
    shouldAskClarification: false,
    expectedStatus: 200,
    description: 'Pricing peso e CAP',
  },
  {
    message: 'Quanto costa spedire 1.5 kg a 20100 Milano?',
    expectedFlowId: 'richiesta_preventivo',
    shouldAskClarification: false,
    expectedStatus: 200,
    description: 'Pricing quanto costa',
  },
  {
    message: 'Preventivo per 2 kg',
    expectedFlowId: 'richiesta_preventivo',
    shouldAskClarification: true,
    expectedStatus: 200,
    description: 'Pricing senza dati clarification',
  },
  {
    message: 'Ciao Anne, come va?',
    expectedFlowId: 'support',
    shouldAskClarification: false,
    expectedStatus: 200,
    description: 'Greeting support',
  },
  {
    message: '',
    expectedFlowId: 'support',
    shouldAskClarification: false,
    expectedStatus: 200,
    description: 'Empty no crash',
  },
];
