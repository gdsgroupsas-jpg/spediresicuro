
import crypto from 'crypto';

interface XPayConfig {
  alias: string;
  macKey: string;
  environment: 'TEST' | 'PROD';
}

const DEFAULT_CONFIG: XPayConfig = {
  alias: process.env.INTESA_ALIAS || 'ALIAS_DI_TEST_7556483', // Placeholder tipico
  macKey: process.env.INTESA_MAC_KEY || 'CHIAVE_MAC_DI_TEST',
  environment: (process.env.INTESA_ENV as 'TEST' | 'PROD') || 'TEST'
};

const URLS = {
  TEST: 'https://test.nexi.payment.it/monetaweb/payment/2/login',
  PROD: 'https://ecommerce.nexi.it/ecomm/ecomm/DispatcherServlet' // Verifica URL esatto da documentazione recente
};

export class IntesaXPay {
  private config: XPayConfig;

  constructor(config: Partial<XPayConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calcola la commissione e il totale
   * Esempio: 1.5% + 0.25€ fissi
   */
  calculateFee(amountInfo: number): { fee: number; total: number } {
    const FIXED_FEE = 0.25;
    const PERCENTAGE = 0.015; // 1.5%

    const fee = Number(((amountInfo * PERCENTAGE) + FIXED_FEE).toFixed(2));
    const total = Number((amountInfo + fee).toFixed(2));

    return { fee, total };
  }

  /**
   * Genera l'hash MAC SHA1 richiesto da XPay
   * Stringa: "codTrans=<codTrans>divisa=<divisa>importo=<importo><macKey>"
   */
  private generateMac(codTrans: string, amountCents: number, currency: string = 'EUR'): string {
    const rawString = `codTrans=${codTrans}divisa=${currency}importo=${amountCents}${this.config.macKey}`;
    return crypto.createHash('sha1').update(rawString).digest('hex');
  }

  /**
   * Prepara i dati per il form di redirect
   */
  createPaymentSession(orderId: string, amountTotal: number, email: string) {
    // XPay vuole l'importo in centesimi senza virgola
    const amountCents = Math.round(amountTotal * 100);
    const currency = 'EUR';
    
    const mac = this.generateMac(orderId, amountCents, currency);
    
    // URL di base
    const baseUrl = this.config.environment === 'TEST' ? URLS.TEST : URLS.PROD;

    return {
      url: baseUrl,
      fields: {
        alias: this.config.alias,
        importo: amountCents.toString(),
        divisa: currency,
        codTrans: orderId,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet/callback/success`,
        url_back: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet/callback/cancel`,
        mac: mac,
        email: email,
        languageId: 'ITA'
      }
    };
  }
}

export const xpay = new IntesaXPay();
